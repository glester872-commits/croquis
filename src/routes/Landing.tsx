import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { AccordionGallery, type GalleryItem } from '@/components/croquis/archive/AccordionGallery'
import { SiteHeader } from '@/components/croquis/SiteHeader'
import { Opening, OpenFailed } from "@/components/croquis/RouteState"
import { StudioRoom } from '@/components/croquis/StudioRoom'
import { FabricCurtain } from '@/components/croquis/immersive-outfit/FabricCurtain'
import { useOutfitIntake } from '@/components/croquis/outfit-uploader/useOutfitIntake'
import { useCurtainTransition } from '@/hooks/useCurtainTransition'
import { useCoarsePointer, usePrefersReducedMotion } from '@/hooks/useMediaPreference'
import { useObjectUrls } from '@/hooks/useObjectUrls'
import { useOutfits } from '@/hooks/useOutfits'
import { useScrollScene } from '@/hooks/useScrollScene'
import { introFor } from '@/lib/scene/intro'
import { setPendingLook } from '@/lib/pendingLook'
import type { OutfitSummary } from '@/lib/storage/outfit-repository'
import { cn } from '@/lib/utils'

/**
 * The home surface: the archive, behind the cloth.
 *
 * The entrance opens onto whatever the archive holds — the outfits
 * somebody has analysed, or the empty state if there are none. Asking
 * to add another does not navigate: the scene recedes, the cloth
 * closes over it, the content changes and the cloth opens again on the
 * uploader. The curtain is the boundary between the two states.
 */

/**
 * A fraction of a screen of extra scroll, not two whole screens.
 *
 * The entrance used to be a gatekeeper: at 300dvh/220dvh the archive
 * behind it was two full viewports of scrolling away, which is a toll,
 * not an identity. The cloth still opens on scroll — this only shortens
 * the travel it takes to do it, so the content it is guarding stays
 * reachable.
 */
const INTRO_HEIGHT = '130dvh'
const INTRO_HEIGHT_TOUCH = '110dvh'

/**
 * The entrance is identity, not a toll.
 *
 * It is worth walking through once — it is what says where you are —
 * and it is friction every time after that, so a session remembers it.
 * Session, not local: coming back tomorrow is a new arrival, moving
 * between screens for an hour is not. Storage can throw in a private
 * window, and there the entrance simply runs again: showing it twice
 * is a smaller failure than a home page that will not open.
 */
const SEEN_KEY = 'croquis:entrada-vista'

function entranceSeen(): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}

function rememberEntrance(): void {
  try {
    sessionStorage.setItem(SEEN_KEY, '1')
  } catch {
    /* nothing to do: the entrance runs again, and that is all */
  }
}

type View = 'archive' | 'uploader'

/* ── the entrance ────────────────────────────────────────────────── */

function Intro({ simple }: { simple: boolean }) {
  const stageRef = useRef<HTMLDivElement | null>(null)

  const onFrame = useCallback((p: number) => {
    const stage = stageRef.current
    if (!stage) return
    if (p >= 1) rememberEntrance()
    const intro = introFor(p)
    stage.style.setProperty('--open', intro.open.toFixed(4))
    stage.style.setProperty('--cloth', intro.cloth.toFixed(4))
    stage.style.setProperty('--lockup', intro.lockup.toFixed(4))
  }, [])

  const { sectionRef } = useScrollScene(onFrame)

  return (
    <div
      ref={sectionRef}
      className="relative"
      style={{ height: simple ? INTRO_HEIGHT_TOUCH : INTRO_HEIGHT }}
    >
      <div className="sticky top-0 h-dvh">
        <StudioRoom ref={stageRef} className="h-full">
          {/* Nothing behind the cloth here. The archive lives below,
              and no photograph exists until one is added. */}
          <FabricCurtain
            title="Croquis"
            tagline="Archivo de looks"
            simple={simple}
          />
        </StudioRoom>
      </div>
    </div>
  )
}

/* ── the archive ─────────────────────────────────────────────────── */

function EmptyArchive({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex h-full items-center px-5 sm:px-7">
      {/* Numbered, ruled, offset: the first-run screen reads as a plate
          rather than a centred dialog. The action sits off to the side,
          set down rather than stacked under the sentence it follows. */}
      <div className="u-plate-grid w-full">
        <div className="col-span-12 border-t border-studio-600 pt-5 sm:col-span-7">
          <span className="u-num text-bone-mute">00</span>
          <h1 className="u-statement u-read mt-3">Tu archivo está vacío.</h1>
        </div>
        <div className="col-span-12 mt-8 sm:col-span-4 sm:col-start-9 sm:mt-0 sm:self-end sm:pb-1">
          <button type="button" onClick={onStart} className="u-act w-full sm:w-auto">
            Añadir mi primer look
          </button>
        </div>
      </div>
    </div>
  )
}

function Archive({
  items,
  onOpen,
  onAdd,
}: {
  items: readonly GalleryItem[]
  onOpen: (id: string) => void
  onAdd: () => void
}) {
  /* Starts at everything: the rail reports its real count before the
     first paint, so the way in is never a link that appears and then
     takes itself back. */
  const [onRail, setOnRail] = useState(items.length)
  const hidden = items.length - onRail

  return (
    <div className="flex h-full flex-col px-5 pb-5 pt-4 sm:px-7 sm:pb-7">
      {/* One h1 per route: this is the list's name, so it takes the
          list register (u-title), not u-meta — a metadata size was
          never a heading. Baseline aligned bottom, since a D2 serif
          next to mono badges sets its foot below theirs. */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-studio-600 pb-4">
        <h1 className="u-title">Mis outfits</h1>
        <div className="flex items-center gap-5">
          <span className="u-meta-sm">
            {items.length} {items.length === 1 ? 'outfit' : 'outfits'}
          </span>
          {/* Only the rail knows how many fit in the space it was given,
              so it is the rail that says when some were left out. Say
              where the rest are instead of dropping them quietly. */}
          {hidden > 0 ? (
            <Link to="/outfits" className="u-meta-sm u-act-word text-bone-dim">
              Ver todos
            </Link>
          ) : null}
          <button
            type="button"
            onClick={onAdd}
            className="u-act-quiet px-4"
          >
            Añadir look
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <AccordionGallery items={items} onOpen={onOpen} onVisible={setOnRail} />
      </div>
    </div>
  )
}

/* ── the uploader ────────────────────────────────────────────────── */

function Uploader({
  isDragging,
  onBrowse,
  onBack,
  canGoBack,
  coarse,
}: {
  isDragging: boolean
  onBrowse: () => void
  onBack: () => void
  canGoBack: boolean
  /** A finger cannot drag a file onto a page, so it is not told to. */
  coarse: boolean
}) {
  return (
    // Was a centred panel with equal margins on all four sides and its
    // heading a column — roughly 500px — away in the fluid track next
    // to it. Now one asymmetric plate: the heading sits flush against
    // the target it names, and the target bleeds to the stage's right
    // edge instead of floating in the middle of it.
    <div className="flex h-full flex-col justify-center px-5 py-6 sm:px-7">
      <div className="u-plate-grid gap-y-8">
        <div className="col-span-12 md:col-span-4 md:col-start-1">
          <h2 className="u-statement">{coarse ? "Elige una fotografía." : "Arrastra aquí una fotografía."}</h2>
          <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-3">
            <button type="button" onClick={onBrowse} className="u-act">
              Subir look
            </button>
            {canGoBack ? (
              <button type="button" onClick={onBack} className="u-meta u-act-word">
                Volver al archivo
              </button>
            ) : null}
          </div>
          <p className="u-note mt-5">O pégala desde el portapapeles.</p>
        </div>

        <button
          type="button"
          onClick={onBrowse}
          className={cn(
            'group relative col-span-12 flex h-[min(48dvh,480px)] w-full cursor-pointer items-end justify-start px-6 pb-6 text-left transition-colors duration-(--duration-default) md:col-span-8 md:col-start-5',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bone',
            isDragging && 'bg-bone/[0.06]',
          )}
        >
          {/* Corner marks register the plate instead of a dashed
              rectangle: two opposite corners are enough to read as a
              frame without drawing the most generic upload pattern
              there is. */}
          <span
            aria-hidden
            className={cn(
              'pointer-events-none absolute left-3 top-3 size-3.5 border-l border-t transition-colors duration-(--duration-default)',
              isDragging ? 'border-bone' : 'border-studio-500 group-hover:border-bone-mute',
            )}
          />
          <span
            aria-hidden
            className={cn(
              'pointer-events-none absolute bottom-3 right-3 size-3.5 border-b border-r transition-colors duration-(--duration-default)',
              isDragging ? 'border-bone' : 'border-studio-500 group-hover:border-bone-mute',
            )}
          />
          <span className="u-meta-sm transition-colors duration-(--duration-fast) group-hover:text-bone">
            {isDragging ? "Suelta para añadirlo" : coarse ? "Toca para elegirla" : "Haz clic para elegirla"}
          </span>
        </button>
      </div>
    </div>
  )
}

/* ── the surface ─────────────────────────────────────────────────── */

/** One empty archive, so "still loading" is not a new list every render. */
const NO_OUTFITS: readonly OutfitSummary[] = []

export function Landing() {
  const navigate = useNavigate()
  const reduced = usePrefersReducedMotion()
  const coarse = useCoarsePointer()

  const archive = useOutfits()
  const outfits = archive.status === 'ready' ? archive.outfits : NO_OUTFITS

  const blobs = useMemo(
    () => outfits.map((outfit) => ({ id: outfit.id, blob: outfit.thumbnail })),
    [outfits],
  )
  const thumbnails = useObjectUrls(blobs)

  const items = useMemo<GalleryItem[]>(
    () =>
      outfits.flatMap((outfit) => {
        const src = thumbnails[outfit.id]
        if (!src) return []
        return [
          {
            id: outfit.id,
            src,
            label: outfit.name || 'Look sin título',
            analysedAt: outfit.analysedAt,
            styleDna: outfit.styleDna,
            trend: outfit.trend,
          },
        ]
      }),
    [outfits, thumbnails],
  )

  /* Decided once, as the surface is first built. Reading it during
     render would flip the page out from under the entrance the moment
     it finished writing that it had been seen. */
  const [showEntrance] = useState(() => !entranceSeen())

  const [view, setView] = useState<View>('archive')
  const { stageRef, covering, run } = useCurtainTransition(reduced)

  const onFile = useCallback(
    (file: File) => {
      setPendingLook(file)
      void navigate('/analizar')
    },
    [navigate],
  )
  const { isDragging, error, browse, inputRef, onInputChange } = useOutfitIntake(onFile)

  // Ctrl/Cmd+U opens the file picker directly, for anyone who knows
  // what they came here to do and does not want to click through the
  // curtain first.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'u' || !(event.metaKey || event.ctrlKey)) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable="true"]')) return
      event.preventDefault()
      browse()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [browse])

  const toUploader = useCallback(() => run(() => setView('uploader')), [run])
  const toArchive = useCallback(() => run(() => setView('archive')), [run])

  const hasOutfits = items.length > 0

  return (
    <>
      {/* Reduced motion gets the textile identity as a still. */}
      {reduced ? (
        <StudioRoom className="relative h-[34dvh] overflow-hidden">
          <div className="fabric-face absolute -inset-[14%]" />
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center">
              {/* Display type is one of three steps now, not a hand-tuned
                  clamp — u-statement is D1. And this sits on the cloth,
                  which stayed dark through the inversion: text-bone is
                  ink now and would vanish here exactly as it would on a
                  photograph, so it takes the plate tokens instead. */}
              <p
                className="u-statement u-plate-text"
                style={{ textShadow: '0 2px 30px rgba(16,16,16,0.85)' }}
              >
                Croquis
              </p>
              <p className="u-meta-sm u-plate-meta mt-5">
                Archivo de looks
              </p>
            </div>
          </div>
        </StudioRoom>
      ) : showEntrance ? (
        <Intro simple={coarse} />
      ) : null}

      <StudioRoom className="flex min-h-dvh flex-col">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={onInputChange}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
        />

        <SiteHeader />


        {/* The stage a change of state happens on. The cloth covers this
            box and nothing else, so the header and the page around it
            stay put while the archive becomes the uploader.

            It takes whatever the header and the footer leave, measured
            rather than assumed: the header is one line on a desktop and
            two on a phone, and a hard-coded height for it pushed the
            footer off the bottom of every narrow screen. */}
        <div
          ref={stageRef}
          className="relative z-10 min-h-[460px] flex-1 overflow-hidden"
        >
          {/* Pinned to the stage rather than asking for 100% of it: the
              stage's height now comes from the flex line it sits on, and
              a percentage height against that is indefinite — the rail
              collapsed to nothing and the archive disappeared.
              The uploader stays in flow so its stacked content can
              grow beyond the stage on short and narrow screens. */}
          <main
            className={view === 'uploader' ? 'relative min-h-full' : 'absolute inset-0'}
            style={{
              transform: 'scale(calc(1 - var(--recede, 0) * 0.06))',
              opacity: 'calc(1 - var(--recede, 0) * 0.55)',
              transformOrigin: '50% 45%',
            }}
          >
            {view === 'uploader' ? (
              <Uploader
                isDragging={isDragging}
                onBrowse={browse}
                onBack={toArchive}
                canGoBack={hasOutfits}
                coarse={coarse}
              />
            ) : archive.status === "loading" ? (
              <div className="flex h-full items-center px-5 sm:px-7">
                <Opening what="tu archivo" className="py-0" />
              </div>
            ) : archive.status === "error" ? (
              <div className="flex h-full items-center px-5 sm:px-7">
                <OpenFailed message={archive.message} onRetry={archive.reload} className="py-0" />
              </div>
            ) : hasOutfits ? (
              <Archive
                items={items}
                onOpen={(id) => void navigate(`/analisis/${id}`)}
                onAdd={toUploader}
              />
            ) : (
              <EmptyArchive onStart={toUploader} />
            )}
          </main>

          {covering ? <FabricCurtain title="Croquis" tagline="" simple={coarse} bare /> : null}
        </div>

        <div
          aria-hidden
          className={cn(
            'pointer-events-none fixed inset-0 z-30 border-2 transition-opacity duration-(--duration-default) ease-(--ease-out-soft)',
            isDragging ? 'border-bone opacity-100' : 'border-transparent opacity-0',
          )}
        >
          <span className="u-meta absolute left-1/2 top-8 -translate-x-1/2 bg-studio-900 px-3 py-2 text-bone">
            Suelta para añadir este look
          </span>
        </div>

        <div role="status" aria-live="polite" className="sr-only">
          {isDragging ? 'Imagen lista para soltar' : ''}
        </div>
        {error ? (
          <p
            role="alert"
            className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 border border-interpretation bg-studio-900 px-4 py-2.5 text-[12px] text-interpretation"
          >
            {error}
          </p>
        ) : null}
      </StudioRoom>
    </>
  )
}
