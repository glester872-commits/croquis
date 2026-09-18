import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Opening } from "@/components/croquis/RouteState"
import { AskTrigger } from '@/components/croquis/ask/AskCroquis'
import { SiteHeader, SiteNav } from '@/components/croquis/SiteHeader'
import { StudioRoom } from '@/components/croquis/StudioRoom'
import {
  GarmentsPanel,
  MaterialPanel,
  ProportionsPanel,
  SilhouettePanel,
  StyleDnaPanel,
  TrendPanel,
  WhyPanel,
} from '@/components/croquis/analysis-shell/panels'
import { AtelierReveal } from '@/components/croquis/immersive-outfit/AtelierReveal'
import {
  OutfitPlate,
  type PlateMark,
  type PlateRule,
  type ProportionBracket,
} from '@/components/croquis/immersive-outfit/OutfitPlate'
import { useCoarsePointer, usePrefersReducedMotion } from '@/hooks/useMediaPreference'
import { useOutfitAnalysis } from '@/hooks/useOutfitAnalysis'
import { useScrollScene } from '@/hooks/useScrollScene'
import { useTopScrub } from '@/hooks/useTopScrub'
import {
  type ActId,
  FULL_STAGE,
  MAX_MACRO_SCALE,
  type SceneContent,
  type Stage,
  actIndexAt,
  actProgressAt,
  buildScene,
  cameraFor,
  clamp01,
  materialAt,
  progressForAct,
  progressForStep,
  stepAt,
} from '@/lib/scene/camera'
import { REVEAL_SCREENS, REVEAL_SCREENS_TOUCH, writeReveal } from '@/lib/scene/reveal'
import { cn } from '@/lib/utils'
import type { Garment, OutfitAnalysis, Region } from '@/types'

/** What the analysis has to show, which decides how long it runs. */
function sceneContentOf(analysis: OutfitAnalysis): SceneContent {
  return {
    palette: analysis.palette !== null,
    silhouette: analysis.silhouette !== null,
    garments: analysis.garments.length,
    materials: analysis.materials.length,
    styleDna: analysis.styleDna.length,
    trends: analysis.trendSignals.length,
  }
}

function unionRegion(regions: readonly Region[]): Region | null {
  if (regions.length === 0) return null
  let left = 1
  let top = 1
  let right = 0
  let bottom = 0
  for (const region of regions) {
    left = Math.min(left, region.x)
    top = Math.min(top, region.y)
    right = Math.max(right, region.x + region.width)
    bottom = Math.max(bottom, region.y + region.height)
  }
  return { x: left, y: top, width: right - left, height: bottom - top }
}

function garmentByLayer(analysis: OutfitAnalysis, ...layers: Garment['layer'][]): Garment | null {
  for (const layer of layers) {
    const found = analysis.garments.find((garment) => garment.layer === layer)
    if (found) return found
  }
  return null
}

function markFor(garment: Garment): PlateMark {
  return {
    id: garment.id,
    anchor: garment.anchor,
    label: garment.name,
    side: garment.anchor.x < 0.5 ? 'left' : 'right',
  }
}

/**
 * What is drawn on the photograph at each act.
 *
 * Every mark resolves to a Region or Anchor already in the data: the
 * silhouette is described by measures that can be justified — outer
 * layer width at the shoulder, lower layer width at the hip, the
 * vertical axis — rather than by a traced outline.
 */

interface Selection {
  readonly garmentId: string | null
  readonly materialId: string | null
  readonly influenceId: string | null
}

interface SceneView {
  readonly focus: Region | null
  readonly marks: readonly PlateMark[]
  readonly bracket: ProportionBracket | null
  readonly rules: readonly PlateRule[]
  readonly axis: number | null
}

const EMPTY_VIEW: SceneView = { focus: null, marks: [], bracket: null, rules: [], axis: null }

function sceneView(analysis: OutfitAnalysis, act: ActId, selection: Selection): SceneView {
  const figure =
    analysis.breakdown.find((section) => section.category === 'silhouette')?.region ?? null

  switch (act) {
    case 'silhouette': {
      const shoulders = garmentByLayer(analysis, 'outer', 'mid', 'base')
      const hips = garmentByLayer(analysis, 'lower')
      const rules: PlateRule[] = []
      if (shoulders) {
        rules.push({
          id: 'shoulder',
          y: shoulders.region.y + 0.015,
          x1: shoulders.region.x,
          x2: shoulders.region.x + shoulders.region.width,
          label: 'hombro',
        })
      }
      if (hips) {
        rules.push({
          id: 'hip',
          y: hips.region.y + 0.05,
          x1: hips.region.x,
          x2: hips.region.x + hips.region.width,
          label: 'volumen',
        })
      }
      return {
        ...EMPTY_VIEW,
        focus: figure,
        rules,
        axis: figure ? figure.x + figure.width / 2 : null,
      }
    }

    case 'proportions': {
      // No figure region and no silhouette means nothing was read, and
      // a bracket drawn over an unread photograph would be decoration
      // pretending to be measurement.
      if (!figure || !analysis.silhouette) return EMPTY_VIEW
      const [upper, lower] = analysis.silhouette.split
      const splitY = figure.y + figure.height * (upper / (upper + lower))
      return {
        ...EMPTY_VIEW,
        axis: figure.x + figure.width / 2,
        bracket: {
          top: figure.y,
          split: splitY,
          bottom: figure.y + figure.height,
          upperLabel: String(upper),
          lowerLabel: String(lower),
        },
      }
    }

    case 'garments': {
      const garment = analysis.garments.find((item) => item.id === selection.garmentId)
      if (!garment) {
        return { ...EMPTY_VIEW, marks: analysis.garments.slice(0, 3).map(markFor) }
      }
      return { ...EMPTY_VIEW, focus: garment.region, marks: [markFor(garment)] }
    }

    // Inside the cloth the camera is the isolation. A cutout and a
    // leader line at 4x would be scenery, not evidence.
    case 'material':
      return EMPTY_VIEW

    case 'style-dna': {
      const influence = analysis.styleDna.find((item) => item.id === selection.influenceId)
      if (!influence) return EMPTY_VIEW
      const driving = analysis.garments.filter((garment) =>
        influence.drivenBy.includes(garment.id),
      )
      return {
        ...EMPTY_VIEW,
        focus: unionRegion(driving.map((garment) => garment.region)),
        marks: driving.map(markFor),
      }
    }

    case 'trend': {
      const signal = analysis.trendSignals[0]
      if (!signal) return EMPTY_VIEW
      const anchor = signal.claim.evidence.find((item) => item.anchor)?.anchor
      return {
        ...EMPTY_VIEW,
        focus: signal.claim.evidence.find((item) => item.region)?.region ?? null,
        marks: anchor
          ? [
              {
                id: signal.trendSlug,
                anchor,
                label: signal.trendName,
                side: anchor.x < 0.5 ? 'left' : 'right',
              },
            ]
          : [],
      }
    }

    default:
      return EMPTY_VIEW
  }
}

/* ── the reading ─────────────────────────────────────────────────── */

function ActPanel({
  act,
  analysis,
  selection,
  onSelectGarment,
  onSelectInfluence,
}: {
  act: ActId
  analysis: OutfitAnalysis
  selection: Selection
  onSelectGarment: (id: string | null) => void
  onSelectInfluence: (id: string | null) => void
}) {
  switch (act) {
    case 'silhouette':
      return <SilhouettePanel analysis={analysis} />
    case 'proportions':
      return <ProportionsPanel analysis={analysis} />
    case 'garments':
      return (
        <GarmentsPanel
          analysis={analysis}
          selectedId={selection.garmentId}
          onSelect={onSelectGarment}
        />
      )
    case 'material':
      return <MaterialPanel analysis={analysis} focusId={selection.materialId} />
    case 'style-dna':
      return (
        <>
          <StyleDnaPanel
            analysis={analysis}
            selectedId={selection.influenceId}
            onSelect={onSelectInfluence}
          />
          {/* Why the look works is the same reasoning layer as its DNA,
              read from the other side, so it belongs in the same act. */}
          <div className="mt-9 border-t border-studio-600 pt-6">
            <WhyPanel analysis={analysis} />
          </div>
        </>
      )
    case 'trend':
      return <TrendPanel analysis={analysis} />
    default:
      return null
  }
}

/**
 * The influences, arranged around the outfit rather than stacked in a
 * list — the look sits in the middle of the things it descends from.
 */
function InfluenceMap({
  analysis,
  activeId,
  onSelect,
}: {
  analysis: OutfitAnalysis
  activeId: string | null
  onSelect: (id: string) => void
}) {
  const influences = analysis.styleDna
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-20">
      {influences.map((influence, i) => {
        // A ring with its bottom left open, so nothing lands on the
        // legend or under the reading column.
        const angle = (-150 + (i / Math.max(1, influences.length - 1)) * 250) * (Math.PI / 180)
        const isOn = influence.id === activeId
        return (
          <button
            key={influence.id}
            type="button"
            tabIndex={-1}
            onClick={() => onSelect(influence.id)}
            className={cn(
              'pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap',
              'transition-all duration-(--duration-slow) ease-(--ease-settle)',
              isOn ? 'text-bone' : 'text-bone-mute',
            )}
            style={{
              left: `calc(50% + ${Math.cos(angle) * 30}%)`,
              top: `calc(50% + ${Math.sin(angle) * 36}%)`,
              opacity: isOn ? 1 : 0.4,
            }}
          >
            <span
              className={cn(
                'u-meta-sm block transition-colors duration-(--duration-default)',
                isOn && 'text-inference',
              )}
            >
              {influence.share}%
            </span>
            <span
              className={cn(
                'font-display leading-none tracking-[-0.01em]',
                isOn ? 'text-[26px]' : 'text-[17px]',
              )}
            >
              {influence.name}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * Scroll-locked reading, for pointer devices with motion allowed.
 *
 * One scene held by a sticky stage inside a tall section. Scrolling
 * moves a camera through the analysis rather than moving down a page,
 * and nothing intercepts the wheel, so the page scrolls normally once
 * the section is behind it.
 */

interface Frame {
  readonly act: number
  readonly step: number
}

function ScrollScene({ analysis }: { analysis: OutfitAnalysis }) {
  const roomRef = useRef<HTMLDivElement | null>(null)
  /** The reserved stage: the box the photograph is clipped to. */
  const boxRef = useRef<HTMLDivElement | null>(null)
  /** The plate itself, measured unscaled. */
  const plateRef = useRef<HTMLDivElement | null>(null)
  const [frame, setFrame] = useState<Frame>({ act: 0, step: 0 })

  const { garments, materials, styleDna, image } = analysis
  /** The plate is as wide as its own photograph is, for the height it gets. */
  const ratio = image.width > 0 && image.height > 0 ? image.width / image.height : 2 / 3

  const { acts, screens } = useMemo(() => buildScene(sceneContentOf(analysis)), [analysis])
  const materialRegions = useMemo(() => materials.map((material) => material.region), [materials])

  /* The opening is not a scene of its own: it is the first stretch of
     the same scroll, over the same sticky stage. Everything after it
     is the analysis timeline, squeezed into what is left, so the act
     the camera is in is still a pure function of one number. */
  const reveal = REVEAL_SCREENS / (screens + REVEAL_SCREENS)
  /* Held only while the cloth is on frame, so the filters and the four
     fabric layers leave the document once the look is open. */
  const [cloth, setCloth] = useState(true)

  /* What the camera is allowed to do, measured from the page rather
     than assumed: how much room the reserved stage gives the plate,
     and how many pixels the photograph actually has to give. Read on
     resize, never per scroll frame — a layout read in the scroll
     handler is a forced reflow on every wheel notch. */
  const shotRef = useRef<Stage>(FULL_STAGE)
  useEffect(() => {
    const measure = () => {
      const box = boxRef.current
      const plate = plateRef.current
      if (!box || !plate || plate.offsetWidth === 0 || plate.offsetHeight === 0) return
      shotRef.current = {
        fitX: box.clientWidth / plate.offsetWidth,
        fitY: box.clientHeight / plate.offsetHeight,
        // Two image pixels per device pixel is the softest a macro is
        // allowed to get. Past that the zoom is inventing detail.
        limit:
          image.width > 0
            ? Math.min(
                MAX_MACRO_SCALE,
                (image.width * 2) / (plate.offsetWidth * (window.devicePixelRatio || 1)),
              )
            : MAX_MACRO_SCALE,
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [image.width])

  const onFrame = useCallback(
    (global: number) => {
      const room = roomRef.current

      // The opening first, and it freezes the camera at the frame the
      // analysis starts on: when the cloth clears, the photograph is
      // already composed exactly as act one wants it.
      const opening = clamp01(global / reveal)
      writeReveal(room, opening)
      setCloth(opening < 1)

      const p = clamp01((global - reveal) / (1 - reveal))
      const index = actIndexAt(acts, p)
      const local = actProgressAt(acts, p)

      // One clock. The material the reading highlights and the region
      // the camera frames come out of the same call, off the same act.
      const macro = materialAt(acts, p, materialRegions)

      const camera = cameraFor(acts, p, macro.region, shotRef.current)
      if (room) {
        room.style.setProperty('--cam-scale', camera.scale.toFixed(4))
        room.style.setProperty('--cam-x', camera.x.toFixed(3))
        room.style.setProperty('--cam-y', camera.y.toFixed(3))
        room.style.setProperty('--cam-z', camera.z.toFixed(2))
        room.style.setProperty('--editorial', camera.editorial.toFixed(4))
        room.style.setProperty('--apparatus', camera.apparatus.toFixed(4))
        room.style.setProperty('--recess', camera.recess.toFixed(4))
        // Marks ride the zoom; type does not. Never above 1, so the
        // labels shrink back to size rather than swelling during the
        // entrance, where the plate is still under full size.
        room.style.setProperty('--cam-inv', Math.min(1, 1 / camera.scale).toFixed(4))
      }

      const id = acts[index]?.id
      const step =
        id === 'garments'
          ? stepAt(local, garments.length)
          : id === 'material'
            ? macro.index
            : id === 'style-dna'
              ? stepAt(local, styleDna.length)
              : 0

      setFrame((previous) =>
        previous.act === index && previous.step === step ? previous : { act: index, step },
      )
    },
    [acts, garments.length, materialRegions, reveal, styleDna.length],
  )

  const { sectionRef, seek } = useScrollScene(onFrame)

  /* The rail and the panels think in analysis progress; the page is
     scrolled in the whole scroll, opening included. One conversion,
     in one place, instead of every caller knowing about the cloth. */
  const seekScene = useCallback(
    (p: number) => seek(reveal + p * (1 - reveal)),
    [reveal, seek],
  )

  const actId = acts[frame.act]?.id ?? 'enter'
  const selection = useMemo<Selection>(
    () => ({
      garmentId: actId === 'garments' ? (garments[frame.step]?.id ?? null) : null,
      materialId: actId === 'material' ? (materials[frame.step]?.id ?? null) : null,
      influenceId: actId === 'style-dna' ? (styleDna[frame.step]?.id ?? null) : null,
    }),
    [actId, frame.step, garments, materials, styleDna],
  )

  const view = useMemo(() => sceneView(analysis, actId, selection), [analysis, actId, selection])

  // A fast scroll crosses several acts before it settles. The reading
  // follows every one of them; the live region must not.
  const [spoken, setSpoken] = useState(0)
  useEffect(() => {
    const timer = setTimeout(() => setSpoken(frame.act), 400)
    return () => clearTimeout(timer)
  }, [frame.act])

  const selectGarment = useCallback(
    (id: string | null) => {
      const at = garments.findIndex((garment) => garment.id === id)
      if (at >= 0) seekScene(progressForStep(acts, 'garments', at))
    },
    [acts, garments, seekScene],
  )

  const selectInfluence = useCallback(
    (id: string | null) => {
      const at = styleDna.findIndex((influence) => influence.id === id)
      if (at >= 0) seekScene(progressForStep(acts, 'style-dna', at))
    },
    [acts, seekScene, styleDna],
  )

  /* The reading never takes the wheel by surprise.

     A panel with its own scrollbar makes the same gesture do two
     different things depending on where the cursor happens to be, so
     by default it has none: the reading is clipped and says so. Long
     texts get an explicit mode you have to ask for, and only that mode
     scrolls independently. */
  const panelRef = useRef<HTMLDivElement | null>(null)
  const panelBodyRef = useRef<HTMLDivElement | null>(null)
  const [clipped, setClipped] = useState(false)
  // Held against the act it was asked for, so moving on drops it
  // without an effect having to reach back in and reset it.
  const [readingAct, setReadingAct] = useState<ActId | null>(null)
  const reading = readingAct === actId

  useEffect(() => {
    const box = panelRef.current
    const body = panelBodyRef.current
    if (!box || !body) return
    // ResizeObserver reports the current size on observe, so the first
    // measurement arrives without having to ask for it.
    const observer = new ResizeObserver(() => setClipped(body.scrollHeight > box.clientHeight + 2))
    observer.observe(body)
    observer.observe(box)
    return () => observer.disconnect()
  }, [actId, selection])

  return (
    <>
      <div
        ref={sectionRef}
        className="relative"
        style={{ height: `${((1 + screens + REVEAL_SCREENS) * 100).toFixed(1)}dvh` }}
      >
        <div className="sticky top-0 h-dvh">
          <StudioRoom ref={roomRef} className="h-full">

            <header
              className="absolute inset-x-0 top-0 z-50 flex items-baseline gap-4 border-b border-studio-600 py-4 lg:gap-6"
              style={{ paddingInline: 'var(--page-gutter)' }}
            >
              {/* One wordmark, one setting. It was 18px bold at +0.3em
                  here and -0.02em in `SiteHeader` — the same three
                  words drawn two different ways, one screen apart. */}
              <Link
                to="/"
                className="inline-flex shrink-0 items-baseline font-display text-[19px] font-bold uppercase leading-none tracking-[-0.02em] transition-colors duration-(--duration-fast) hover:text-bone-dim"
              >
                Croquis
              </Link>
              <span className="u-meta-sm truncate">{analysis.title}</span>
              <span className="flex-1" />
              <SiteNav />
              <AskTrigger className="ml-6 border-l border-studio-600 pl-6" />
            </header>

            {/* The three columns are sized by the window, not by fixed
                slabs: between 860 and 1100 the rail and the reading give
                back the room the subject needs instead of squeezing it
                into a strip. Below 860 this layout is not used at all. */}
            <div
              className="absolute inset-x-0 top-[62px] bottom-[54px] z-10 grid items-center"
              style={{
                gridTemplateColumns:
                  'clamp(138px, 16vw, 240px) minmax(0, 1fr) clamp(228px, 26vw, 360px)',
                gap: 'clamp(16px, 2.4vw, 36px)',
                paddingInline: "var(--page-gutter)",
              }}
            >
              {/* LEFT — the opening headline gives way to the rail */}
              <div className="relative self-center">
                <div
                  className="pointer-events-none"
                  style={{ opacity: 'var(--editorial, 1)' }}
                  aria-hidden={frame.act > 0}
                >
                  <h1 className="u-d3 text-balance">
                    {analysis.title}
                  </h1>
                </div>

                <nav
                  aria-label="Actos del análisis"
                  className="absolute inset-x-0 top-1/2 -translate-y-1/2"
                  style={{ opacity: 'var(--apparatus, 0)' }}
                >
                  <ol>
                    {acts.map((act, i) => {
                      const isOn = i === frame.act
                      return (
                        <li key={act.id}>
                          <button
                            type="button"
                            onClick={() => seekScene(progressForAct(acts, i))}
                            aria-current={isOn ? 'step' : undefined}
                            className="group flex min-h-8 w-full items-center gap-3.5 py-1.5 text-left"
                          >
                            <span
                              aria-hidden
                              className={cn(
                                'h-px transition-all duration-(--duration-default) ease-(--ease-settle)',
                                isOn ? "w-7 bg-bone" : "w-3.5 bg-studio-500 group-hover:bg-bone-mute",
                              )}
                            />
                            <span
                              className={cn(
                                'u-meta-sm transition-colors duration-(--duration-default)',
                                isOn ? 'text-bone' : 'text-bone-mute group-hover:text-bone-dim',
                              )}
                            >
                              {act.label}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ol>
                </nav>
              </div>

              {/* CENTRE — the subject. Never unmounted, only moved. */}
              <div className="relative flex h-full items-center justify-center">
                {/* The reserved stage.

                    The camera is clipped to this box, which is the
                    whole answer to the photograph climbing over the
                    rail, the header and the reading at full zoom: the
                    subject has a room and cannot leave it, however far
                    in the camera pushes. The same box is what the
                    camera measures its own limits against. */}
                <div
                  ref={boxRef}
                  className="absolute inset-0 flex items-center justify-center overflow-hidden"
                >
                  {/* Sized by height, capped by width: the plate keeps
                      the photograph's own proportions and never outgrows
                      the room it has, so a narrow window narrows the
                      columns rather than the subject. */}
                  <div
                    style={{ width: `min(100%, calc(min(78dvh, 820px) * ${ratio.toFixed(4)}))` }}
                  >
                    {/* Behind the cloth the photograph is not a still:
                        it comes in fractionally over-size, out of
                        focus and dark, and settles as the opening
                        widens. Both the veil and the settle leave the
                        element entirely once the cloth is gone, so the
                        analysis runs without a filter on the subject. */}
                    <div
                      className={cn('w-full', cloth && 'scene-veil')}
                      style={
                        cloth
                          ? { transform: 'scale(calc(1 + (1 - var(--settle, 1)) * 0.055))' }
                          : undefined
                      }
                    >
                      {/* The contact shadow goes inside the camera, so it
                          travels with the plate. On the wrapper it stays
                          at full size and paints as a slab behind a
                          scaled photograph.

                          It is `u-print`: one pixel at six per cent, the
                          shadow a print casts lying on a table. What was
                          here was a 90px black bloom, which is an
                          elevation shadow, and nothing on this surface
                          is elevated. */}
                      <div
                        ref={plateRef}
                        className="scene-camera u-print w-full"
                      >
                        <OutfitPlate
                          image={analysis.image}
                          priority
                          focus={view.focus}
                          marks={view.marks}
                          bracket={view.bracket}
                          rules={view.rules}
                          axis={view.axis}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {actId === 'style-dna' ? (
                  <InfluenceMap
                    analysis={analysis}
                    activeId={selection.influenceId}
                    onSelect={selectInfluence}
                  />
                ) : null}
              </div>

              {/* RIGHT — what Croquis reads, then what it found */}
              <div className="relative max-h-full self-center">
                <div
                  className="absolute inset-x-0 top-1/2 -translate-y-1/2"
                  style={{
                    opacity: 'var(--apparatus, 0)',
                    pointerEvents: frame.act > 0 ? 'auto' : 'none',
                  }}
                >
                  <div
                    ref={panelRef}
                    className={cn(
                      'max-h-[68dvh] pr-1',
                      reading
                        ? 'overflow-y-auto overscroll-contain border-l border-studio-500 pl-4'
                        : 'overflow-hidden',
                    )}
                  >
                    <div ref={panelBodyRef}>
                      <ActPanel
                        act={actId}
                        analysis={analysis}
                        selection={selection}
                        onSelectGarment={selectGarment}
                        onSelectInfluence={selectInfluence}
                      />
                    </div>
                  </div>

                  {clipped || reading ? (
                    <button
                      type="button"
                      aria-pressed={reading}
                      onClick={() => setReadingAct(reading ? null : actId)}
                      className="u-act-quiet mt-4 px-4"
                    >
                      {reading ? 'Volver a la escena' : 'Leer el texto completo'}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <footer
              className="absolute inset-x-0 bottom-0 z-50 flex items-center gap-4 pb-4 lg:gap-6"
              style={{ paddingInline: "var(--page-gutter)" }}
            >
              <span className="flex-1" />
              <span className="u-meta-sm">{analysis.image.credit}</span>
            </footer>

            {cloth ? (
              <AtelierReveal title="Croquis" tagline={analysis.title} />
            ) : null}

            <div role="status" aria-live="polite" className="sr-only">
              {`Acto ${spoken + 1} de ${acts.length}: ${acts[spoken]?.label ?? ''}`}
            </div>
          </StudioRoom>
        </div>
      </div>

      {/* The scene lets go here, and the page is a page again. */}
      <StudioRoom className="px-7 py-20">
        <AnalysisOutro analysis={analysis} />
      </StudioRoom>
    </>
  )
}

/** What was read, and where to go next. */
function AnalysisOutro({ analysis }: { analysis: OutfitAnalysis }) {
  const signal = analysis.trendSignals[0]
  return (
    <>
      {signal ? (
        <p className="max-w-[56ch] text-[13.5px] leading-relaxed text-bone-mute">
          Señal registrada:{' '}
          <Link
            to={`/tendencias/${signal.trendSlug}`}
            className="text-bone underline decoration-studio-500 decoration-1 underline-offset-[6px] transition-colors duration-(--duration-default) hover:decoration-bone"
          >
            {signal.trendName}
          </Link>
          .
        </p>
      ) : null}

      <div className="mt-10">
        <Link to="/analizar" className="u-act-quiet border-bone text-bone hover:bg-bone hover:text-studio-900">
          Añadir otro look
        </Link>
      </div>
    </>
  )
}

/**
 * Document reading, for touch, narrow windows and reduced motion.
 *
 * The same analysis states delivered directly: the photograph stays
 * pinned and the reading scrolls under it, so each claim still arrives
 * attached to the region it came from.
 */

function DocumentAnalysis({
  analysis,
  reveal,
}: {
  analysis: OutfitAnalysis
  /** The opening. Off under reduced motion, where nothing is covered. */
  reveal: boolean
}) {
  const roomRef = useRef<HTMLDivElement | null>(null)
  const [cloth, setCloth] = useState(reveal)
  const [garmentId, setGarmentId] = useState<string | null>(null)
  const [influenceId, setInfluenceId] = useState<string | null>(null)
  const [act, setAct] = useState(0)
  const sectionsRef = useRef<(HTMLElement | null)[]>([])

  // The same seven acts off the same content, so the two surfaces
  // cannot disagree about what this analysis contains.
  const { acts } = useMemo(() => buildScene(sceneContentOf(analysis)), [analysis])
  const plateRatio =
    analysis.image.width > 0 && analysis.image.height > 0
      ? analysis.image.width / analysis.image.height
      : 2 / 3

  /* Here the opening is simply the first screens of the page: the
     photograph is already pinned by the sticky plate, so the cloth
     draws back off the same image the reading goes on to annotate. */
  useTopScrub(
    useCallback((p: number) => {
      writeReveal(roomRef.current, p)
      setCloth(p < 1)
    }, []),
    REVEAL_SCREENS_TOUCH,
    reveal,
  )

  const selection = useMemo<Selection>(
    () => ({ garmentId, influenceId, materialId: null }),
    [garmentId, influenceId],
  )
  const actId = acts[act]?.id ?? 'enter'
  const view = useMemo(() => sceneView(analysis, actId, selection), [analysis, actId, selection])

  useEffect(() => {
    const nodes = sectionsRef.current.filter((node): node is HTMLElement => node !== null)
    if (nodes.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const next = Number((entry.target as HTMLElement).dataset.act)
          if (!Number.isNaN(next)) setAct(next)
        }
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    )
    for (const node of nodes) observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <StudioRoom ref={roomRef} className="min-h-dvh overflow-visible">
      {/* The shared header, and it scrolls away rather than pinning:
          that is what lets it wrap on a phone without pushing the
          photograph down the screen behind it. */}
      <SiteHeader section={analysis.title} />

      {/* Under the cloth the plate stands nearly full height and out
          of focus, and comes down to its reading size as the opening
          widens — the same photograph throughout, never swapped. */}
      <div className="sticky top-0 z-20 bg-studio-800 px-5 pb-3 pt-1">
        {/* The plate is sized here rather than by its own max-height so
            the box the opening scales is as wide as the photograph and
            not as wide as the screen: a full-width box grown by a third
            is a third of a screen of sideways scroll. */}
        <div
          className={cn(
            'mx-auto',
            cloth && 'scene-veil',
          )}
          style={{
            // Height-led, so 46dvh is the plate's height whatever shape
            // the photograph is, and min() keeps a landscape look from
            // running past the width of a phone.
            width: `min(100%, calc(46dvh * ${plateRatio.toFixed(4)}))`,
            ...(cloth
              ? {
                  transform: `translateY(calc((1 - var(--settle, 1)) * 13dvh))
                              scale(calc(1 + (1 - var(--settle, 1)) * 0.3))`,
                  transformOrigin: '50% 0',
                }
              : null),
          }}
        >
          <OutfitPlate
            image={analysis.image}
            priority
            focus={view.focus}
            marks={view.marks.slice(0, 2)}
            bracket={view.bracket}
            rules={view.rules}
            axis={view.axis}
            className="w-full"
          />
          <p className="u-meta-sm mt-2 text-center">{acts[act]?.label}</p>
        </div>
      </div>

      {/* The travel the opening is scrubbed against. Nothing is in it:
          the cloth is over the viewport and the plate is pinned, so
          this is scroll the reveal spends and the document does not. */}
      {reveal ? (
        <div aria-hidden style={{ height: `calc(100dvh * ${REVEAL_SCREENS_TOUCH})` }} />
      ) : null}

      <div className="relative z-10 px-5 pb-16">
        {acts.map((entry, i) => (
          <section
            key={entry.id}
            data-act={i}
            ref={(node) => {
              sectionsRef.current[i] = node
            }}
            className="min-h-[62dvh] border-t border-studio-600 pt-6 first:border-t-0"
            aria-label={entry.label}
          >
            {entry.id === 'enter' ? (
              <div>
                <h1 className="u-d2 text-balance">
                  {analysis.title}
                </h1>
              </div>
            ) : (
              <ActPanel
                act={entry.id}
                analysis={analysis}
                selection={selection}
                onSelectGarment={setGarmentId}
                onSelectInfluence={setInfluenceId}
              />
            )}
          </section>
        ))}

        <p className="u-meta-sm mt-10 border-t border-studio-600 pt-5">{analysis.image.credit}</p>
      </div>

      {cloth ? (
        <AtelierReveal title="Croquis" tagline={analysis.title} simple pinned />
      ) : null}
    </StudioRoom>
  )
}

/**
 * A look that is not there, or would not open.
 *
 * It was a 44ch block centred in an empty viewport with no header on
 * it — the shape of a modal, on a page that is not one, with the
 * product's own name missing from the one screen where somebody is
 * most likely to wonder where they are. It is a plate now: the header
 * stays, the block hangs off the left edge under a rule, and the two
 * ways out sit on the same baseline as everything else.
 */
function Notice({
  title,
  body,
  tone = "neutral",
}: {
  title: string
  body?: string
  /** A failure is not a wait. It says so, in the colour failures use. */
  tone?: "neutral" | "error"
}) {
  return (
    <StudioRoom className="min-h-dvh">
      <SiteHeader />
      <main className="u-page">
        <div
          className="u-read border-t border-studio-600 pt-5"
          {...(tone === "error" ? { role: "alert" as const } : { role: "status" as const })}
        >
          <span className="u-num text-bone-mute">00</span>
          <p className={cn("u-d3 mt-3", tone === "error" && "text-interpretation")}>{title}</p>
          {body ? (
            <p className="mt-4 text-[15px] leading-relaxed text-bone-dim">{body}</p>
          ) : null}
          <div className="mt-(--rhythm-block) flex flex-wrap items-center gap-x-7 gap-y-3">
            <Link to="/outfits" className="u-act">
              Mis outfits
            </Link>
            <Link to="/analizar" className="u-meta u-act-word">
              Añadir un look
            </Link>
          </div>
        </div>
      </main>
    </StudioRoom>
  )
}

export function Analysis() {
  const { id } = useParams<{ id: string }>()
  const state = useOutfitAnalysis(id)

  const reduced = usePrefersReducedMotion()
  const coarse = useCoarsePointer()

  if (state.status === "loading") {
    return (
      <StudioRoom className="min-h-dvh">
        <SiteHeader />
        <main className="u-page">
          <Opening what="el análisis" />
        </main>
      </StudioRoom>
    )
  }
  if (state.status === 'missing') {
    return (
      <Notice title="No encontrado" tone="error" />
    )
  }
  if (state.status === 'error') {
    return <Notice title="No se ha podido abrir" body={state.message} tone="error" />
  }

  return reduced || coarse ? (
    <DocumentAnalysis analysis={state.analysis} reveal={!reduced} />
  ) : (
    <ScrollScene analysis={state.analysis} />
  )
}
