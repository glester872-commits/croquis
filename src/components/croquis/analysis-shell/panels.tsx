import { useState } from 'react'
import { Link } from 'react-router-dom'

import { ClaimStatement } from '@/components/croquis/evidence/Claim'
import { DESIGN_PRINCIPLE, GARMENT_LAYER, TREND_STAGE } from '@/lib/labels'
import { cn } from '@/lib/utils'
import type { OutfitAnalysis, SegmentationReport, StyleInfluence } from '@/types'

/* Panels are the reading. They carry no chrome of their own beyond a
   rule and a label, because the photograph is the thing on screen. */

export function PanelHeading({
  index,
  title,
}: {
  index: number
  title: string
}) {
  return (
    <div className="mb-4 flex items-baseline gap-3 border-b border-studio-600 pb-2.5">
      <span className="u-num text-bone-mute">{String(index).padStart(2, '0')}</span>
      <h2 className="text-[15px] font-semibold tracking-[-0.005em]">{title}</h2>
    </div>
  )
}

/** Shown when a reading is unavailable, naming which one. */
export function UnreadPanel({
  index,
  title,
  reading,
}: {
  index: number
  title: string
  /** What has not been read, as it fits in "Croquis no ha leído …". */
  reading: string
}) {
  return (
    <div>
      <PanelHeading index={index} title={title} />
      <p className="text-[13.5px] leading-relaxed text-bone-dim">
        Croquis no ha leído {reading} en esta fotografía.
      </p>
    </div>
  )
}

export function SilhouettePanel({ analysis }: { analysis: OutfitAnalysis }) {
  const { silhouette } = analysis
  if (!silhouette) {
    return <UnreadPanel index={1} title="Silueta" reading="la silueta ni sus proporciones" />
  }
  const [upper, lower] = silhouette.split
  return (
    <div>
      <PanelHeading
        index={1}
        title="Silueta y proporción"
      />
      <p className="font-display text-[26px] leading-tight tracking-[-0.01em]">{silhouette.name}</p>
      <p className="mt-1.5 text-[13px] text-bone-mute">{silhouette.line}</p>

      <dl className="mt-5 border-t border-studio-600">
        {[
          ['Superior : inferior', `${upper} : ${lower}`],
          ['Hombro', silhouette.shoulder],
          ['Cintura', silhouette.waist],
          ['Volumen', silhouette.volume],
        ].map(([term, value]) => (
          <div
            key={term}
            className="flex items-baseline justify-between gap-4 border-b border-studio-600 py-2"
          >
            <dt className="u-meta-sm">{term}</dt>
            <dd className="text-right text-[12.5px] text-bone-dim">{value}</dd>
          </div>
        ))}
      </dl>

      <ClaimStatement claim={silhouette.claim} className="mt-5" />
    </div>
  )
}

/** Built around the ratio itself rather than around a list. */
export function ProportionsPanel({ analysis }: { analysis: OutfitAnalysis }) {
  if (!analysis.silhouette) {
    return <UnreadPanel index={2} title="Proporciones" reading="la relación entre torso y pierna" />
  }
  const [upper, lower] = analysis.silhouette.split
  const section = analysis.breakdown.find((entry) => entry.category === 'proportions')

  return (
    <div>
      <PanelHeading index={2} title="Proporciones" />

      <div className="flex items-baseline gap-2">
        <span className="font-display text-[42px] leading-none tracking-[-0.02em]">{upper}</span>
        <span className="font-display text-[24px] leading-none text-bone-mute">:</span>
        <span className="font-display text-[42px] leading-none tracking-[-0.02em]">{lower}</span>
        <span className="u-meta-sm ml-2">superior : inferior</span>
      </div>

      {/* The same measure the plate draws, at reading size. */}
      <div aria-hidden className="mt-4 flex h-1.5 w-full overflow-hidden">
        <span className="bg-inference/70" style={{ width: `${upper}%` }} />
        <span className="bg-bone/20" style={{ width: `${lower}%` }} />
      </div>

      {section ? (
        <p className="mt-5 text-[13.5px] leading-relaxed text-bone-dim">{section.reading}</p>
      ) : null}

      <dl className="mt-5 border-t border-studio-600">
        {[
          ['Hombro', analysis.silhouette.shoulder],
          ['Cintura', analysis.silhouette.waist],
          ['Volumen', analysis.silhouette.volume],
        ].map(([term, value]) => (
          <div
            key={term}
            className="flex items-baseline justify-between gap-4 border-b border-studio-600 py-2"
          >
            <dt className="u-meta-sm">{term}</dt>
            <dd className="text-right text-[12.5px] text-bone-dim">{value}</dd>
          </div>
        ))}
      </dl>

      {section?.claims[0] ? <ClaimStatement claim={section.claims[0]} className="mt-5" /> : null}
    </div>
  )
}

export function GarmentsPanel({
  analysis,
  selectedId,
  onSelect,
}: {
  analysis: OutfitAnalysis
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  const selected = analysis.garments.find((garment) => garment.id === selectedId)
  if (analysis.garments.length === 0) {
    return <UnreadPanel index={2} title="Prendas" reading="ninguna prenda" />
  }
  return (
    <div>
      <PanelHeading index={2} title="Prendas" />
      <ul className="border-t border-studio-600">
        {analysis.garments.map((garment) => {
          const isOn = garment.id === selectedId
          return (
            <li key={garment.id} className="border-b border-studio-600">
              <button
                type="button"
                aria-pressed={isOn}
                onClick={() => onSelect(isOn ? null : garment.id)}
                className={cn(
                  'flex w-full items-baseline gap-3 py-2.5 text-left transition-colors duration-(--duration-fast)',
                  isOn ? 'text-bone' : 'text-bone-dim hover:text-bone',
                )}
              >
                <span className={cn('u-meta-sm shrink-0', isOn && 'text-inference')}>
                  {GARMENT_LAYER[garment.layer]}
                </span>
                <span className="flex-1 text-[13.5px]">{garment.name}</span>
              </button>
              {isOn ? (
                <div className="pb-3.5">
                  <ul className="mb-3 flex flex-wrap gap-1.5">
                    {garment.details.map((detail) => (
                      <li
                        key={detail}
                        className="u-tag border border-studio-600 px-2.5 py-1"
                      >
                        {detail}
                      </li>
                    ))}
                  </ul>
                  <ClaimStatement claim={garment.claim} />
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
      {!selected ? (
        <p className="u-note mt-4">Selecciona una prenda.</p>
      ) : null}
    </div>
  )
}

/**
 * The region the palette was measured on, shown over a dimmed copy of
 * the photograph so the isolation can be inspected.
 */
function AnalysedRegion({ report }: { report: SegmentationReport }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-4">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
        className="u-act-quiet px-4"
      >
        {open ? 'Ocultar la región' : 'Ver región analizada'}
      </button>

      {open ? (
        <div className="mt-3">
          <img
            src={report.preview}
            alt="La región de prendas que Croquis ha medido, sobre el resto de la fotografía atenuado"
            className="w-full max-w-[220px] border border-studio-600"
          />
          <p className="u-note mt-2">
            Sujeto {Math.round(report.subjectShare * 100)}% · prendas{' '}
            {Math.round(report.garmentShare * 100)}%
          </p>
          {report.notes.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {report.notes.map((note) => (
                <li key={note} className="text-[12.5px] leading-snug text-bone-mute">
                  — {note}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function MaterialPanel({
  analysis,
  focusId = null,
}: {
  analysis: OutfitAnalysis
  /** The material the frame is currently inside, if any. */
  focusId?: string | null
}) {
  const { palette, segmentation } = analysis

  // Nothing was isolated well enough to name a colour. Saying so is
  // the feature: a palette of the room is worse than no palette.
  if (!palette) {
    return (
      <div>
        <PanelHeading index={3} title="Paleta del outfit" />
        <p className="text-[13.5px] leading-relaxed text-bone-dim">
          Croquis no ha podido aislar todas las prendas con suficiente precisión.
        </p>
        {segmentation ? <AnalysedRegion report={segmentation} /> : null}
      </div>
    )
  }

  const shaky = segmentation !== null && segmentation.confidence < 0.75

  return (
    <div>
      <PanelHeading
        index={3}
        title={analysis.materials.length > 0 ? 'Paleta del outfit y materiales' : 'Paleta del outfit'}
      />

      {/* The palette was a stacked percentage bar with a two-column
          legend under it: the share of every colour said three times,
          in a chart, a word and a figure. It is the product's main
          result and it was the one element that read as a dashboard.

          It is a specification sheet now. One row per colour, and the
          row IS the measurement — the block runs as wide as the colour
          is present, so the length is the figure and the figure is only
          there for anyone who cannot read a length. Saturated ink
          belongs to the garments and to nothing else on this page. */}
      <ol className="mt-1">
        {palette.swatches.map((swatch, i) => (
          <li key={swatch.hex} className="border-b border-studio-600 py-2.5 first:border-t">
            <div className="flex items-baseline gap-3">
              <span className="u-num w-5 shrink-0 text-bone-mute">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-[13px] text-bone-dim">{swatch.name}</span>
              <span className="flex-1" />
              <span className="u-num text-bone-mute">{swatch.hex}</span>
              <span className="u-num w-9 text-right tabular-nums text-bone">{swatch.share}%</span>
            </div>
            <span
              aria-hidden
              className="mt-2 ml-8 block h-3"
              style={{ backgroundColor: swatch.hex, width: `calc(${swatch.share}% - 2rem)` }}
            />
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[12.5px] leading-relaxed text-bone-mute">{palette.scheme}</p>

      {shaky ? (
        <p className="mt-3 text-[12px] leading-relaxed text-interpretation">
          Aislamiento parcial. Léela como una aproximación.
        </p>
      ) : null}

      {segmentation ? <AnalysedRegion report={segmentation} /> : null}

      <div className="mt-6 space-y-4">
        {analysis.materials.map((material) => {
          const isOn = material.id === focusId
          return (
            <div
              key={material.id}
              className={cn(
                'transition-opacity duration-(--duration-slow) ease-(--ease-settle)',
                focusId && !isOn ? 'opacity-35' : 'opacity-100',
              )}
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-[13.5px] font-semibold">{material.name}</h3>
                <span className="u-meta-sm">{material.weight.split(' — ')[0]}</span>
              </div>
              {isOn ? (
                <p className="u-note mt-1.5 text-inference">
                  {material.finish}
                </p>
              ) : null}
              <ClaimStatement claim={material.claim} className="mt-2" />
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Style DNA as a measured column rather than progress bars: each
 * influence is a share of one shared vertical measure.
 */
export function StyleDnaPanel({
  analysis,
  selectedId,
  onSelect,
}: {
  analysis: OutfitAnalysis
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  const selected: StyleInfluence | undefined = analysis.styleDna.find(
    (influence) => influence.id === selectedId,
  )

  if (analysis.styleDna.length === 0) {
    return <UnreadPanel index={4} title="ADN de estilo" reading="ninguna influencia de estilo" />
  }

  return (
    <div>
      <PanelHeading
        index={4}
        title="ADN de estilo"
      />

      <ul className="border-t border-studio-600">
        {analysis.styleDna.map((influence) => {
          const isOn = influence.id === selectedId
          return (
            <li key={influence.id} className="border-b border-studio-600">
              <button
                type="button"
                aria-pressed={isOn}
                onClick={() => onSelect(isOn ? null : influence.id)}
                className="group relative flex w-full items-baseline gap-3 py-2.5 text-left"
              >
                {/* the share, drawn as a measure under the label */}
                <span
                  aria-hidden
                  className={cn(
                    'absolute bottom-[7px] left-0 h-[3px] transition-colors duration-(--duration-fast)',
                    isOn ? 'bg-inference' : 'bg-bone/12 group-hover:bg-bone/25',
                  )}
                  style={{ width: `${influence.share}%` }}
                />
                <span
                  className={cn(
                    'u-num relative w-9 shrink-0 transition-colors duration-(--duration-fast)',
                    isOn ? 'text-inference' : 'text-bone-mute',
                  )}
                >
                  {influence.share}%
                </span>
                <span
                  className={cn(
                    'relative flex-1 text-[13.5px] transition-colors duration-(--duration-fast)',
                    isOn ? 'font-semibold text-bone' : 'text-bone-dim group-hover:text-bone',
                  )}
                >
                  {influence.name}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {selected ? (
        <div className="mt-5">
          <p className="text-[13.5px] leading-relaxed text-bone">{selected.summary}</p>

          <h3 className="u-meta mt-5 mb-2">Producida por</h3>
          <ul className="flex flex-wrap gap-1.5">
            {selected.drivenBy.map((garmentId) => {
              const garment = analysis.garments.find((candidate) => candidate.id === garmentId)
              return garment ? (
                <li
                  key={garmentId}
                  className="u-tag border border-inference/45 px-2.5 py-1 text-inference"
                >
                  {garment.name}
                </li>
              ) : null
            })}
          </ul>

          <h3 className="u-meta mt-5 mb-2">Códigos visuales</h3>
          <ul className="flex flex-wrap gap-1.5">
            {selected.visualCodes.map((code) => (
              <li
                key={code}
                className="u-tag border border-studio-600 px-2.5 py-1"
              >
                {code}
              </li>
            ))}
          </ul>

          <h3 className="u-meta mt-5 mb-2">De dónde viene</h3>
          <p className="text-[13px] leading-relaxed text-bone-dim">{selected.historicalContext}</p>

          <ClaimStatement claim={selected.claim} className="mt-4" />
        </div>
      ) : (
        <p className="u-note mt-4">Selecciona una influencia.</p>
      )}
    </div>
  )
}

export function WhyPanel({ analysis }: { analysis: OutfitAnalysis }) {
  if (analysis.whyItWorks.length === 0) {
    return (
      <UnreadPanel index={5} title="Por qué funciona este look" reading="por qué funciona" />
    )
  }
  return (
    <div>
      <PanelHeading index={5} title="Por qué funciona este look" />
      <ul className="space-y-5">
        {analysis.whyItWorks.map((argument) => (
          <li key={argument.id}>
            <div className="mb-2 flex items-baseline gap-2.5">
              <span className="u-meta-sm text-interpretation">{DESIGN_PRINCIPLE[argument.principle]}</span>
            </div>
            <h3 className="text-[14px] font-semibold leading-snug text-balance">
              {argument.headline}
            </h3>
            <ClaimStatement claim={argument.claim} className="mt-2.5" />
          </li>
        ))}
      </ul>
    </div>
  )
}

export function TrendPanel({ analysis }: { analysis: OutfitAnalysis }) {
  if (analysis.trendSignals.length === 0) {
    return <UnreadPanel index={6} title="Señales de tendencia" reading="ninguna señal de tendencia" />
  }
  return (
    <div>
      <PanelHeading
        index={6}
        title="Señales de tendencia"
      />
      <ul className="space-y-6">
        {analysis.trendSignals.map((signal) => (
          <li key={signal.trendSlug}>
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-[19px] font-bold tracking-[-0.01em]">{signal.trendName}</h3>
              <span className="u-meta-sm text-inference">{TREND_STAGE[signal.stage]}</span>
            </div>
            <h4 className="u-meta mt-3 mb-2">Señales detectadas</h4>
            <ul className="space-y-1.5">
              {signal.signals.map((item) => (
                <li key={item} className="flex gap-2.5">
                  <span aria-hidden className="mt-[7px] size-[5px] shrink-0 bg-inference" />
                  <span className="text-[12.5px] leading-snug text-bone-dim">{item}</span>
                </li>
              ))}
            </ul>
            <ClaimStatement claim={signal.claim} className="mt-3.5" />
            <Link
              to={`/tendencias/${signal.trendSlug}`}
              className="u-act-quiet mt-4 px-4"
            >
              Ver la ficha de {signal.trendName}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
