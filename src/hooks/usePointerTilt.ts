import { useCallback, useEffect, useRef } from 'react'

import { useCoarsePointer, usePrefersReducedMotion } from './useMediaPreference'

interface TiltOptions {
  /** Degrees of rotation at full deflection, before per-layer scaling. */
  readonly rotate?: number
  /** Pixels of translation at full deflection, before per-layer scaling. */
  readonly shift?: number
  /**
   * Viewing distance for the 3D context, in pixels. Without it on the
   * container, per-layer rotateX/rotateY project flat. Lower values are
   * a wider lens and a more aggressive perspective.
   */
  readonly perspective?: number
  readonly disabled?: boolean
}

const FOLLOW = 'transform 50ms linear'
const SETTLE = 'transform 600ms cubic-bezier(0.2, 0.8, 0.2, 1)'

export function usePointerTilt<T extends HTMLElement>(options: TiltOptions = {}) {
  const { rotate = 5, shift = 14, perspective = 1500, disabled = false } = options

  const containerRef = useRef<T | null>(null)
  const layersRef = useRef<HTMLElement[]>([])
  const pointerRef = useRef({ x: 0, y: 0 })
  const frameRef = useRef(0)

  const reduced = usePrefersReducedMotion()
  const coarse = useCoarsePointer()
  const off = disabled || reduced || coarse

  const paint = useCallback(() => {
    frameRef.current = 0
    const { x, y } = pointerRef.current
    for (const layer of layersRef.current) {
      const depth = Number(layer.dataset.tiltDepth ?? 1)
      const spin = Number(layer.dataset.tiltRotate ?? 0)
      const tx = (-x * shift * depth).toFixed(2)
      const ty = (-y * shift * depth).toFixed(2)
      const ry = (x * rotate * spin).toFixed(3)
      const rx = (-y * rotate * spin).toFixed(3)
      layer.style.transform = `translate3d(${tx}px, ${ty}px, 0) rotateY(${ry}deg) rotateX(${rx}deg)`
    }
  }, [rotate, shift])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Always clear inherited transforms when the effect is off, so a
    // change of preference mid-session cannot strand a layer askew.
    if (off) {
      container.style.perspective = ''
      container.style.perspectiveOrigin = ''
      container.style.transformStyle = ''
      for (const layer of container.querySelectorAll<HTMLElement>('[data-tilt-depth]')) {
        layer.style.transform = ''
        layer.style.transition = ''
        layer.style.willChange = ''
      }
      return
    }

    // The 3D context lives on the container so every layer shares one
    // vanishing point. Raised above centre for a standing figure.
    container.style.perspective = `${perspective}px`
    container.style.perspectiveOrigin = '50% 34%'
    container.style.transformStyle = 'preserve-3d'

    const cache = () => {
      layersRef.current = Array.from(
        container.querySelectorAll<HTMLElement>('[data-tilt-depth]'),
      )
    }

    const schedule = () => {
      if (frameRef.current === 0) frameRef.current = requestAnimationFrame(paint)
    }

    const onEnter = () => {
      cache()
      for (const layer of layersRef.current) {
        layer.style.transition = FOLLOW
        // Promoted only while the pointer is actually in the room.
        layer.style.willChange = 'transform'
      }
    }

    const onMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      pointerRef.current = {
        x: (event.clientX - rect.left) / rect.width - 0.5,
        y: (event.clientY - rect.top) / rect.height - 0.5,
      }
      schedule()
    }

    const onLeave = () => {
      pointerRef.current = { x: 0, y: 0 }
      for (const layer of layersRef.current) layer.style.transition = SETTLE
      schedule()
    }

    container.addEventListener('pointerenter', onEnter)
    container.addEventListener('pointermove', onMove)
    container.addEventListener('pointerleave', onLeave)

    return () => {
      container.removeEventListener('pointerenter', onEnter)
      container.removeEventListener('pointermove', onMove)
      container.removeEventListener('pointerleave', onLeave)
      if (frameRef.current !== 0) {
        cancelAnimationFrame(frameRef.current)
        frameRef.current = 0
      }
      container.style.perspective = ''
      container.style.perspectiveOrigin = ''
      container.style.transformStyle = ''
      for (const layer of layersRef.current) {
        layer.style.transform = ''
        layer.style.transition = ''
        layer.style.willChange = ''
      }
      layersRef.current = []
    }
  }, [off, paint, perspective])

  return containerRef
}
