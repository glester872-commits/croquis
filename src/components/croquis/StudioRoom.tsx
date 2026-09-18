import type { ReactNode, Ref } from 'react'

import { cn } from '@/lib/utils'

/**
 * The shared surface every screen sits on.
 *
 * It used to be a room: warm graphite lit from behind the subject, so
 * darkness would read as depth. On the evidence it did not — an empty
 * archive rendered as a black rectangle with a small object in it, and
 * a viewer reads that as a failed load, not as a room.
 *
 * It is a light table now. The falloff is vertical and almost nothing
 * — four per cent across the whole height — because a table is lit
 * from above and a print laid on it picks up that gradient at its
 * edges. Any more and the ground starts competing with the photograph,
 * which is the one thing on screen allowed to have a tone.
 *
 * `GhostWordmark` used to live here: a 290px wordmark at 4.5% opacity
 * behind every screen. It was the largest element on the empty home
 * and it explained nothing, which is what the governing principle
 * spends its whole sentence forbidding. It is gone.
 */
export function StudioRoom({
  children,
  className,
  ref,
  ...rest
}: {
  children: ReactNode
  className?: string
  ref?: Ref<HTMLDivElement>
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div ref={ref} className={cn('relative isolate overflow-hidden bg-studio-800', className)} {...rest}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'linear-gradient(to bottom, var(--color-studio-700) 0%, var(--color-studio-800) 38%, var(--color-studio-900) 100%)',
        }}
      />
      {children}
    </div>
  )
}
