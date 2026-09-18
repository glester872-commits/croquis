import { introFor } from './intro'

/**
 * The opening of an analysis, as the properties a surface reads.
 *
 * The schedule itself is `intro.ts` — the same one the home entrance
 * walks through. This is only how it reaches the DOM: written on the
 * element both the cloth and the photograph sit under, so the two
 * cannot disagree about how far the opening has got.
 */

/** Viewport heights of scroll the opening owns before the analysis. */
export const REVEAL_SCREENS = 1.8
/** Touch: the same schedule over a shorter thumb travel. */
export const REVEAL_SCREENS_TOUCH = 1.1

/**
 * `--open`, `--cloth` and `--lockup` are read by the cloth;
 * `--veil-*` and `--settle` by the photograph behind it.
 */
export function writeReveal(element: HTMLElement | null, progress: number): void {
  if (!element) return
  const intro = introFor(progress)
  element.style.setProperty('--open', intro.open.toFixed(4))
  element.style.setProperty('--cloth', intro.cloth.toFixed(4))
  element.style.setProperty('--lockup', intro.lockup.toFixed(4))
  element.style.setProperty('--veil-opacity', intro.veilOpacity.toFixed(4))
  element.style.setProperty('--veil-blur', intro.veilBlur.toFixed(2))
  element.style.setProperty('--settle', intro.settle.toFixed(4))
}
