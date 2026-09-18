import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { useCoarsePointer, usePrefersReducedMotion } from '@/hooks/useMediaPreference'
import { formatDate } from '@/lib/images'
import { cn } from '@/lib/utils'

/**
 * The archive as an accordion of plates.
 *
 * One panel is active and takes most of the width; the rest hold a
 * narrow strip, retaining its original colour and brightness. The panel
 * is a photograph on a rail, not a card: no radius, no shadow stack,
 * no overlay tint.
 *
 * Motion is written to CSS custom properties from one rAF, the same
 * way the analysis camera and the entrance work, so a pointer move
 * never triggers a React render. Under reduced motion the parallax and
 * tilt are not registered at all and the widths snap.
 */

export interface GalleryItem {
  readonly id: string
  readonly src: string
  readonly label: string
  readonly analysedAt: string | null
  readonly styleDna: readonly string[]
  readonly trend: string | null
}

type Orientation = 'horizontal' | 'vertical'

/**
 * What the rail is made of, per orientation.
 *
 * `grow` is the share the open panel takes against one apiece for the
 * rest; `minStrip` is the thickness below which a closed panel stops
 * being a photograph, and `max` the most panels the shape is worth
 * cutting into.
 *
 * Standing up, a closed panel is as tall as the rail and reads as a
 * plate on very little width, so the rail holds a row of them. Lying
 * down it is as wide as the rail: the same proportions flatten it into
 * a letterbox band. Upright the rail therefore holds two, near enough
 * to even that both are a whole look — the one you are on, and the one
 * you are going to.
 */
const RAIL = {
  // A closed panel is a look you are being offered, so it has to stay
  // a photograph: at 54px a whole standing figure came out a stamp
  // floating in a dark column, and seven of them turned the rail into
  // texture. Fewer, wider, and each one still readable as a look.
  horizontal: { grow: 4.5, minStrip: 110, max: 5 },
  vertical: { grow: 1.7, minStrip: 150, max: 2 },
} as const satisfies Record<Orientation, { grow: number; minStrip: number; max: number }>

/** Panels beyond this are dropped from the rail rather than slivered. */
const MAX_PANELS = 7
/**
 * Room around the plate and the band its caption sits on, in px.
 *
 * Same rule as the archive: the photograph is a plate on the ground,
 * kept whole, and the metadata has ground of its own rather than
 * lying across the hem of the look it names.
 */
const MARGIN = 16
const CAPTION_BAND = 116

function metadataOf(item: GalleryItem): string[] {
  const parts: string[] = []
  if (item.analysedAt) parts.push(formatDate(item.analysedAt.slice(0, 10)))
  // Style DNA and trend only exist once a garment-aware reading does.
  if (item.styleDna.length > 0) parts.push(item.styleDna.slice(0, 2).join(' / '))
  if (item.trend) parts.push(item.trend)
  return parts
}

export function AccordionGallery({
  items,
  onOpen,
  onVisible,
}: {
  items: readonly GalleryItem[]
  onOpen: (id: string) => void
  /**
   * How many panels the rail ended up holding. Only the rail knows —
   * the count comes out of its own box — and a page that says anything
   * about the ones left over needs to hear it from here.
   */
  onVisible?: (count: number) => void
}) {
  const railRef = useRef<HTMLUListElement | null>(null)
  const [active, setActive] = useState(0)
  const reduced = usePrefersReducedMotion()
  const coarse = useCoarsePointer()

  const shown = useMemo(() => items.slice(0, MAX_PANELS), [items])
  const safeActive = Math.min(active, Math.max(0, shown.length - 1))

  /* Pointer parallax and tilt, coalesced into one frame. */
  useEffect(() => {
    const rail = railRef.current
    if (!rail || reduced || coarse) return

    let frame = 0
    let pending: { x: number; y: number } | null = null

    const write = () => {
      frame = 0
      if (!pending) return
      const { x, y } = pending
      rail.style.setProperty('--pointer-x', x.toFixed(4))
      rail.style.setProperty('--pointer-y', y.toFixed(4))
    }

    const onMove = (event: PointerEvent) => {
      const box = rail.getBoundingClientRect()
      pending = {
        x: (event.clientX - box.left) / box.width - 0.5,
        y: (event.clientY - box.top) / box.height - 0.5,
      }
      if (!frame) frame = requestAnimationFrame(write)
    }

    const onLeave = () => {
      pending = { x: 0, y: 0 }
      if (!frame) frame = requestAnimationFrame(write)
    }

    rail.addEventListener('pointermove', onMove)
    rail.addEventListener('pointerleave', onLeave)
    return () => {
      rail.removeEventListener('pointermove', onMove)
      rail.removeEventListener('pointerleave', onLeave)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [reduced, coarse])

  /* Which way the rail runs, and how many panels it can hold.

     Both come from the same measurement. The accordion opens along the
     rail's longer side — a box taller than it is wide stacks, and the
     same box in landscape lays the panels down — so a phone turned on
     its side gets plates rather than letterbox bands.

     The open panel takes `grow` shares and each of the rest one, so
     with n panels a strip is along / (grow + n - 1). Solving that for
     the smallest strip still worth showing gives the count: two on a
     phone held upright, which is what keeps the open look a whole
     photograph and the next one under it a whole photograph too. */
  const [layout, setLayout] = useState<{ orientation: Orientation; capacity: number }>({
    orientation: 'horizontal',
    capacity: MAX_PANELS,
  })
  useLayoutEffect(() => {
    const rail = railRef.current
    if (!rail) return
    const measure = () => {
      const { clientWidth: across, clientHeight: down } = rail
      if (across === 0 || down === 0) return
      const orientation: Orientation = down > across ? 'vertical' : 'horizontal'
      const { grow, minStrip, max } = RAIL[orientation]
      const along = orientation === 'vertical' ? down : across
      const fits = Math.floor(along / minStrip - grow + 1)
      const capacity = Math.max(1, Math.min(max, fits))
      // The rail's own size, read from layout: an external measurement,
      // and taken before the first paint so the count is never wrong on
      // screen and then corrected.
      // eslint-disable-next-line react/set-state-in-effect
      setLayout((was) =>
        was.orientation === orientation && was.capacity === capacity
          ? was
          : { orientation, capacity },
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(rail)
    return () => observer.disconnect()
  }, [])

  const { orientation } = layout
  const visible = shown.slice(0, layout.capacity)

  /* Reported before the paint, along with the measurement it comes
     from, so anything the page says about what did not fit is already
     right on the first frame instead of arriving a beat later and
     moving the line it sits on. */
  useLayoutEffect(() => {
    onVisible?.(visible.length)
  }, [onVisible, visible.length])

  /* Roving focus: the arrows move the focus and the open panel
     together. Moving one without the other would leave the keyboard on
     a panel that is no longer the open one, so Enter would act on
     something other than what the rail is showing. Tab enters at the
     open panel, which is the only one in the tab order, so arriving by
     keyboard never has to change what is open. */
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([])

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const last = visible.length - 1
      const from = buttonsRef.current.indexOf(event.currentTarget as HTMLButtonElement)
      const to =
        event.key === 'ArrowRight' || event.key === 'ArrowDown'
          ? Math.min(last, from + 1)
          : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
            ? Math.max(0, from - 1)
            : event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? last
                : -1
      if (to < 0 || from < 0) return
      event.preventDefault()
      setActive(to)
      buttonsRef.current[to]?.focus()
    },
    [visible.length],
  )

  if (visible.length === 0) return null

  return (
    <ul
      ref={railRef}
      className={cn(
        'flex h-full w-full gap-[3px] overflow-hidden',
        orientation === 'vertical' && 'flex-col',
      )}
      style={{ '--pointer-x': 0, '--pointer-y': 0 } as React.CSSProperties}
    >
      {visible.map((item, index) => {
        const isActive = index === safeActive
        const meta = metadataOf(item)
        return (
          <li
            key={item.id}
            className={cn(
              'relative min-w-0 overflow-hidden bg-studio-700',
              !reduced && 'transition-[flex-grow] duration-(--duration-slow) ease-(--ease-settle)',
            )}
            style={{ flexGrow: isActive ? RAIL[orientation].grow : 1, flexBasis: 0 }}
          >
            <button
              type="button"
              ref={(node) => {
                buttonsRef.current[index] = node
              }}
              // One stop for the whole rail; the arrows move within it.
              tabIndex={isActive ? 0 : -1}
              aria-current={isActive ? 'true' : undefined}
              aria-label={
                isActive ? `Abrir el análisis de ${item.label}` : `Ver ${item.label} en el archivo`
              }
              // Opening is a second, deliberate act. Focus does not do
              // it: a click focuses before it clicks, so a panel that
              // opened on focus would already count as open by the time
              // the click ran, and the first tap on a closed look —
              // every tap, on a screen with no hover — would leave the
              // rail for the analysis.
              onClick={() => (isActive ? onOpen(item.id) : setActive(index))}
              onKeyDown={onKeyDown}
              onMouseEnter={() => !coarse && setActive(index)}
              className="group block size-full cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-bone"
            >
              {/* Centred and whole, never filled to the panel. Under
                  overflow-hidden a scale is a crop by another name, so
                  the plate is not scaled up either — only the parallax
                  moves it, inside the margin it has. */}
              {/* Stood on the caption band, not centred in the column
                  above it. A narrow panel cannot make a whole figure
                  any wider, so a centred plate floats with dark above
                  and below it; on a common ground line the same plate
                  reads as a figure standing next to the others, and
                  the space above becomes the room the rail is meant to
                  have. */}
              <span
                className={cn(
                  'absolute inset-0 flex items-end justify-center',
                  !reduced &&
                    'transition-transform duration-(--duration-slow) ease-(--ease-settle)',
                )}
                style={{
                  padding: `${MARGIN}px ${MARGIN}px ${CAPTION_BAND}px`,
                  // Width carries selection; the photograph keeps its colour.
                  transform:
                    reduced || !isActive
                      ? undefined
                      : 'translate3d(calc(var(--pointer-x) * -9px), calc(var(--pointer-y) * -6px), 0)',
                }}
              >
                <img
                  src={item.src}
                  alt={`Look: ${item.label}`}
                  decoding="async"
                  loading="lazy"
                  draggable={false}
                  className="max-h-full w-auto select-none"
                />
              </span>

              {/* The ground the metadata sits on, only where it sits. */}
              <span
                aria-hidden
                className={cn(
                  'u-plate-scrim',
                  !reduced && 'transition-opacity duration-(--duration-slow)',
                )}
                style={{ opacity: isActive ? 1 : 0 }}
              />

              <span
                className={cn(
                  'absolute inset-x-0 bottom-0 block px-5 pb-5',
                  !reduced && 'transition-opacity duration-(--duration-default)',
                )}
                style={{ opacity: isActive ? 1 : 0 }}
              >
                <span className="u-num block text-bone-mute">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="mt-1 block u-d3 u-plate-text">
                  {item.label}
                </span>
                {meta.length > 0 ? (
                  <span className="u-label u-plate-meta mt-2 block">
                    {meta.join(' · ')}
                  </span>
                ) : null}
                <span className="u-meta-sm u-plate-meta mt-4 inline-flex items-center gap-2.5 transition-colors duration-(--duration-default) group-hover:text-bone">
                  Ver análisis
                  <span
                    aria-hidden
                    className="inline-block transition-transform duration-(--duration-default) ease-(--ease-settle) group-hover:translate-x-1"
                  >
                    →
                  </span>
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
