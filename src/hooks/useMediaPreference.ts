import { useCallback, useSyncExternalStore } from 'react'

/**
 * Subscribe to a media query.
 *
 * A media query list is an external store, so it is read as one: the
 * value comes from the browser at render time instead of being copied
 * into state by an effect, which is what made the first paint disagree
 * with the query it had just been asked about.
 */
function useMediaQuery(query: string, initial = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {}
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    [query],
  )

  const read = useCallback(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return initial
    return window.matchMedia(query).matches
  }, [query, initial])

  return useSyncExternalStore(subscribe, read, () => initial)
}

/**
 * Reduced motion is a first-class mode: parallax and tilt are removed
 * and the analysis renders as a plain, fully readable document.
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}

/**
 * Touch layout applies to touch devices and to narrow windows.
 * Resizing a desktop browser does not change pointer type, so
 * `(pointer: coarse)` alone would leave the desktop layout active in a
 * window too narrow for it.
 */
export function useCoarsePointer(breakpoint = 860): boolean {
  const coarse = useMediaQuery('(pointer: coarse)')
  const narrow = useMediaQuery(`(max-width: ${breakpoint - 1}px)`)
  return coarse || narrow
}
