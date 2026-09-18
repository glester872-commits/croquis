/** Masks are per-pixel flags in row-major order, 1 = member. */
export type Mask = Uint8Array

export interface SubjectSegmentation {
  readonly width: number
  readonly height: number
  /** Person, clothes, accessories, hair — everything that is not room. */
  readonly subjectMask: Mask
  /** The subject minus skin and minus the head. What an outfit is. */
  readonly garmentMask: Mask
  readonly backgroundMask: Mask
  /** Share of the frame each mask holds, 0-1. */
  readonly subjectShare: number
  readonly garmentShare: number
  /** How well the assumptions above held, 0-1. */
  readonly confidence: number
  /** Why the confidence is what it is, in Spanish, for the interface. */
  readonly notes: readonly string[]
}

/** Half-width of the corner boxes the background model is built from. */
const CORNER = 0.13
/** RGB distance from a background mode a pixel may still be background. */
const MODE_TOLERANCE = 46
/**
 * Base RGB distance the flood may travel between adjacent pixels.
 * Widened by the measured corner spread, since foliage and other
 * textured backgrounds vary far more per pixel than a studio sweep.
 */
const STEP_TOLERANCE = 13
/** How much of the corner spread is added to the step allowance. */
const STEP_SPREAD_FACTOR = 1.6

const SHADOW_FLOOR = 0.78
/** How far a shadow may drift in colour once rescaled to its own light. */
const SHADOW_CHROMA = 14
/**
 * Subject blobs below this share of the subject are dropped: a figure
 * is one connected region, an unreached patch of background is not.
 */
const MIN_COMPONENT_SHARE = 0.06
/** Below this the subject is too small to be a person in the frame. */
const MIN_SUBJECT_SHARE = 0.05
/** Above this the background model clearly failed to find the room. */
const MAX_SUBJECT_SHARE = 0.82
/** Below this there is not enough cloth left to name a colour from. */
const MIN_GARMENT_SHARE = 0.025
/**
 * Above this share, the skin rule is more likely matching neutral
 * garments than skin, so the exclusion is dropped and reported.
 */
const MAX_SKIN_SHARE = 0.28

interface Mode {
  readonly r: number
  readonly g: number
  readonly b: number
  /** Spread of the corner this mode came from, in RGB distance. */
  readonly spread: number
}

function at(data: Uint8ClampedArray, index: number): [number, number, number] {
  return [data[index * 4] ?? 0, data[index * 4 + 1] ?? 0, data[index * 4 + 2] ?? 0]
}

function distance(r: number, g: number, b: number, mode: Mode): number {
  return Math.hypot(r - mode.r, g - mode.g, b - mode.b)
}

/**
 * Background model: mean colour and spread of each frame corner.
 * Corners rather than the whole border, because a standing figure
 * reaches the bottom and side edges but rarely all four corners.
 */
function backgroundModes(data: Uint8ClampedArray, width: number, height: number): Mode[] {
  const boxW = Math.max(2, Math.round(width * CORNER))
  const boxH = Math.max(2, Math.round(height * CORNER))
  const corners: [number, number][] = [
    [0, 0],
    [width - boxW, 0],
    [0, height - boxH],
    [width - boxW, height - boxH],
  ]

  const modes: Mode[] = []
  for (const [originX, originY] of corners) {
    let r = 0
    let g = 0
    let b = 0
    let n = 0
    for (let y = originY; y < originY + boxH; y += 1) {
      for (let x = originX; x < originX + boxW; x += 1) {
        const [pr, pg, pb] = at(data, y * width + x)
        r += pr
        g += pg
        b += pb
        n += 1
      }
    }
    if (n === 0) continue
    const mean = { r: r / n, g: g / n, b: b / n, spread: 0 }

    let variance = 0
    for (let y = originY; y < originY + boxH; y += 1) {
      for (let x = originX; x < originX + boxW; x += 1) {
        const [pr, pg, pb] = at(data, y * width + x)
        variance += distance(pr, pg, pb, mean) ** 2
      }
    }
    modes.push({ ...mean, spread: Math.sqrt(variance / n) })
  }

  // Corners that agree collapse to one mode, keeping the tolerance
  // tight on a flat sweep while still allowing a gradient.
  const merged: Mode[] = []
  for (const mode of modes) {
    if (merged.some((kept) => distance(kept.r, kept.g, kept.b, mode) < MODE_TOLERANCE * 0.5)) continue
    merged.push(mode)
  }
  return merged.length > 0 ? merged : modes
}

/** How far a pixel may sit from the nearest mode and still be room. */
function toleranceOf(modes: readonly Mode[]): number {
  const spread = modes.reduce((max, mode) => Math.max(max, mode.spread), 0)
  return MODE_TOLERANCE + Math.min(34, spread)
}

function floodBackground(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  modes: readonly Mode[],
): Mask {
  const tolerance = toleranceOf(modes)
  const spread = modes.reduce((max, mode) => Math.max(max, mode.spread), 0)
  const step = STEP_TOLERANCE + STEP_SPREAD_FACTOR * spread
  const background = new Uint8Array(width * height)
  const queue = new Int32Array(width * height)
  let head = 0
  let tail = 0

  const matchesModel = (r: number, g: number, b: number) =>
    modes.some((mode) => distance(r, g, b, mode) <= tolerance)

  /**
   * Background at lower brightness. Rescaling the mode to the pixel's
   * own brightness isolates the chromaticity comparison from the
   * luminance one, so dark garments are not matched as shadow.
   */
  const isShadowOfModel = (r: number, g: number, b: number) =>
    modes.some((mode) => {
      const light = (r + g + b) / 3
      const base = (mode.r + mode.g + mode.b) / 3
      if (base <= 0 || light > base || light < base * SHADOW_FLOOR) return false
      const k = light / base
      return Math.hypot(r - mode.r * k, g - mode.g * k, b - mode.b * k) <= SHADOW_CHROMA
    })

  const seed = (index: number) => {
    if (background[index]) return
    const [r, g, b] = at(data, index)
    if (!matchesModel(r, g, b)) return
    background[index] = 1
    queue[tail++] = index
  }

  for (let x = 0; x < width; x += 1) {
    seed(x)
    seed((height - 1) * width + x)
  }
  for (let y = 0; y < height; y += 1) {
    seed(y * width)
    seed(y * width + width - 1)
  }

  while (head < tail) {
    const index = queue[head++] as number
    const x = index % width
    const y = (index / width) | 0
    const [r, g, b] = at(data, index)

    const visit = (nx: number, ny: number) => {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) return
      const next = ny * width + nx
      if (background[next]) return
      const [nr, ng, nb] = at(data, next)
      // A hard edge stops the flood regardless of colour, which keeps
      // the shadow allowance from reaching into a garment.
      if (Math.hypot(nr - r, ng - g, nb - b) > step) return
      if (!matchesModel(nr, ng, nb) && !isShadowOfModel(nr, ng, nb)) return
      background[next] = 1
      queue[tail++] = next
    }

    visit(x - 1, y)
    visit(x + 1, y)
    visit(x, y - 1)
    visit(x, y + 1)
  }

  return background
}

/**
 * Skin chromaticity in YCbCr.
 *
 * The usual companion RGB rule (`R > 95 && R > G && R > B`) is omitted
 * deliberately: it is the clause that makes classic skin detectors
 * fail on dark skin. False positives on neutral garments are caught by
 * MAX_SKIN_SHARE instead.
 */
function isSkin(r: number, g: number, b: number): boolean {
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
  if (cb < 77 || cb > 127 || cr < 133 || cr > 173) return false
  // A flat grey lands inside those bounds by rounding alone.
  const chroma = (Math.max(r, g, b) - Math.min(r, g, b)) / 255
  return chroma > 0.045
}

function share(mask: Mask): number {
  let count = 0
  for (let i = 0; i < mask.length; i += 1) if (mask[i]) count += 1
  return count / mask.length
}

/**
 * Keeps the figure and drops detached islands.
 *
 * The largest connected blob always survives; smaller ones only above
 * MIN_COMPONENT_SHARE, which removes patches of background the flood
 * could not reach.
 */
function keepLargestBlobs(mask: Mask, width: number, height: number): Mask {
  const label = new Int32Array(mask.length).fill(-1)
  const sizes: number[] = []
  const queue = new Int32Array(mask.length)

  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || label[start] !== -1) continue
    const id = sizes.length
    let head = 0
    let tail = 0
    label[start] = id
    queue[tail++] = start

    while (head < tail) {
      const index = queue[head++] as number
      const x = index % width
      const y = (index / width) | 0
      const visit = (nx: number, ny: number) => {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) return
        const next = ny * width + nx
        if (!mask[next] || label[next] !== -1) return
        label[next] = id
        queue[tail++] = next
      }
      visit(x - 1, y)
      visit(x + 1, y)
      visit(x, y - 1)
      visit(x, y + 1)
    }
    sizes.push(tail)
  }

  const total = sizes.reduce((sum, size) => sum + size, 0)
  if (total === 0) return mask
  const biggest = sizes.reduce((best, size, i) => (size > (sizes[best] ?? 0) ? i : best), 0)

  const kept = new Uint8Array(mask.length)
  for (let i = 0; i < mask.length; i += 1) {
    const id = label[i]
    if (id === -1 || id === undefined) continue
    const size = sizes[id] ?? 0
    kept[i] = id === biggest || size / total >= MIN_COMPONENT_SHARE ? 1 : 0
  }
  return kept
}

export function segmentSubject(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): SubjectSegmentation {
  const notes: string[] = []
  const modes = backgroundModes(data, width, height)
  const backgroundMask = floodBackground(data, width, height, modes)

  const raw = new Uint8Array(width * height)
  for (let i = 0; i < raw.length; i += 1) raw[i] = backgroundMask[i] ? 0 : 1
  const subjectMask = keepLargestBlobs(raw, width, height)
  // Blobs the filter discarded return to the background, keeping the
  // two masks an exact partition of the frame.
  for (let i = 0; i < subjectMask.length; i += 1) backgroundMask[i] = subjectMask[i] ? 0 : 1

  const subjectShare = share(subjectMask)

  /* ── skin, and the head it belongs to ─────────────────────────── */

  const skinMask = new Uint8Array(width * height)
  let skinCount = 0
  let subjectCount = 0
  for (let i = 0; i < subjectMask.length; i += 1) {
    if (!subjectMask[i]) continue
    subjectCount += 1
    const [r, g, b] = at(data, i)
    if (isSkin(r, g, b)) {
      skinMask[i] = 1
      skinCount += 1
    }
  }

  const skinShare = subjectCount > 0 ? skinCount / subjectCount : 0
  const skinUsable = skinShare > 0 && skinShare <= MAX_SKIN_SHARE
  if (skinShare > MAX_SKIN_SHARE) {
    notes.push(
      'El tono de las prendas cae dentro del rango de la piel, así que no se han separado: la paleta puede incluir piel.',
    )
  } else if (skinShare === 0) {
    notes.push('No se ha localizado piel en la fotografía; el pelo puede estar contando como prenda.')
  }

  const garmentMask = new Uint8Array(width * height)
  for (let i = 0; i < garmentMask.length; i += 1) {
    garmentMask[i] = subjectMask[i] && !(skinUsable && skinMask[i]) ? 1 : 0
  }

  // Hair is not separated from cloth: colour cannot tell them apart,
  // and geometric approaches (clearing the band above the face) erase
  // garments whenever bare skin appears below the neckline.
  if (skinUsable) {
    notes.push("El pelo no se separa de la ropa, y la piel muy iluminada puede escaparse del filtro: los dos pueden contar como prenda en la paleta.")
  }

  const garmentShare = share(garmentMask)

  /* ── how much of this to believe ──────────────────────────────── */

  let confidence = 1

  if (subjectShare < MIN_SUBJECT_SHARE) {
    confidence -= 0.6
    notes.push('Apenas se ha separado sujeto del fondo: puede que la persona ocupe muy poco encuadre.')
  } else if (subjectShare > MAX_SUBJECT_SHARE) {
    confidence -= 0.6
    notes.push('El fondo no se ha podido delimitar: casi toda la imagen se ha tomado como sujeto.')
  }

  if (garmentShare < MIN_GARMENT_SHARE) {
    confidence -= 0.5
    notes.push('Queda muy poca superficie de prenda después de excluir fondo, piel y cabeza.')
  }

  // An uneven background is where the corner model stops describing
  // the room.
  const spread = modes.reduce((max, mode) => Math.max(max, mode.spread), 0)
  if (spread > 42) {
    confidence -= 0.3
    notes.push('El fondo no es uniforme, así que la separación entre fondo y prenda es aproximada.')
  } else if (spread > 26) {
    confidence -= 0.12
  }

  // A subject running along the frame edge means the flood has either
  // consumed part of it or failed to start.
  let edgeSubject = 0
  for (let x = 0; x < width; x += 1) {
    if (subjectMask[x]) edgeSubject += 1
    if (subjectMask[(height - 1) * width + x]) edgeSubject += 1
  }
  for (let y = 0; y < height; y += 1) {
    if (subjectMask[y * width]) edgeSubject += 1
    if (subjectMask[y * width + width - 1]) edgeSubject += 1
  }
  const edgeShare = edgeSubject / (2 * (width + height))
  if (edgeShare > 0.45) {
    confidence -= 0.35
    notes.push('El sujeto toca el borde del encuadre en buena parte: parte de la prenda puede haberse tomado como fondo.')
  }

  return {
    width,
    height,
    subjectMask,
    garmentMask,
    backgroundMask,
    subjectShare,
    garmentShare,
    confidence: Math.max(0, Math.min(1, confidence)),
    notes,
  }
}
