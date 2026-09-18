import {
  MIN_SEGMENTATION_CONFIDENCE,
  SAMPLE_EDGE,
  measurePalette,
  type PaletteMeasurement,
} from '../analysis/measure-colour.ts'
import { segmentSubject } from '../analysis/segment-subject.ts'

/**
 * Isolating one garment.
 *
 *   photograph → segmentation → bounds → cut-out → colour
 *
 * A wardrobe photograph is not a look: nobody is wearing it, so the
 * subject *is* the garment and `subjectMask` is the right mask.
 * `garmentMask` additionally subtracts skin, and on a flat lay that
 * rule has nothing to protect and a neutral fabric to lose.
 *
 * The result carries a real alpha channel, because the wardrobe is a
 * sheet of garments on a dark table, not a grid of rectangular
 * photographs.
 */

/** Long edge of the stored cut-out. */
const CUTOUT_EDGE = 640
/** Long edge of the copy the sheet renders. */
const THUMB_EDGE = 340
/** Margin left around the bounds, as a share of the long edge. */
const PADDING = 0.03

export interface Bounds {
  readonly x0: number
  readonly y0: number
  /** Exclusive. */
  readonly x1: number
  /** Exclusive. */
  readonly y1: number
}

/**
 * Tightest box containing every set pixel, or null for an empty mask.
 *
 * Pure, so the check file drives it without a canvas.
 */
export function maskBounds(mask: Uint8Array, width: number, height: number): Bounds | null {
  let x0 = width
  let y0 = height
  let x1 = -1
  let y1 = -1

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!mask[y * width + x]) continue
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }

  return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 }
}

/** Grows a box by `pad` on every side, clamped to the frame. */
export function padBounds(bounds: Bounds, width: number, height: number, pad: number): Bounds {
  return {
    x0: Math.max(0, Math.floor(bounds.x0 - pad)),
    y0: Math.max(0, Math.floor(bounds.y0 - pad)),
    x1: Math.min(width, Math.ceil(bounds.x1 + pad)),
    y1: Math.min(height, Math.ceil(bounds.y1 + pad)),
  }
}

/** How well the garment could be lifted off its background, and why. */
export interface ItemIsolation {
  /** 0-1, as measured by the segmentation. */
  readonly confidence: number
  /** Share of the frame the garment holds, 0-1. */
  readonly share: number
  /** What limited it, in Spanish, for the interface to show. */
  readonly notes: readonly string[]
  /** False when the garment could not be separated from the room. */
  readonly isolated: boolean
}

export interface ItemCutout {
  /** The garment on transparency. The whole frame if isolation failed. */
  readonly cutout: Blob
  readonly thumbnail: Blob
  /**
   * Measured on the isolated pixels. Null when the isolation was not
   * confident enough to stand behind a colour reading.
   */
  readonly palette: PaletteMeasurement | null
  readonly isolation: ItemIsolation
  /** Natural size of the photograph, not of the cut-out. */
  readonly width: number
  readonly height: number
}

function context2d(
  canvas: HTMLCanvasElement,
  options?: CanvasRenderingContext2DSettings,
): CanvasRenderingContext2D {
  const context = canvas.getContext('2d', options)
  if (!context) throw new Error('El navegador no ha permitido procesar la imagen.')
  return context
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // PNG, not JPEG: the transparency is the point of the cut-out.
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('El navegador no ha podido generar el recorte de la prenda.'))
    }, 'image/png')
  })
}

/** The mask as an alpha-only image, so the browser can scale it. */
function maskToAlpha(mask: Uint8Array, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = context2d(canvas)
  const image = context.createImageData(width, height)
  for (let index = 0; index < width * height; index += 1) {
    image.data[index * 4 + 3] = mask[index] ? 255 : 0
  }
  context.putImageData(image, 0, 0)
  return canvas
}

function resize(source: HTMLCanvasElement, edge: number): HTMLCanvasElement {
  const scale = Math.min(1, edge / Math.max(source.width, source.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(source.width * scale))
  canvas.height = Math.max(1, Math.round(source.height * scale))
  const context = context2d(canvas)
  context.imageSmoothingQuality = 'high'
  context.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas
}

export async function cutOutItem(source: Blob): Promise<ItemCutout> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(source)
  } catch (cause) {
    throw new Error(
      'No se ha podido abrir esta imagen. Puede estar dañada o usar un formato que el navegador no sabe decodificar.',
      { cause },
    )
  }

  const fullWidth = bitmap.width
  const fullHeight = bitmap.height

  try {
    /* ── segment, at the size the segmentation is tuned for ───────── */
    const scale = Math.min(1, SAMPLE_EDGE / Math.max(fullWidth, fullHeight))
    const sampleWidth = Math.max(1, Math.round(fullWidth * scale))
    const sampleHeight = Math.max(1, Math.round(fullHeight * scale))

    const sample = document.createElement('canvas')
    sample.width = sampleWidth
    sample.height = sampleHeight
    const sampleContext = context2d(sample, { willReadFrequently: true })
    sampleContext.drawImage(bitmap, 0, 0, sampleWidth, sampleHeight)
    const pixels = sampleContext.getImageData(0, 0, sampleWidth, sampleHeight)

    const segmentation = segmentSubject(pixels.data, sampleWidth, sampleHeight)
    const mask = segmentation.subjectMask
    const bounds = maskBounds(mask, sampleWidth, sampleHeight)

    /* ── colour, only on the pixels the mask selects ──────────────── */
    const palette =
      bounds && segmentation.confidence >= MIN_SEGMENTATION_CONFIDENCE
        ? measurePalette(pixels.data, sampleWidth, sampleHeight, mask)
        : null

    const isolation: ItemIsolation = {
      confidence: segmentation.confidence,
      share: segmentation.subjectShare,
      notes: segmentation.notes,
      isolated: bounds !== null,
    }

    /* ── crop to the garment, then cut it out ─────────────────────── */
    const box = bounds
      ? padBounds(bounds, sampleWidth, sampleHeight, Math.max(sampleWidth, sampleHeight) * PADDING)
      : { x0: 0, y0: 0, x1: sampleWidth, y1: sampleHeight }

    const cropWidth = box.x1 - box.x0
    const cropHeight = box.y1 - box.y0

    const out = document.createElement('canvas')
    // Never enlarged past the photograph's own pixels.
    const outScale = Math.min(1 / scale, CUTOUT_EDGE / Math.max(cropWidth, cropHeight))
    out.width = Math.max(1, Math.round(cropWidth * outScale))
    out.height = Math.max(1, Math.round(cropHeight * outScale))

    const context = context2d(out)
    context.imageSmoothingQuality = 'high'
    // Source rectangle given in the photograph's own pixels.
    context.drawImage(
      bitmap,
      box.x0 / scale,
      box.y0 / scale,
      cropWidth / scale,
      cropHeight / scale,
      0,
      0,
      out.width,
      out.height,
    )

    if (bounds) {
      // The mask is a fraction of the resolution of the cut-out, so it
      // is not upscaled by hand: drawn scaled into the alpha channel,
      // the browser's own interpolation feathers the edge and the
      // garment stops looking cut out with scissors.
      context.globalCompositeOperation = 'destination-in'
      context.drawImage(
        maskToAlpha(mask, sampleWidth, sampleHeight),
        box.x0,
        box.y0,
        cropWidth,
        cropHeight,
        0,
        0,
        out.width,
        out.height,
      )
      context.globalCompositeOperation = 'source-over'
    }

    const [cutout, thumbnail] = await Promise.all([toBlob(out), toBlob(resize(out, THUMB_EDGE))])

    return { cutout, thumbnail, palette, isolation, width: fullWidth, height: fullHeight }
  } finally {
    bitmap.close()
  }
}
