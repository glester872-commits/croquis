import { AnalyzingIndicator } from '@/components/croquis/AnalyzingIndicator'
import { cn } from '@/lib/utils'

/**
 * The two things every stored surface can be doing instead of showing
 * itself: opening, or having failed to open.
 *
 * Both were written out by hand in four routes — «Abriendo tu
 * archivo…», «Abriendo tu armario…», and four literal copies of the
 * same three-line failure with its retry. Four copies drift, and they
 * had: some carried the route's heading, some replaced it; some got a
 * role, some did not.
 *
 * They are hung off the left edge at the reading measure rather than
 * centred, because a centred block of small text on an otherwise empty
 * page is the shape of an error dialog, and neither of these is one.
 */

/** Opening. Named, so it says WHICH thing is being opened. */
export function Opening({ what, className }: { what: string; className?: string }) {
  return (
    <div role="status" className={cn('u-read py-(--rhythm-section)', className)}>
      <AnalyzingIndicator label={`Abriendo ${what}`} />
    </div>
  )
}

/**
 * Failed to open. The message says what happened to the data, which is
 * the part a reader actually needs, and the retry is next to it rather
 * than at the other end of the screen.
 */
export function OpenFailed({
  message,
  onRetry,
  className,
}: {
  message: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div role="alert" className={cn('u-read py-(--rhythm-section)', className)}>
      <p className="u-meta mb-3 text-interpretation">No se ha podido abrir</p>
      <p className="text-[14px] leading-relaxed text-bone-dim">{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="u-meta u-act-word mt-5">
          Reintentar
        </button>
      ) : null}
    </div>
  )
}
