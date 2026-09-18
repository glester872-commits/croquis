import assert from 'node:assert/strict'

import { MIN_SEGMENTATION_CONFIDENCE, measurePalette, rgbToHsl } from './measure-colour.ts'
import { segmentSubject } from './segment-subject.ts'

/* ── synthetic photographs ───────────────────────────────────────── */

type RGB = readonly [number, number, number]

interface Band {
  /** Fractions of the frame height. */
  readonly from: number
  readonly to: number
  readonly colour: RGB
}

interface Scene {
  readonly background: RGB
  /** Per-pixel wobble added to the background. */
  readonly noise?: number
  readonly bands: readonly Band[]
  /** Fractions of the frame width the figure occupies. */
  readonly left?: number
  readonly right?: number
  /** A skin-coloured head at the top of the figure. */
  readonly head?: RGB
}

const WIDTH = 120
const HEIGHT = 180

/**
 * A figure standing in a frame: a column reaching the bottom edge, the
 * way a full-length photograph is composed. A subject floating clear
 * of every edge would be the easy case.
 */
function paint(scene: Scene): Uint8ClampedArray {
  const data = new Uint8ClampedArray(WIDTH * HEIGHT * 4)
  const left = Math.round(WIDTH * (scene.left ?? 0.3))
  const right = Math.round(WIDTH * (scene.right ?? 0.7))
  const top = Math.round(HEIGHT * 0.12)
  // Deterministic wobble, so the cases never fail intermittently.
  const wobble = (x: number, y: number) => (((x * 7 + y * 13) % 11) - 5) * (scene.noise ?? 0) * 0.2

  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const index = (y * WIDTH + x) * 4
      let colour: RGB = scene.background
      let jitter = wobble(x, y)

      if (x >= left && x < right && y >= top) {
        jitter = 0
        const t = y / HEIGHT
        const band = scene.bands.find((entry) => t >= entry.from && t < entry.to)
        colour = band?.colour ?? scene.bands[scene.bands.length - 1]?.colour ?? scene.background
        if (scene.head && t < 0.22) colour = scene.head
      }

      data[index] = Math.max(0, Math.min(255, colour[0] + jitter))
      data[index + 1] = Math.max(0, Math.min(255, colour[1] + jitter))
      data[index + 2] = Math.max(0, Math.min(255, colour[2] + jitter))
      data[index + 3] = 255
    }
  }
  return data
}

function analyse(scene: Scene) {
  const data = paint(scene)
  const segmented = segmentSubject(data, WIDTH, HEIGHT)
  const palette = measurePalette(data, WIDTH, HEIGHT, segmented.garmentMask)
  return { segmented, palette }
}

const hueOf = (hex: string) => {
  const value = Number.parseInt(hex.slice(1), 16)
  return rgbToHsl((value >> 16) & 255, (value >> 8) & 255, value & 255)
}

const lightnessOf = (hex: string) => hueOf(hex)[2]

/** Does any swatch holding a real share sit near this hue? */
const carries = (
  swatches: readonly { hex: string; share: number }[],
  hue: number,
  span = 40,
  minShare = 8,
) =>
  swatches.some((swatch) => {
    const [h, s] = hueOf(swatch.hex)
    if (s < 0.12) return false
    const delta = Math.min(Math.abs(h - hue), 360 - Math.abs(h - hue))
    return delta <= span && swatch.share >= minShare
  })

/* ── CASO A — de negro sobre fondo blanco ────────────────────────── */

{
  const { segmented, palette } = analyse({
    background: [242, 242, 240],
    noise: 3,
    bands: [{ from: 0, to: 1, colour: [20, 20, 22] }],
  })

  assert.ok(
    segmented.confidence >= MIN_SEGMENTATION_CONFIDENCE,
    `caso A: confianza ${segmented.confidence.toFixed(2)} demasiado baja para publicar`,
  )
  assert.ok(palette, 'caso A: no ha salido paleta')

  const dominant = palette.swatches[0]
  assert.ok(dominant, 'caso A: paleta vacía')
  assert.ok(
    lightnessOf(dominant.hex) < 0.2,
    `caso A: el color dominante es claro (${dominant.hex}) — el fondo se ha colado`,
  )
  assert.ok(dominant.share >= 70, `caso A: el negro solo tiene ${dominant.share}%`)
  const light = palette.swatches.filter((swatch) => lightnessOf(swatch.hex) > 0.7)
  assert.equal(light.length, 0, `caso A: la pared sigue en la paleta: ${light.map((s) => s.hex)}`)
}

/* ── CASO B — de blanco sobre fondo negro ────────────────────────── */

{
  const { segmented, palette } = analyse({
    background: [13, 13, 14],
    noise: 3,
    bands: [{ from: 0, to: 1, colour: [238, 238, 236] }],
  })

  assert.ok(segmented.confidence >= MIN_SEGMENTATION_CONFIDENCE, 'caso B: confianza baja')
  assert.ok(palette, 'caso B: no ha salido paleta')

  const dominant = palette.swatches[0]
  assert.ok(dominant, 'caso B: paleta vacía')
  assert.ok(
    lightnessOf(dominant.hex) > 0.8,
    `caso B: el color dominante es oscuro (${dominant.hex}) — el fondo se ha colado`,
  )
  const dark = palette.swatches.filter((swatch) => lightnessOf(swatch.hex) < 0.2)
  assert.equal(dark.length, 0, `caso B: el fondo negro sigue en la paleta: ${dark.map((s) => s.hex)}`)
}

/* ── CASO C — ropa neutra en exterior verde ──────────────────────── */

{
  const { segmented, palette } = analyse({
    background: [86, 124, 62],
    noise: 22,
    bands: [{ from: 0, to: 1, colour: [189, 181, 166] }],
  })

  assert.ok(segmented.confidence >= MIN_SEGMENTATION_CONFIDENCE, 'caso C: confianza baja')
  assert.ok(palette, 'caso C: no ha salido paleta')

  assert.ok(!carries(palette.swatches, 110, 45, 5), 'caso C: el césped domina el outfit')
  const dominant = palette.swatches[0]
  assert.ok(dominant, 'caso C: paleta vacía')
  const [, saturation, lightness] = hueOf(dominant.hex)
  assert.ok(
    saturation < 0.25 && lightness > 0.5,
    `caso C: el color dominante no es la prenda neutra (${dominant.hex})`,
  )
}

/* ── CASO D — varias prendas de colores ──────────────────────────── */

{
  const { segmented, palette } = analyse({
    background: [244, 243, 241],
    noise: 2,
    bands: [
      { from: 0, to: 0.45, colour: [176, 44, 40] },
      { from: 0.45, to: 0.8, colour: [38, 62, 138] },
      { from: 0.8, to: 1, colour: [214, 186, 44] },
    ],
  })

  assert.ok(segmented.confidence >= MIN_SEGMENTATION_CONFIDENCE, 'caso D: confianza baja')
  assert.ok(palette, 'caso D: no ha salido paleta')

  assert.ok(carries(palette.swatches, 2), 'caso D: falta el rojo')
  assert.ok(carries(palette.swatches, 224), 'caso D: falta el azul')
  assert.ok(carries(palette.swatches, 50), 'caso D: falta el amarillo')
  const light = palette.swatches.filter((swatch) => lightnessOf(swatch.hex) > 0.85)
  assert.equal(light.length, 0, 'caso D: el fondo blanco sigue en la paleta')
}

/* ── la piel no es una prenda ────────────────────────────────────── */

{
  const { segmented, palette } = analyse({
    background: [240, 239, 236],
    noise: 2,
    bands: [{ from: 0, to: 1, colour: [30, 42, 76] }],
    head: [198, 150, 118],
  })

  assert.ok(palette, 'piel: no ha salido paleta')
  const skinLike = palette.swatches.filter((swatch) => {
    const [h, s, l] = hueOf(swatch.hex)
    return h > 12 && h < 45 && s > 0.15 && l > 0.4
  })
  assert.equal(skinLike.length, 0, `piel: la cara está contando como prenda: ${skinLike.map((s) => s.hex)}`)
  assert.ok(segmented.garmentShare < segmented.subjectShare, 'piel: no se ha excluido nada del sujeto')
}

/* ── cuando no hay fondo que separar, no se publica nada ─────────── */

{
  // A subject filling the frame: there is no room to model, so the
  
  const { segmented } = analyse({
    background: [40, 44, 60],
    bands: [{ from: 0, to: 1, colour: [40, 44, 60] }],
    left: 0,
    right: 1,
  })
  assert.ok(
    segmented.confidence < MIN_SEGMENTATION_CONFIDENCE,
    `sin fondo: confianza ${segmented.confidence.toFixed(2)} — debería negarse a publicar`,
  )
}

/* ── las máscaras son una partición del encuadre ─────────────────── */

{
  const data = paint({ background: [242, 242, 240], bands: [{ from: 0, to: 1, colour: [20, 20, 22] }] })
  const { subjectMask, backgroundMask, garmentMask } = segmentSubject(data, WIDTH, HEIGHT)
  for (let i = 0; i < subjectMask.length; i += 1) {
    assert.equal(
      (subjectMask[i] ?? 0) + (backgroundMask[i] ?? 0),
      1,
      `máscara ${i}: sujeto y fondo no parten el encuadre`,
    )
    if (garmentMask[i]) assert.equal(subjectMask[i], 1, `máscara ${i}: prenda fuera del sujeto`)
  }
}

// Reached only if every assertion above held.
console.log('segment-subject: ok')
