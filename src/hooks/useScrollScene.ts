import { useCallback, useEffect, useRef } from 'react'

export interface ScrollScene {
  /** Goes on the tall section that provides the travel. */
  readonly sectionRef: React.RefObject<HTMLDivElement | null>
  /** Scroll to a given global progress, 0-1. */
  readonly seek: (progress: number, smooth?: boolean) => void
}

export function useScrollScene(onFrame: (progress: number) => void, enabled = true): ScrollScene {
  const sectionRef = useRef<HTMLDivElement | null>(null)

  // The callback closes over fresh data every render while the
  // listener is installed once. Written after commit, not during
  // render, so a discarded render cannot leave a stale callback.
  const frameRef = useRef(onFrame)
  useEffect(() => {
    frameRef.current = onFrame
  })

  /** Scrollable distance inside the section, i.e. what maps to 0-1. */
  const travelOf = (section: HTMLDivElement): number =>
    Math.max(1, section.offsetHeight - window.innerHeight)

  useEffect(() => {
    const section = sectionRef.current
    if (!section || !enabled) return

    // Written straight from the scroll event rather than deferred to
    // rAF: scroll already fires at most once per frame, and rAF adds a
    // frame of lag. It also keeps working where animation frames are
    // throttled but scroll events are still delivered.
    const measure = () => {
      const top = section.getBoundingClientRect().top
      const progress = -top / travelOf(section)
      frameRef.current(progress < 0 ? 0 : progress > 1 ? 1 : progress)
    }

    measure()
    window.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)

    return () => {
      window.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  }, [enabled])

  const seek = useCallback((progress: number, smooth = true) => {
    const section = sectionRef.current
    if (!section) return
    const start = section.getBoundingClientRect().top + window.scrollY
    window.scrollTo({
      top: start + travelOf(section) * progress,
      behavior: smooth ? 'smooth' : 'auto',
    })
  }, [])

  return { sectionRef, seek }
}
