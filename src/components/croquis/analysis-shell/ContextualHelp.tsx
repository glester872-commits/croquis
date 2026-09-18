import { useState, useRef, useLayoutEffect, useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

interface ContextualHelpProps {
  title: string
  description: string
  guaranteed?: boolean
}

/**
 * Portaled to <body> and positioned with fixed, viewport-relative
 * coordinates. The reading column and the sticky pinned photograph
 * sit in separate stacking contexts (the photograph's is the higher
 * one, so its scroll behaviour is never interrupted by what scrolls
 * under it) — a tooltip anchored inside the reading column would be
 * painted behind that photograph whenever it tried to float above
 * its trigger. Escaping to <body> sidesteps the whole question.
 */
export function ContextualHelp({ title, description, guaranteed = false }: ContextualHelpProps) {
  const tooltipId = useId()
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !tooltipRef.current) return

    const triggerRect = triggerRef.current.getBoundingClientRect()
    const tooltipRect = tooltipRef.current.getBoundingClientRect()
    const gap = 8
    const margin = 8

    const top =
      triggerRect.top < tooltipRect.height + gap + margin
        ? triggerRect.bottom + gap // no room above: open downward
        : triggerRect.top - tooltipRect.height - gap

    let left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2
    left = Math.max(margin, Math.min(left, window.innerWidth - tooltipRect.width - margin))

    setCoords({ top, left })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }
    // mousedown rather than click: fires before another trigger's own
    // click handler, so clicking straight from one help icon to
    // another closes this one and opens that one in a single click.
    const onOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || tooltipRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onOutsideClick)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onOutsideClick)
    }
  }, [open])

  // Re-measure on scroll/resize while open: fixed coordinates are
  // frozen at the moment they're set, but the trigger keeps moving
  // under a scrolling reading column.
  useEffect(() => {
    if (!open) return
    const onReflow = () => {
      if (!triggerRef.current || !tooltipRef.current) return
      const triggerRect = triggerRef.current.getBoundingClientRect()
      const tooltipRect = tooltipRef.current.getBoundingClientRect()
      const gap = 8
      const margin = 8
      const top =
        triggerRect.top < tooltipRect.height + gap + margin
          ? triggerRect.bottom + gap
          : triggerRect.top - tooltipRect.height - gap
      let left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2
      left = Math.max(margin, Math.min(left, window.innerWidth - tooltipRect.width - margin))
      setCoords({ top, left })
    }
    window.addEventListener('scroll', onReflow, { capture: true, passive: true })
    window.addEventListener('resize', onReflow)
    return () => {
      window.removeEventListener('scroll', onReflow, { capture: true })
      window.removeEventListener('resize', onReflow)
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'relative ml-1 inline-flex items-center justify-center size-5 rounded-full transition-colors duration-(--duration-fast)',
          // Hit-slop: the visible circle stays 20px so it sits quietly
          // next to the heading, but the tappable area grows to the
          // 44px the rest of the app's controls guarantee.
          'before:absolute before:-inset-[12px] before:content-[""]',
          'text-bone-mute hover:text-bone hover:bg-studio-600/50',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bone',
        )}
        aria-label={`Información sobre ${title}`}
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
      >
        <span className="text-[11px] font-bold">?</span>
      </button>

      {open &&
        createPortal(
          <div
            ref={tooltipRef}
            id={tooltipId}
            role="tooltip"
            className="fixed z-50 w-48 rounded border border-studio-600 bg-studio-900 p-3 text-[12px] leading-relaxed shadow-lg"
            style={{
              top: coords?.top ?? 0,
              left: coords?.left ?? 0,
              // Hidden until measured and placed, so it never flashes
              // at the (0, 0) fallback position for a frame.
              visibility: coords ? 'visible' : 'hidden',
            }}
          >
            <p className="font-semibold text-bone">{title}</p>
            <p className="mt-1 text-bone-dim">{description}</p>
            {guaranteed && (
              <p className="mt-2 flex items-center gap-1.5 rounded bg-inference/10 px-2 py-1.5 text-[11px] text-inference">
                <span>✓</span>
                <span>Garantizado de píxeles</span>
              </p>
            )}
          </div>,
          document.body,
        )}
    </>
  )
}
