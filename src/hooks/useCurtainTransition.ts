import { useCallback, useEffect, useRef, useState } from 'react'

import { introFor } from '@/lib/scene/intro'

/**
 * A change of state, staged behind the cloth.
 *
 * The scene recedes, the curtain draws back over it, what is behind it
 * changes, and the curtain opens again. The same custom properties the
 * scroll entrance writes are written here from a timeline, so the
 * cloth behaves identically whichever is driving it.
 *
 * Under reduced motion the swap happens immediately and nothing moves.
 */

/** Milliseconds. Together under the second and a half a change can take. */
const RECEDE = 220
const CLOSE = 320
const OPEN = 380

type Phase = 'idle' | 'receding' | 'closing' | 'opening'

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)

export interface CurtainTransition {
  /** Goes on the element the cloth and the receding content live in. */
  readonly stageRef: React.RefObject<HTMLDivElement | null>
  /** True while the cloth is on screen, so it can be mounted only then. */
  readonly covering: boolean
  /** Runs the change. `swap` is called at the moment the cloth covers. */
  readonly run: (swap: () => void) => void
}

export function useCurtainTransition(reduced: boolean): CurtainTransition {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const frameRef = useRef(0)
  const phaseRef = useRef<Phase>('idle')
  const [covering, setCovering] = useState(false)

  const write = useCallback((open: number, recede: number) => {
    const stage = stageRef.current
    if (!stage) return
    const intro = introFor(open)
    stage.style.setProperty('--open', intro.open.toFixed(4))
    stage.style.setProperty('--cloth', open >= 1 ? '0' : '1')
    stage.style.setProperty('--recede', recede.toFixed(4))
  }, [])

  useEffect(
    () => () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    },
    [],
  )

  const run = useCallback(
    (swap: () => void) => {
      if (phaseRef.current !== 'idle') return

      if (reduced) {
        swap()
        return
      }

      setCovering(true)
      const started = performance.now()
      phaseRef.current = 'receding'
      let swapped = false

      const step = (now: number) => {
        const elapsed = now - started

        if (elapsed < RECEDE) {
          write(1, easeInOut(elapsed / RECEDE))
        } else if (elapsed < RECEDE + CLOSE) {
          phaseRef.current = 'closing'
          write(1 - easeInOut((elapsed - RECEDE) / CLOSE), 1)
        } else if (elapsed < RECEDE + CLOSE + OPEN) {
          if (!swapped) {
            swapped = true
            swap()
          }
          phaseRef.current = 'opening'
          write(easeInOut((elapsed - RECEDE - CLOSE) / OPEN), 1 - easeInOut((elapsed - RECEDE - CLOSE) / OPEN))
        } else {
          if (!swapped) swap()
          write(1, 0)
          phaseRef.current = 'idle'
          frameRef.current = 0
          setCovering(false)
          return
        }

        frameRef.current = requestAnimationFrame(step)
      }

      frameRef.current = requestAnimationFrame(step)
    },
    [reduced, write],
  )

  return { stageRef, covering, run }
}
