import { useEffect, useRef } from 'react'

import { clamp01 } from '@/lib/scene/camera'

/**
 * Scrub against the top of the document.
 *
 * `useScrollScene` measures a tall section it owns. This measures the
 * page itself, for a surface whose opening is simply the first screens
 * of it and whose subject is held by a sticky element rather than by a
 * stage of its own.
 */
export function useTopScrub(
  onFrame: (progress: number) => void,
  screens: number,
  enabled = true,
): void {
  const frameRef = useRef(onFrame)
  useEffect(() => {
    frameRef.current = onFrame
  })

  useEffect(() => {
    if (!enabled) return

    const measure = () => {
      const travel = Math.max(1, window.innerHeight * screens)
      frameRef.current(clamp01(window.scrollY / travel))
    }

    measure()
    window.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  }, [enabled, screens])
}
