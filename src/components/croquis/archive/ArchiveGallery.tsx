import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { useCoarsePointer, usePrefersReducedMotion } from '@/hooks/useMediaPreference'
import { formatDate } from '@/lib/images'
import { cn } from '@/lib/utils'

/**
 * The archive as a gallery.
 *
 * A sibling of AccordionGallery rather than a setting on it: that one
 * is a two-panel rail teasing the archive from home, this one is the
 * archive itself, and the differences — the open share holding steady
 * as the count grows, the window that slides over a long archive, the
 * tilt, the single-look case, the list a phone gets instead — are
 * enough that one component doing both would be a component made of
 * conditions.
 *
 * Motion is written to CSS custom properties from one rAF and the size
 * change is a CSS transition, the same way the analysis camera and the
 * entrance work, so travelling the archive never triggers a React
 * render. `active` is controlled by the page, which needs to know which
 * look its editing and deleting refer to.
 */

export interface ArchiveItem {
  readonly id: string
  readonly src: string
  readonly label: string
  /** ISO date the look was worn. */
  readonly wornAt: string
  readonly hasAnalysis: boolean
  /**
   * What the reading found, as the archive already stores it. Empty
   * when there is no reading, or when the reading did not name one —
   * never filled in with a guess.
   */
  readonly styleDna: readonly string[]
  readonly trend: string | null
  /**
   * The photograph's own proportions, so the plate's box is reserved
   * before the image arrives. A look that pushes the caption down as
   * it decodes is a look that moved while you were reading it.
   */
  readonly imageWidth: number
  readonly imageHeight: number
}

/**
 * What the reading found, in one line, or what is still missing.
 *
 * Reads from the summary the archive already holds. Nothing here is
 * composed: if the reading named no influence and no trend, the line
 * does not appear.
 */
function PlateReading({ item }: { item: ArchiveItem }) {
  if (!item.hasAnalysis) {
    return <span className="u-meta-sm u-plate-meta mt-2 block">Sin analizar</span>
  }
  const read = [...item.styleDna.slice(0, 2), ...(item.trend ? [item.trend] : [])]
  if (read.length === 0) return null
  return (
    <span className="u-meta-sm mt-2 block text-inference">{read.join(' · ')}</span>
  )
}

/** The look's own act. The plate is the control; this is its face. */
function PlateAction() {
  return (
    <span className="u-meta-sm mt-4 inline-flex items-center gap-2.5 border-b border-bone/40 pb-1 text-bone transition-colors duration-(--duration-default) group-hover:border-bone">
      Ver análisis
      <span
        aria-hidden
        className="inline-block transition-transform duration-(--duration-default) ease-(--ease-settle) group-hover:translate-x-1"
      >
        →
      </span>
    </span>
  )
}

/**
  * Share of the rail the open panel holds, before the look's own shape
  * is taken into account. See `shareFor`.
  */
const EXPAND_RATIO = 0.55
/** The narrowest and widest share an open look may hold. */
const MIN_SHARE = 0.4
const MAX_SHARE = 0.62
/** Width one look keeps when it is the only one. Not the whole rail. */
const SOLO_SHARE = '48%'
/**
 * Below this a closed panel stops reading as a photograph.
 *
 * A whole look shown whole needs width: fit a standing figure into a
 * 76px strip and what is left is a stamp. The rail is therefore cut
 * into fewer and wider panels than it would be if the photographs were
 * allowed to be cropped to fill them.
 */
const MIN_STRIP = 160
/** Most panels worth cutting the rail into; the rest arrive by arrow. */
const MAX_PANELS = 6
/** Tilt of a closed panel, degrees. Enough to lean, not to swing. */
const TILT = 4
/**
 * Room around the plate, in px. The parallax moves inside it, so a
 * pointer never pushes a shoulder or a hem past the panel edge.
 */
const MARGIN = 24
/**
 * The band the caption sits on, reserved so it sits on ground.
 *
 * Every panel reserves it, open or not: it costs a closed plate
 * nothing — those are limited by their strip's width long before this
 * height binds — and it puts every look in the rail on one optical
 * line instead of letting the open one ride higher than its
 * neighbours.
 */
const CAPTION_BAND = 150

/**
 * `power3.out`, as CSS. The reference for this interaction is written
 * against GSAP, and this is the same curve without the library: the
 * size change is a layout transition, so handing it to a timeline
 * would mean recalculating layout on every frame instead of once.
 */
const EASE = 'cubic-bezier(0.25, 1, 0.5, 1)'
const DURATION = '700ms'

/**
 * How much of the rail the open look asks for, given its own shape.
 *
 * A standing figure is bounded by the panel's height, so every pixel
 * of width past what that height needs is ground, not photograph — a
 * portrait given a landscape's share sits in the middle of an empty
 * panel. A landscape is bounded by width and wants all of it.
 *
 * So the share is read off the photograph rather than fixed: the plate
 * keeps its own proportions either way, and the rail stops reserving
 * room nothing is going to stand in. Clamped, because the open look
 * still has to read as the open one next to its neighbours.
 */
function shareFor(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return EXPAND_RATIO
  return Math.min(MAX_SHARE, Math.max(MIN_SHARE, 0.34 + ratio * 0.17))
}

/**
 * The open panel's flex-grow, so its share of the rail stays put as the
 * archive fills. A fixed grow would shrink the protagonist with every
 * look added: share = grow / (grow + n - 1).
 */
function growFor(count: number, share: number): number {
  if (count <= 1) return 1
  return (share / (1 - share)) * (count - 1)
}

export function ArchiveGallery({
  items,
  activeId,
  onActiveChange,
  onOpen,
  renderActions,
}: {
  items: readonly ArchiveItem[]
  activeId: string | null
  onActiveChange: (id: string) => void
  onOpen: (id: string) => void
  /**
   * Managing a look — renaming it, deleting it — never goes on the
   * photograph. The gallery decides where those controls sit, because
   * only it knows whether there is one open look or a list of them;
   * the page decides what they are.
   */
  readonly renderActions?: (item: ArchiveItem) => React.ReactNode
}) {
  const reduced = usePrefersReducedMotion()
  /* Touch and narrow windows get the list, not a rail squeezed into a
     phone. 768px is where a closed strip stops being a photograph. */
  const compact = useCoarsePointer(768)

  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.id === activeId),
  )

  if (items.length === 0) return null
  if (compact) {
    return <ArchiveList items={items} onOpen={onOpen} reduced={reduced} actions={renderActions} />
  }
  return (
    <ArchiveRail
      items={items}
      activeIndex={activeIndex}
      onActiveChange={onActiveChange}
      onOpen={onOpen}
      reduced={reduced}
      actions={renderActions}
    />
  )
}

/* ── the rail ────────────────────────────────────────────────────── */

function ArchiveRail({
  items,
  activeIndex,
  onActiveChange,
  onOpen,
  reduced,
  actions,
}: {
  items: readonly ArchiveItem[]
  activeIndex: number
  onActiveChange: (id: string) => void
  onOpen: (id: string) => void
  reduced: boolean
  actions?: (item: ArchiveItem) => React.ReactNode
}) {
  const railRef = useRef<HTMLUListElement | null>(null)
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([])

  /* Pointer parallax, coalesced into one frame and written as custom
     properties. A pointer move must not cost a render. */
  useEffect(() => {
    const rail = railRef.current
    if (!rail || reduced) return

    let frame = 0
    let pending: { x: number; y: number } | null = null

    const write = () => {
      frame = 0
      if (!pending) return
      rail.style.setProperty('--pointer-x', pending.x.toFixed(4))
      rail.style.setProperty('--pointer-y', pending.y.toFixed(4))
    }

    const onMove = (event: PointerEvent) => {
      const box = rail.getBoundingClientRect()
      if (box.width === 0 || box.height === 0) return
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
  }, [reduced])

  /* How many panels this rail can be cut into, measured from its own
     box rather than guessed from a breakpoint. */
  const [capacity, setCapacity] = useState(MAX_PANELS)
  useLayoutEffect(() => {
    const rail = railRef.current
    if (!rail) return
    const measure = () => {
      const across = rail.clientWidth
      if (across === 0) return
      // With the open panel holding EXPAND_RATIO, each closed one gets
      // (1 - ratio) / (n - 1) of the rail. Solve for the smallest strip
      // still worth showing.
      const fits = Math.floor(1 + (across * (1 - EXPAND_RATIO)) / MIN_STRIP)
      // eslint-disable-next-line react/set-state-in-effect
      setCapacity((was) => {
        const next = Math.max(1, Math.min(MAX_PANELS, fits))
        return was === next ? was : next
      })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(rail)
    return () => observer.disconnect()
  }, [])

  /* A long archive is not truncated: the rail is a window over it that
     slides to keep the open look inside, and the arrows walk the whole
     list. Nothing becomes unreachable for being the tenth look. */
  const start = useMemo(() => {
    if (items.length <= capacity) return 0
    const half = Math.floor((capacity - 1) / 2)
    return Math.max(0, Math.min(items.length - capacity, activeIndex - half))
  }, [items.length, capacity, activeIndex])

  const visible = items.slice(start, start + capacity)
  const solo = items.length === 1
  const open = items[activeIndex]
  const grow = growFor(
    visible.length,
    shareFor(open && open.imageHeight > 0 ? open.imageWidth / open.imageHeight : 0),
  )

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const last = items.length - 1
      const to =
        event.key === 'ArrowRight' || event.key === 'ArrowDown'
          ? Math.min(last, activeIndex + 1)
          : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
            ? Math.max(0, activeIndex - 1)
            : event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? last
                : -1
      const next = items[to]
      if (to < 0 || !next) return
      event.preventDefault()
      onActiveChange(next.id)
    },
    [items, activeIndex, onActiveChange],
  )

  /* The arrows move the open look, and the focus has to follow it or
     Enter would act on something other than what the rail is showing.
     Only while the rail already holds the focus: moving it otherwise
     would yank the page around under a reader who is elsewhere. */
  useEffect(() => {
    const rail = railRef.current
    if (!rail || !rail.contains(document.activeElement)) return
    buttonsRef.current[activeIndex - start]?.focus()
  }, [activeIndex, start])

  return (
    <>
    <ul
      ref={railRef}
      className={cn('flex w-full overflow-hidden', solo && 'justify-center')}
      style={
        {
          '--pointer-x': 0,
          '--pointer-y': 0,
          gap: solo ? 0 : '10px',
          // Portrait is the shape a look arrives in, and shown whole it
          // is the rail's height that decides how big it gets.
          height: 'clamp(440px, 72vh, 820px)',
          // The vanishing point the closed panels lean towards. Without
          // it on the rail, a per-panel rotateY projects flat.
          perspective: reduced ? undefined : '2200px',
          perspectiveOrigin: '50% 45%',
        } as React.CSSProperties
      }
    >
      {visible.map((item, offset) => {
        const index = start + offset
        const isActive = index === activeIndex
        // Closed panels lean away from the open one, so the rail reads
        // as pages either side of the one being looked at.
        const lean = isActive ? 0 : index < activeIndex ? TILT : -TILT

        return (
          <li
            key={item.id}
            className="relative min-w-0 overflow-hidden bg-studio-700"
            style={{
              flexGrow: solo ? 0 : isActive ? grow : 1,
              flexBasis: solo ? SOLO_SHARE : 0,
              transition: reduced ? undefined : `flex-grow ${DURATION} ${EASE}`,
            }}
          >
            <button
              type="button"
              ref={(node) => {
                buttonsRef.current[offset] = node
              }}
              // One tab stop for the whole rail; the arrows move inside.
              tabIndex={isActive ? 0 : -1}
              aria-current={isActive ? 'true' : undefined}
              aria-label={
                isActive ? `Abrir el análisis de ${item.label}` : `Ver ${item.label} en el archivo`
              }
              // Opening is a second, deliberate act: the first click on
              // a closed look only opens the panel, so a pointer landing
              // mid-transition cannot navigate by accident.
              onClick={() => (isActive ? onOpen(item.id) : onActiveChange(item.id))}
              onKeyDown={onKeyDown}
              onMouseEnter={() => onActiveChange(item.id)}
              // Keyboard focus expands, as any other way in does. Guarded
              // on :focus-visible because a click focuses before it
              // clicks, and an unguarded onFocus would count the panel as
              // already open by the time the click ran.
              onFocus={(event) => {
                if (event.target.matches(':focus-visible')) onActiveChange(item.id)
              }}
              className="group block size-full cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-bone"
            >
              {/* The look is a plate on the ground, not a fill for the
                  panel: it keeps its own proportions and is centred in
                  whatever room the rail gives it, so a standing figure
                  arrives whole — head, hem and shoes — whichever shape
                  the photograph was taken in. The panel is sized by the
                  rail; the photograph is never sized by the panel.

                  Nothing is scaled up either. Under overflow-hidden a
                  scale is a crop by another name. */}
              <span
                // Flex, not grid: a grid row is sized by its own item, so
                // the plate's max-height would resolve against a track the
                // plate itself defines and cap nothing. A flex line has
                // the definite height this box already has.
                // Aligned to the foot of the plate area, so every look
                // in the rail stands on the same line — the one the
                // caption band already draws — instead of each one
                // floating at the middle of its own strip.
                className="absolute inset-0 flex items-end justify-center"
                style={{
                  padding: `${MARGIN}px ${MARGIN}px ${CAPTION_BAND}px`,
                  // Panel size and tilt identify the active look; its
                  // neighbours retain the actual colours of the garments.
                  transform: reduced
                    ? undefined
                    : isActive
                      ? `translate3d(calc(var(--pointer-x) * -10px), calc(var(--pointer-y) * -7px), 0)`
                      : `rotateY(${lean}deg)`,
                  transformOrigin: index < activeIndex ? 'right center' : 'left center',
                  transition: reduced
                    ? undefined
                    : `filter ${DURATION} ${EASE}, transform ${DURATION} ${EASE}`,
                }}
              >
                <img
                  src={item.src}
                  alt={`Look: ${item.label}`}
                  width={item.imageWidth || undefined}
                  height={item.imageHeight || undefined}
                  decoding="async"
                  loading="lazy"
                  draggable={false}
                  className="h-auto max-h-full w-auto max-w-full select-none"
                />
              </span>

              <Caption
                index={index}
                item={item}
                visible={isActive}
                reduced={reduced}
                solo={solo}
              />
            </button>
          </li>
        )
      })}
    </ul>
    {/* The rail is a window over the archive, and until now the only
        thing that said so was the arrow keys. A pointer got four
        photographs and no reason to think there were nine. Shown only
        when something is actually off the rail: with everything in
        view there is nothing to walk to. */}
    {items.length > visible.length ? (
      <nav aria-label="Recorrer el archivo" className="mt-6 flex items-center gap-5">
        <RailStep
          label="Look anterior"
          disabled={activeIndex === 0}
          onClick={() => {
            const previous = items[activeIndex - 1]
            if (previous) onActiveChange(previous.id)
          }}
        >
          ←
        </RailStep>
        <p className="u-num text-bone-mute" aria-live="polite">
          {String(activeIndex + 1).padStart(2, '0')}
          <span className="mx-2 text-bone-mute">/</span>
          {String(items.length).padStart(2, '0')}
        </p>
        <RailStep
          label="Look siguiente"
          disabled={activeIndex === items.length - 1}
          onClick={() => {
            const next = items[activeIndex + 1]
            if (next) onActiveChange(next.id)
          }}
        >
          →
        </RailStep>
      </nav>
    ) : null}
    {actions && open ? <div className="mt-5">{actions(open)}</div> : null}
    </>
  )
}

/** One step along the rail. A rule under a mark, like everything else. */
function RailStep({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode
  label: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="u-act-quiet min-h-11 w-11 px-0 disabled:border-studio-700 disabled:text-bone-mute/45 disabled:hover:border-studio-700 disabled:hover:text-bone-mute/45"
    >
      {children}
    </button>
  )
}

/* ── what the open look says ─────────────────────────────────────── */

function Caption({
  index,
  item,
  visible,
  reduced,
  solo,
}: {
  index: number
  item: ArchiveItem
  visible: boolean
  reduced: boolean
  solo: boolean
}) {
  return (
    <>
      {/* Ground for the metadata, only where the metadata sits. The
          photograph is never darkened and, now that the plate stops
          above this band, never covered either — the gradient is what
          carries a landscape look whose lower edge comes close. */}
      <span
        aria-hidden
        className="u-plate-scrim"
        style={{
          opacity: visible ? 1 : 0,
          transition: reduced ? undefined : `opacity ${DURATION} ${EASE}`,
        }}
      />

      <span
        className={cn(
          'absolute inset-x-0 bottom-0 block px-5 pb-5',
          solo && 'px-7 pb-7',
        )}
        style={{
          opacity: visible ? 1 : 0,
          transition: reduced ? undefined : `opacity ${DURATION} ${EASE}`,
        }}
      >
        <span className="u-num block text-bone-mute">{String(index + 1).padStart(2, '0')}</span>
        <span className="mt-1.5 block u-d3 u-plate-text">
          {item.label}
        </span>
        <span className="u-label u-plate-meta mt-2.5 block">{formatDate(item.wornAt)}</span>
        <PlateReading item={item} />
        <PlateAction />
      </span>
    </>
  )
}

/* ── the phone gets a magazine, not a squeezed rail ──────────────── */

function ArchiveList({
  items,
  onOpen,
  reduced,
  actions,
}: {
  items: readonly ArchiveItem[]
  onOpen: (id: string) => void
  reduced: boolean
  actions?: (item: ArchiveItem) => React.ReactNode
}) {
  return (
    <ul className="flex flex-col gap-12">
      {items.map((item, index) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onOpen(item.id)}
            aria-label={`Abrir el análisis de ${item.label}`}
            className="group block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bone"
          >
            {/* The block is as tall as the look is, not the other way
                round: no fixed ratio, so a standing figure, a half
                length and a landscape frame all arrive whole. Capped
                by the viewport so the next look is still visible
                underneath, and padded at the foot so the caption has
                ground of its own instead of sitting on the shoes. */}
            <span className="relative block bg-studio-700 pb-[124px]">
              <img
                src={item.src}
                alt={`Look: ${item.label}`}
                width={item.imageWidth || undefined}
                height={item.imageHeight || undefined}
                decoding="async"
                loading="lazy"
                className={cn(
                  'mx-auto block h-auto max-h-[64dvh] w-auto max-w-full',
                  !reduced &&
                    'transition-transform duration-(--duration-slow) ease-(--ease-settle) group-hover:-translate-y-1',
                )}
              />
              <span
                aria-hidden
                className="u-plate-scrim"
              />
              <span className="absolute inset-x-0 bottom-0 block px-5 pb-5">
                <span className="u-num block text-bone-mute">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="mt-1.5 block u-d3 u-plate-text">
                  {item.label}
                </span>
                <span className="u-label u-plate-meta mt-2 block">{formatDate(item.wornAt)}</span>
                <PlateReading item={item} />
              </span>
            </span>
            <PlateAction />
          </button>
          {actions ? <div className="mt-2">{actions(item)}</div> : null}
        </li>
      ))}
    </ul>
  )
}
