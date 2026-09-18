import { clamp01, track } from './camera.ts'

/**
 * The entrance, on its own progress and separate from the analysis
 * camera: it belongs to the home surface and is walked through once.
 *
 * Blur and opacity are pinned to named percentages so the reveal can
 * be checked against a table rather than tuned by feel.
 */

export interface IntroState {
  /** How far the two lengths of cloth have drawn apart, 0-1. */
  readonly open: number
  /** Presence of the cloth. Reaches 0 only once it is off frame. */
  readonly cloth: number
  /** Blur on the photograph behind, in px. */
  readonly veilBlur: number
  /** Opacity of the photograph behind, 0-1. */
  readonly veilOpacity: number
  /** The CROQUIS lockup, which leaves before the photograph arrives. */
  readonly lockup: number
  /**
   * How far the photograph behind has come to rest, 0-1. It arrives
   * fractionally over-size and settles as the cloth draws back: what
   * gives the opening depth rather than making it a flat wipe.
   */
  readonly settle: number
}

/**
 * Cloth movement: small until 70%, then swept aside. A linear draw
 * would reveal the photograph earlier than the schedule below allows.
 */
const OPEN = [
  [0, 0],
  // Immediate response: the first flick of the wheel has to move
  // something, or the opening reads as a broken page.
  [0.04, 0.022],
  [0.15, 0.07],
  [0.3, 0.15],
  [0.5, 0.26],
  [0.7, 0.42],
  [0.88, 0.8],
  [1, 1],
] as const

/** Blur in px. */
const BLUR = [
  [0, 30],
  [0.15, 26],
  [0.3, 24],
  [0.5, 14],
  [0.7, 5],
  [1, 0],
] as const

/** Opacity of the photograph behind. */
const OPACITY = [
  [0, 0],
  [0.15, 0.05],
  [0.3, 0.15],
  [0.5, 0.4],
  [0.7, 0.8],
  [1, 1],
] as const

/**
 * The photograph's own arrival, behind the opening rather than with
 * it: most of the settling happens once there is enough gap to see it
 * through, so the movement is read and not merely performed.
 */
const SETTLE = [
  [0, 0],
  [0.3, 0.16],
  [0.7, 0.66],
  [0.9, 0.94],
  [1, 1],
] as const

export function introFor(progress: number): IntroState {
  const p = clamp01(progress)
  return {
    open: track(p, OPEN),
    // The cloth stays fully opaque until it is genuinely off frame, so
    // it leaves by moving rather than by dissolving.
    cloth: 1 - track(p, [
      [0, 0],
      [0.92, 0],
      [1, 1],
    ]),
    veilBlur: track(p, BLUR),
    veilOpacity: track(p, OPACITY),
    lockup: 1 - track(p, [
      [0, 0],
      [0.12, 0],
      [0.4, 1],
    ]),
    settle: track(p, SETTLE),
  }
}
