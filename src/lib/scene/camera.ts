import type { Region } from '@/types'

/**
 * The camera.
 *
 * One scene stays on screen and scroll position is the only input to a
 * camera moving through it. Everything here is a pure function of that
 * number, so a given p fully determines the frame.
 *
 * Acts, material slots and camera moves are expressed against the act
 * table rather than tuned constants, so they cannot drift out of step.
 *
 * The photograph never moves in the DOM. The camera moves.
 */

export type ActId =
  | 'enter'
  | 'silhouette'
  | 'proportions'
  | 'garments'
  | 'material'
  | 'style-dna'
  | 'trend'

export interface Act {
  readonly id: ActId
  readonly label: string
  /** Progress where this act begins, inclusive. */
  readonly start: number
  /** Progress where it ends. */
  readonly end: number
  /** Items the act walks through. 0 when it is not a list. */
  readonly count: number
}

/** The acts, in order. A full reading has all seven. */
const SPECS: readonly { readonly id: ActId; readonly label: string }[] = [
  { id: 'enter', label: 'Entrar en el look' },
  { id: 'silhouette', label: 'Silueta' },
  { id: 'proportions', label: 'Proporciones' },
  { id: 'garments', label: 'Prendas' },
  { id: 'material', label: 'Materiales' },
  { id: 'style-dna', label: 'ADN de estilo' },
  { id: 'trend', label: 'Señales de tendencia' },
]

/* ── scalar helpers ──────────────────────────────────────────────── */

export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value
}

/** Progress of `p` across [a, b], clamped. The workhorse of the file. */
export function ramp(p: number, a: number, b: number): number {
  return b === a ? (p < a ? 0 : 1) : clamp01((p - a) / (b - a))
}

/** Ease both ends so no act starts or stops with a visible jerk. */
export function smooth(t: number): number {
  const x = clamp01(t)
  return x * x * (3 - 2 * x)
}

export function mix(from: number, to: number, t: number): number {
  return from + (to - from) * t
}

/**
 * Reads a value off a curve of [at, value] stops: linear between them
 * and flat outside. Lets a reveal be specified as a table rather than
 * as nested interpolations.
 */
export function track(x: number, stops: readonly (readonly [number, number])[]): number {
  const first = stops[0]
  if (!first) return 0
  if (x <= first[0]) return first[1]
  for (let i = 1; i < stops.length; i += 1) {
    const from = stops[i - 1]
    const to = stops[i]
    if (!from || !to) break
    if (x <= to[0]) return mix(from[1], to[1], ramp(x, from[0], to[0]))
  }
  const last = stops[stops.length - 1]
  return last ? last[1] : 0
}

/* ── the timeline ────────────────────────────────────────────────── */

/** What the analysis actually has to show, act by act. */
export interface SceneContent {
  /** Whether a palette could be measured at all. */
  readonly palette: boolean
  readonly silhouette: boolean
  readonly garments: number
  readonly materials: number
  readonly styleDna: number
  readonly trends: number
}

/**
 * Screens an act is worth, given its content. Zero drops the act from
 * the timeline entirely. `enter` is always present; every other act
 * appears only when it has something to show, the colour act included.
 */
function weightOf(id: ActId, content: SceneContent): number {
  switch (id) {
    case 'enter':
      return 1
    case 'silhouette':
      return content.silhouette ? 1 : 0
    case 'proportions':
      return content.silhouette ? 1 : 0
    case 'garments':
      return content.garments > 0 ? 0.5 + 0.45 * content.garments : 0
    // Materials get the most room per item: this is the act where the
    // camera travels, and a pan needs distance to read as a pan.
    case 'material':
      if (content.materials > 0) return 0.6 + 0.8 * content.materials
      // The colour act carries the palette. Without one there is
      // nothing in it, so it does not happen.
      return content.palette ? 1.1 : 0
    case 'style-dna':
      return content.styleDna > 0 ? 0.6 + 0.5 * content.styleDna : 0
    case 'trend':
      return content.trends > 0 ? 1.3 : 0
  }
}

/** Act label, narrowed when no materials were read. */
function labelOf(id: ActId, label: string, content: SceneContent): string {
  return id === 'material' && content.materials === 0 ? 'Paleta del outfit' : label
}

function countOf(id: ActId, content: SceneContent): number {
  return id === 'garments'
    ? content.garments
    : id === 'material'
      ? content.materials
      : id === 'style-dna'
        ? content.styleDna
        : 0
}

export interface Scene {
  readonly acts: readonly Act[]
  /** Scroll travel, in viewport heights. The section is this plus one. */
  readonly screens: number
}

/**
 * Builds the timeline for one analysis: the acts that have content,
 * each sized by how much of it they carry.
 */
export function buildScene(content: SceneContent): Scene {
  const present = SPECS.map((spec) => ({ spec, weight: weightOf(spec.id, content) })).filter(
    (entry) => entry.weight > 0,
  )
  const total = present.reduce((sum, entry) => sum + entry.weight, 0)

  let at = 0
  const acts = present.map((entry, i) => {
    const start = at
    at += entry.weight / total
    return {
      id: entry.spec.id,
      label: labelOf(entry.spec.id, entry.spec.label, content),
      start,
      // The last act ends exactly at 1; accumulated float would not.
      end: i === present.length - 1 ? 1 : at,
      count: countOf(entry.spec.id, content),
    }
  })

  return { acts, screens: total }
}

/**
 * Converting an act boundary to progress and back lands fractionally
 * below it; without this epsilon that rounds into the previous act.
 */
const BOUNDARY_EPSILON = 1e-6

/** The act with this id, or null when this analysis does not have it. */
export function actAt(acts: readonly Act[], id: ActId): Act | null {
  return acts.find((act) => act.id === id) ?? null
}

export function actIndexAt(acts: readonly Act[], p: number): number {
  const value = clamp01(p)
  for (let i = acts.length - 1; i >= 0; i -= 1) {
    const act = acts[i]
    if (act && value >= act.start - BOUNDARY_EPSILON) return i
  }
  return 0
}

/** How far through its own act progress `p` sits, 0-1. */
export function actProgressAt(acts: readonly Act[], p: number): number {
  const act = acts[actIndexAt(acts, p)]
  if (!act) return 0
  return ramp(clamp01(p), act.start, act.end)
}

/**
 * Progress an act begins at, where a rail click lands. Nudged just
 * inside so the boundary cannot round back into the previous act.
 */
export function progressForAct(acts: readonly Act[], index: number): number {
  const act = acts[index]
  if (!act) return 0
  return Math.min(act.start + (act.end - act.start) * 0.02, act.end)
}

/** Where the middle of one item of a list-walking act sits. */
export function progressForStep(acts: readonly Act[], id: ActId, step: number): number {
  const act = actAt(acts, id)
  if (!act) return 0
  const count = Math.max(1, act.count)
  return act.start + ((step + 0.5) / count) * (act.end - act.start)
}

/**
 * Which item an act is on, from its local progress. Each item holds an
 * equal slice; the last one keeps the final slice at progress 1.
 */
export function stepAt(localProgress: number, count: number): number {
  if (count <= 1) return 0
  const index = Math.floor(clamp01(localProgress) * count)
  return index >= count ? count - 1 : index
}

/* ── the camera ──────────────────────────────────────────────────── */

export interface CameraState {
  /** Multiplier on the plate. */
  readonly scale: number
  /** Translation as a percentage of the plate's own box, pre-scale. */
  readonly x: number
  readonly y: number
  /** Depth in px. Needs a perspective on an ancestor to mean anything. */
  readonly z: number
  /** 1 while the editorial opening is present, 0 once it has left. */
  readonly editorial: number
  /** 1 once the analytic apparatus — rail and reading — is present. */
  readonly apparatus: number
  /** How far the room behind the subject is pushed down. */
  readonly recess: number
}

/** Absolute ceiling, whatever the room and the file would otherwise allow. */
export const MAX_MACRO_SCALE = 4.2

/**
 * Limits on the camera, measured from the page.
 *
 * `fitX`/`fitY` are the reserved stage over the plate's own size; the
 * photograph is clipped to that box, so a framing larger than it would
 * be partly off screen. `limit` caps magnification at the image's own
 * resolution.
 */
export interface Stage {
  readonly fitX: number
  readonly fitY: number
  readonly limit: number
}

export const FULL_STAGE: Stage = { fitX: 1, fitY: 1, limit: MAX_MACRO_SCALE }

/**
 * Frames a normalised region: centre it on the plate, then scale until
 * it fits the available stage.
 *
 * The transform is written `scale() translate()`, so the translation
 * applies first in the element's own unscaled coordinates — which is
 * why these percentages are plain.
 */
export function zoomTo(
  region: Region,
  stage: Stage = FULL_STAGE,
): { scale: number; x: number; y: number } {
  const byWidth = region.width > 0 ? stage.fitX / region.width : stage.limit
  const byHeight = region.height > 0 ? stage.fitY / region.height : stage.limit
  return {
    // Fit, not fill: the whole region has to land inside the stage, or
    // the act is pushing into something you cannot see all of.
    scale: Math.min(byWidth, byHeight, stage.limit),
    x: (0.5 - (region.x + region.width / 2)) * 100,
    y: (0.5 - (region.y + region.height / 2)) * 100,
  }
}

export interface MaterialFrame {
  /** Index of the material the reading is on. -1 when there are none. */
  readonly index: number
  /** The rectangle the camera frames, or null when there is nothing. */
  readonly region: Region | null
}

/**
 * Which material the frame is inside, and the rectangle to frame.
 *
 * Each material owns an equal slice of the act. The framing pans
 * continuously through the material centres instead of cutting: it
 * sits exactly on material i at the middle of i's slice and reaches
 * the halfway point at the boundary, so the frame is always nearest
 * the material the reading has highlighted.
 *
 * With no materials there is no frame.
 */
export function materialAt(
  acts: readonly Act[],
  p: number,
  regions: readonly Region[],
): MaterialFrame {
  const count = regions.length
  const act = actAt(acts, 'material')
  if (count === 0 || !act) return { index: -1, region: null }

  const local = ramp(clamp01(p), act.start, act.end)
  const index = stepAt(local, count)

  // Position along the material centres, which sit at (i + 0.5)/count.
  const u = Math.max(0, Math.min(count - 1, local * count - 0.5))
  const lo = Math.min(Math.floor(u), count - 1)
  const from = regions[lo] as Region
  const to = regions[lo + 1] ?? from
  const t = smooth(u - lo)

  return {
    index,
    region: {
      x: mix(from.x, to.x, t),
      y: mix(from.y, to.y, t),
      width: mix(from.width, to.width, t),
      height: mix(from.height, to.height, t),
    },
  }
}

/**
 * The whole sequence as one expression of p.
 *
 * `macro` is the region the material act pushes into, passed in as
 * data so the camera never needs to know where it came from. Null
 * leaves the camera where it is.
 */
export function cameraFor(
  acts: readonly Act[],
  p: number,
  macro: Region | null,
  stage: Stage = FULL_STAGE,
): CameraState {
  const a = clamp01(p)
  // `enter` is the only act every analysis has. Moves that depend on
  // an absent act are skipped rather than given fallback boundaries.
  const enter = actAt(acts, 'enter') ?? { start: 0, end: 1 }
  const material = actAt(acts, 'material')
  const trend = actAt(acts, 'trend')

  const entered = smooth(ramp(a, enter.start, enter.end))

  // The opening composition leaves before the apparatus arrives, so
  // the two never sit on screen at once fighting for the same columns.
  const editorial = 1 - smooth(ramp(a, enter.start, mix(enter.start, enter.end, 0.72)))
  const apparatus = smooth(ramp(a, mix(enter.start, enter.end, 0.62), enter.end))

  // A slow push through the reading acts, kept small. Measured against
  // the remaining timeline so it needs no particular act to exist.
  const dolly = 0.07 * smooth(ramp(a, enter.end, mix(enter.end, 1, 0.45)))

  // In and out of the cloth, strictly inside the material act: zero on
  // both boundaries, so neither transition is a cut.
  const lead = material ? (material.end - material.start) * 0.22 : 0
  const push =
    macro && material
      ? smooth(ramp(a, material.start, material.start + lead)) *
        (1 - smooth(ramp(a, material.end - lead, material.end)))
      : 0

  // The look steps back to make room for the trend it belongs to.
  const receded = trend ? smooth(ramp(a, trend.start, mix(trend.start, trend.end, 0.6))) : 0

  let scale = mix(0.74, 1, entered) + dolly
  let x = mix(16, 0, entered)
  let y = 0

  if (macro && push > 0) {
    const target = zoomTo(macro, stage)
    scale = mix(scale, target.scale, push)
    x = mix(x, target.x, push)
    y = mix(y, target.y, push)
  }

  return {
    scale: mix(scale, scale * 0.82, receded),
    x,
    y,
    z: mix(0, -170, receded),
    editorial,
    apparatus,
    // The room recedes as soon as the subject takes over, and again
    // when the trend layer needs the front of the stage.
    recess: Math.max(entered, receded),
  }
}
