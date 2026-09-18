import type { ColorSwatch, Region } from '@/types'

import { segmentSubject } from './segment-subject.ts'

/**
 * Colour arithmetic over a region of a photograph.
 *
 * Dominant colours, their share, WCAG contrast, temperature and
 * harmony. Which pixels to measure is decided by segment-subject.ts.
 */

/** Long edge the image is sampled at. Enough to be stable, small enough to be instant. */
export const SAMPLE_EDGE = 160
/** Bits kept per channel when bucketing. 5 bits = 32 levels = 32k buckets. */
const QUANTISE_BITS = 5
/** Buckets closer than this in RGB space are the same colour to the eye. */
const MERGE_DISTANCE = 58
/** A colour has to hold this share of the frame to be worth naming. */
const MIN_SHARE = 0.035

export type Temperature = 'cálida' | 'neutra' | 'fría'
export type ContrastLevel = 'bajo' | 'medio' | 'alto'

export interface ColourMeasurement {
  readonly swatches: readonly ColorSwatch[]
  readonly contrast: ContrastLevel
  /** Ratio between the lightest and darkest dominant colour, WCAG form. */
  readonly contrastRatio: number
  readonly temperature: Temperature
  /** Plain-language description of how the hues relate. */
  readonly harmony: string
  readonly width: number
  readonly height: number
}

interface Bucket {
  r: number
  g: number
  b: number
  count: number
  /** Pixel-space bounds, for the region this colour occupies. */
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/* ── colour maths ────────────────────────────────────────────────── */

function toHex(r: number, g: number, b: number): string {
  const part = (value: number) => Math.round(value).toString(16).padStart(2, '0')
  return `#${part(r)}${part(g)}${part(b)}`
}

/** WCAG relative luminance. Used for real contrast, not a guess at it. */
export function relativeLuminance(r: number, g: number, b: number): number {
  const channel = (value: number) => {
    const v = value / 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrastRatio(a: number, b: number): number {
  const [high, low] = a >= b ? [a, b] : [b, a]
  return (high + 0.05) / (low + 0.05)
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const lightness = (max + min) / 2
  if (max === min) return [0, 0, lightness]

  const delta = max - min
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min)
  let hue: number
  if (max === rn) hue = ((gn - bn) / delta + (gn < bn ? 6 : 0)) / 6
  else if (max === gn) hue = ((bn - rn) / delta + 2) / 6
  else hue = ((rn - gn) / delta + 4) / 6
  return [hue * 360, saturation, lightness]
}

/**
 * A name in Spanish, derived from where the colour actually sits in
 * HSL. Not a lookup of invented brand names — a description.
 */
export function describeColour(r: number, g: number, b: number): string {
  const [hue, , lightness] = rgbToHsl(r, g, b)
  // Chroma, not HSL saturation. Saturation inflates as a colour
  // approaches white — a barely tinted off-white reads 0.28 and would
  // be named as a hue, which is how the textile range ends up called
  
  const chroma = (Math.max(r, g, b) - Math.min(r, g, b)) / 255

  if (lightness < 0.09) return 'Negro'
  if (lightness > 0.93 && chroma < 0.06) return 'Blanco'
  if (chroma < 0.05) {
    if (lightness > 0.78) return 'Blanco roto'
    if (lightness > 0.58) return 'Gris claro'
    if (lightness > 0.34) return 'Gris medio'
    return 'Gris oscuro'
  }
  if (chroma < 0.16) {
    // Low-chroma warm neutrals are the textile range proper.
    if (hue >= 20 && hue < 60) {
      return lightness > 0.78 ? 'Hueso' : lightness > 0.5 ? 'Greige' : lightness > 0.3 ? 'Topo' : 'Espresso'
    }
    if (lightness > 0.62) return 'Gris perla'
    return lightness > 0.36 ? 'Gris cálido' : 'Grafito'
  }

  const base =
    hue < 15 || hue >= 345
      ? 'Rojo'
      : hue < 40
        ? 'Naranja'
        : hue < 68
          ? 'Amarillo'
          : hue < 100
            ? 'Verde lima'
            : hue < 160
              ? 'Verde'
              : hue < 200
                ? 'Turquesa'
                : hue < 250
                  ? 'Azul'
                  : hue < 290
                    ? 'Violeta'
                    : 'Magenta'

  if (hue >= 15 && hue < 45 && lightness < 0.42) return 'Marrón'
  if (lightness < 0.3) return `${base} oscuro`
  if (lightness > 0.72) return `${base} claro`
  return base
}

/* ── the measurement ─────────────────────────────────────────────── */

function distance(a: Bucket, b: Bucket): number {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b)
}

/** Merge buckets that are the same colour to the eye, largest first. */
function merge(buckets: Bucket[]): Bucket[] {
  const sorted = [...buckets].sort((a, b) => b.count - a.count)
  const kept: Bucket[] = []

  for (const bucket of sorted) {
    const near = kept.find((candidate) => distance(candidate, bucket) < MERGE_DISTANCE)
    if (!near) {
      kept.push({ ...bucket })
      continue
    }
    // Weighted mean, so merging never shifts a colour toward a tone
    // that is not actually in the photograph.
    const total = near.count + bucket.count
    near.r = (near.r * near.count + bucket.r * bucket.count) / total
    near.g = (near.g * near.count + bucket.g * bucket.count) / total
    near.b = (near.b * near.count + bucket.b * bucket.count) / total
    near.count = total
    near.minX = Math.min(near.minX, bucket.minX)
    near.minY = Math.min(near.minY, bucket.minY)
    near.maxX = Math.max(near.maxX, bucket.maxX)
    near.maxY = Math.max(near.maxY, bucket.maxY)
  }
  return kept
}

function describeHarmony(hues: readonly number[]): string {
  if (hues.length < 2) return 'Monocromo — un solo tono gobierna el look'

  // Circular spread: the smallest arc containing every hue.
  const sorted = [...hues].sort((a, b) => a - b)
  let widest = 0
  for (let i = 0; i < sorted.length; i += 1) {
    const current = sorted[i]
    const next = sorted[(i + 1) % sorted.length]
    if (current === undefined || next === undefined) continue
    const gap = i === sorted.length - 1 ? next + 360 - current : next - current
    widest = Math.max(widest, gap)
  }
  const spread = 360 - widest

  if (spread < 34) return 'Monocromo — un solo tono en distintas claridades'
  if (spread < 92) return 'Análoga — tonos vecinos, sin salto de color'
  if (spread < 165) return 'Tríada abierta — tonos separados pero relacionados'
  return 'Complementaria — tonos enfrentados en la rueda'
}

/* ── the measurement, over a region rather than a frame ──────────── */

export interface PaletteMeasurement {
  readonly swatches: readonly ColorSwatch[]
  readonly contrast: ContrastLevel
  /** Ratio between the lightest and darkest dominant colour, WCAG form. */
  readonly contrastRatio: number
  readonly temperature: Temperature
  /** Plain-language description of how the hues relate. */
  readonly harmony: string
  /** Pixels the measurement actually rests on. */
  readonly sampled: number
}

/**
 * Dominant colours of the pixels a mask selects.
 *
 * Only masked pixels are counted, so the result describes the garment
 * region rather than the frame. Pure: the check file drives it with
 * pixel buffers under Node.
 */
export function measurePalette(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  mask: Uint8Array,
): PaletteMeasurement | null {
  const shift = 8 - QUANTISE_BITS
  const buckets = new Map<number, Bucket>()
  let sampled = 0

  for (let index = 0; index < width * height; index += 1) {
    if (!mask[index]) continue
    if ((data[index * 4 + 3] ?? 0) < 128) continue

    const r = data[index * 4] ?? 0
    const g = data[index * 4 + 1] ?? 0
    const b = data[index * 4 + 2] ?? 0
    sampled += 1

    const x = index % width
    const y = (index / width) | 0
    const key = ((r >> shift) << (QUANTISE_BITS * 2)) | ((g >> shift) << QUANTISE_BITS) | (b >> shift)

    const existing = buckets.get(key)
    if (existing) {
      existing.r += (r - existing.r) / (existing.count + 1)
      existing.g += (g - existing.g) / (existing.count + 1)
      existing.b += (b - existing.b) / (existing.count + 1)
      existing.count += 1
      if (x < existing.minX) existing.minX = x
      if (y < existing.minY) existing.minY = y
      if (x > existing.maxX) existing.maxX = x
      if (y > existing.maxY) existing.maxY = y
    } else {
      buckets.set(key, { r, g, b, count: 1, minX: x, minY: y, maxX: x, maxY: y })
    }
  }

  if (sampled === 0) return null

  const dominant = merge([...buckets.values()])
    .filter((bucket) => bucket.count / sampled >= MIN_SHARE)
    .slice(0, 6)

  if (dominant.length === 0) return null

  // Shares are normalised across what is actually shown, so the
  // figures on screen add to 100 and none of them is invented.
  const shown = dominant.reduce((total, bucket) => total + bucket.count, 0) || 1

  const swatches: ColorSwatch[] = dominant.map((bucket) => {
    const region: Region = {
      x: bucket.minX / width,
      y: bucket.minY / height,
      width: Math.max(0.01, (bucket.maxX - bucket.minX) / width),
      height: Math.max(0.01, (bucket.maxY - bucket.minY) / height),
    }
    return {
      hex: toHex(bucket.r, bucket.g, bucket.b),
      name: describeColour(bucket.r, bucket.g, bucket.b),
      share: Math.round((bucket.count / shown) * 100),
      region,
    }
  })

  const luminances = dominant.map((bucket) => relativeLuminance(bucket.r, bucket.g, bucket.b))
  const ratio = contrastRatio(Math.max(...luminances), Math.min(...luminances))
  const contrast: ContrastLevel = ratio >= 7 ? 'alto' : ratio >= 3 ? 'medio' : 'bajo'

  // Temperature weighted by how much of the region each colour holds,
  // ignoring near-greys, which have no meaningful hue to average.
  let warm = 0
  let cool = 0
  const hues: number[] = []
  for (const bucket of dominant) {
    const [hue] = rgbToHsl(bucket.r, bucket.g, bucket.b)
    const chroma =
      (Math.max(bucket.r, bucket.g, bucket.b) - Math.min(bucket.r, bucket.g, bucket.b)) / 255
    if (chroma < 0.05) continue
    hues.push(hue)
    if (hue < 75 || hue >= 300) warm += bucket.count
    else cool += bucket.count
  }
  const decisive = Math.abs(warm - cool) / (warm + cool || 1) > 0.25
  const temperature: Temperature = !decisive ? 'neutra' : warm > cool ? 'cálida' : 'fría'

  return {
    swatches,
    contrast,
    contrastRatio: Math.round(ratio * 10) / 10,
    temperature,
    harmony: describeHarmony(hues),
    sampled,
  }
}

/* ── the pipeline ────────────────────────────────────────────────── */

/** Minimum segmentation confidence for a palette to be published. */
export const MIN_SEGMENTATION_CONFIDENCE = 0.55

export interface OutfitColorAnalysis {
  /** Null when the outfit could not be isolated well enough to measure. */
  readonly palette: PaletteMeasurement | null
  readonly segmentation: {
    readonly subjectShare: number
    readonly garmentShare: number
    readonly confidence: number
    readonly notes: readonly string[]
    /** The analysed region drawn over the photograph, as a data URL. */
    readonly preview: string
  }
  /** Natural size of the photograph, not the sampled size. */
  readonly width: number
  readonly height: number
}

/** Renders the garment region over a dimmed copy of the photograph. */
function drawPreview(source: ImageData, mask: Uint8Array, width: number, height: number): string {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return ''

  const out = context.createImageData(width, height)
  for (let index = 0; index < width * height; index += 1) {
    const r = source.data[index * 4] ?? 0
    const g = source.data[index * 4 + 1] ?? 0
    const b = source.data[index * 4 + 2] ?? 0
    const kept = mask[index] === 1
    // Excluded pixels are pushed most of the way to the room's own
    // graphite, so the analysed region reads as the only lit thing.
    out.data[index * 4] = kept ? r : Math.round(r * 0.16 + 16 * 0.84)
    out.data[index * 4 + 1] = kept ? g : Math.round(g * 0.16 + 16 * 0.84)
    out.data[index * 4 + 2] = kept ? b : Math.round(b * 0.16 + 16 * 0.84)
    out.data[index * 4 + 3] = 255
  }
  context.putImageData(out, 0, 0)
  return canvas.toDataURL('image/png')
}

/**
 * Decode, isolate, measure.
 *
 *   input → segmentation → garment region → colour
 */
export async function analyseOutfitColour(source: Blob): Promise<OutfitColorAnalysis> {
  const bitmap = await createImageBitmap(source)
  const { width: fullWidth, height: fullHeight } = bitmap

  const scale = Math.min(1, SAMPLE_EDGE / Math.max(fullWidth, fullHeight))
  const width = Math.max(1, Math.round(fullWidth * scale))
  const height = Math.max(1, Math.round(fullHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) {
    bitmap.close()
    throw new Error('El navegador no ha permitido leer los píxeles de la imagen.')
  }
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const image = context.getImageData(0, 0, width, height)
  const segmented = segmentSubject(image.data, width, height)

  const trusted = segmented.confidence >= MIN_SEGMENTATION_CONFIDENCE
  const palette = trusted ? measurePalette(image.data, width, height, segmented.garmentMask) : null

  return {
    palette,
    segmentation: {
      subjectShare: segmented.subjectShare,
      garmentShare: segmented.garmentShare,
      confidence: segmented.confidence,
      notes: segmented.notes,
      preview: drawPreview(image, segmented.garmentMask, width, height),
    },
    width: fullWidth,
    height: fullHeight,
  }
}
