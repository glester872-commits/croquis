import { Link, useParams } from 'react-router-dom'

import { SiteHeader } from '@/components/croquis/SiteHeader'
import { StudioRoom } from '@/components/croquis/StudioRoom'
import { ClaimChip } from '@/components/croquis/evidence/Claim'
import { findTrend } from '@/data/trends'
import { BRAND_TIER, CULTURAL_DOMAIN, TREND_STAGE } from '@/lib/labels'
import type { BrandTier, Claim, Confidence, Trend as TrendRecord } from '@/types'
import { NotFound } from './NotFound'

/**
 * One trend.
 *
 * Every section is either a list of things visible on a garment or a
 * Claim carrying its own epistemic status. No summary figures, since
 * there is no source for them.
 */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-studio-600 pt-(--rhythm-heading)">
      {/* D3: a real section break, not a caption pretending to be one.
          Everything that hangs under it (h3s at 15px/13px) now reads
          as subordinate, which it was never allowed to when the
          section title sat at 11.5px mono and its children at 15px. */}
      <h2 className="u-d3 mb-(--rhythm-heading) text-bone">{title}</h2>
      {children}
    </section>
  )
}

function Chips({ items }: { items: readonly string[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <li key={item} className="u-tag">
          {item}
        </li>
      ))}
    </ul>
  )
}

const CONFIANZA: Record<Confidence, string> = { low: 'baja', moderate: 'media', high: 'alta' }

/** The chip only needs to repeat when the epistemic status actually
    changes from the claim before it in the same run. */
function statusChanged(claim: Claim, previous: Claim | undefined) {
  return !previous || previous.kind !== claim.kind || previous.confidence !== claim.confidence
}

/** Tracks "previous" across a sequence of claims rendered in order, so
    each Reading below can ask "did the status just change?" without
    every call site wiring up its own state. */
function createTracker() {
  let previous: Claim | undefined
  return (claim: Claim) => {
    const changed = statusChanged(claim, previous)
    previous = claim
    return changed
  }
}

/**
 * A claim's text, styled by what kind of knowledge it is. Interpretation
 * is the stylist's voice — u-stylist, italic Bodoni, terracotta, capped
 * at the note measure — which is exactly what it was reserved for.
 * Everything else reads as argument prose at the read measure.
 *
 * The epistemic chip (kind · confidence · source) is drawn only when
 * `showChip` says the status changed since the previous claim in this
 * run, so a section of a dozen "Lectura · Confianza · Media" badges
 * collapses to the handful of places the status actually moves.
 */
function Reading({ claim, showChip }: { claim: Claim; showChip: boolean }) {
  const isInterpretation = claim.kind === 'interpretation'

  return (
    <div>
      <p className={isInterpretation ? 'u-stylist' : 'u-read text-[13.5px] leading-relaxed text-bone-dim'}>
        {claim.statement}
      </p>

      {showChip ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <ClaimChip kind={claim.kind} />
          <span className="u-meta-sm">Confianza · {CONFIANZA[claim.confidence]}</span>
          {claim.sources.map((source) => (
            <span key={source.id} className="u-meta-sm">
              {source.url ? (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline decoration-bone-mute/50 underline-offset-2 hover:text-bone"
                >
                  {source.publisher}
                </a>
              ) : (
                source.publisher
              )}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

const TIER_ORDER: readonly BrandTier[] = ['leading', 'interpreting', 'emerging', 'mass-adoption']

function TrendPage({ trend }: { trend: TrendRecord }) {
  const related = trend.relatedSlugs
    .map((slug) => findTrend(slug))
    .filter((entry): entry is TrendRecord => entry !== undefined)

  // Fresh per render, one per section that runs a sequence of claims —
  // each tracks its own "did the status change" run independently.
  const trackTimeline = createTracker()
  const trackCulture = createTracker()
  const trackNext = createTracker()
  const trackRetail = createTracker()

  return (
    <StudioRoom className="min-h-dvh">
      <SiteHeader section="Tendencias" />

      <main className="u-page">
        <Link to="/tendencias" className="u-meta u-act-word">
          ← Todas las tendencias
        </Link>

        <div className="u-read">
          <h1 className="u-statement mt-6">{trend.name}</h1>
          <p className="u-meta-sm mt-4">{TREND_STAGE[trend.stage]}</p>
        </div>

        {/* Two axes from here down: the argument at u-read on the left,
            readings and provenance hanging in u-note-col on the right —
            u-plate-grid gives every section the full page width instead
            of the single 62ch column that used to run 3288px with the
            right 45% of the page empty beside it. */}
        <div className="mt-(--rhythm-section) space-y-(--rhythm-section)">
          <Section title="De dónde viene">
            <Reading claim={trend.origin} showChip />
          </Section>

          <Section title="Códigos visuales">
            <Chips items={trend.visualCodes} />
          </Section>

          <Section title="Piezas clave">
            <Chips items={trend.keyPieces} />
          </Section>

          <Section title="Recorrido">
            <ol className="space-y-(--rhythm-block)">
              {trend.timeline.map((event) => (
                <li key={event.id} className="u-plate-grid gap-y-3">
                  <div className="col-span-12 sm:col-span-7">
                    <p className="u-meta-sm text-inference">{event.period}</p>
                    <h3 className="mt-1 text-[15px] font-semibold tracking-[-0.005em]">
                      {event.title}
                    </h3>
                    <p className="u-read mt-2 text-[13.5px] leading-relaxed text-bone-dim">
                      {event.description}
                    </p>
                  </div>
                  <div className="col-span-12 sm:col-span-5">
                    <Reading claim={event.claim} showChip={trackTimeline(event.claim)} />
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          <Section title="Contexto cultural">
            <ul className="space-y-(--rhythm-block)">
              {trend.culturalContext.map((reference) => (
                <li key={reference.id} className="u-plate-grid gap-y-3">
                  <div className="col-span-12 sm:col-span-7">
                    <p className="u-meta-sm">{CULTURAL_DOMAIN[reference.domain]}</p>
                    <h3 className="mt-1 text-[15px] font-semibold tracking-[-0.005em]">
                      {reference.title}
                    </h3>
                    <p className="u-read mt-2 text-[13.5px] leading-relaxed text-bone-dim">
                      {reference.description}
                    </p>
                  </div>
                  <div className="col-span-12 sm:col-span-5">
                    <Reading claim={reference.claim} showChip={trackCulture(reference.claim)} />
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Quién la lleva">
            <dl className="u-read border-t border-studio-600">
              {TIER_ORDER.map((tier) => {
                const brands = trend.brands.filter((brand) => brand.tier === tier)
                if (brands.length === 0) return null
                return (
                  <div key={tier} className="border-b border-studio-600 py-3">
                    <dt className="u-meta-sm">{BRAND_TIER[tier]}</dt>
                    <dd className="mt-1.5 space-y-1.5">
                      {brands.map((brand) => (
                        <p key={brand.id} className="text-[13.5px] leading-snug text-bone-dim">
                          <span className="text-bone">{brand.name}</span>
                          <span className="mx-2 text-bone-mute">·</span>
                          {brand.note}
                        </p>
                      ))}
                    </dd>
                  </div>
                )
              })}
            </dl>
          </Section>

          <Section title="Hacia dónde puede ir">
            <ul className="space-y-4">
              {trend.nextSignals.map((claim) => (
                <li key={claim.id}>
                  <Reading claim={claim} showChip={trackNext(claim)} />
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Lectura comercial">
            <div className="space-y-(--rhythm-block)">
              {(
                [
                  ['Cómo funciona comercialmente', trend.retail.commercialRead],
                  ['A quién le habla', trend.retail.targetConsumer],
                  ['Posicionamiento de precio', trend.retail.pricePositioning],
                  ['Potencial en tienda', trend.retail.retailPotential],
                ] as const
              ).map(([label, claim]) => (
                <div key={label} className="u-plate-grid gap-y-2">
                  <h3 className="col-span-12 text-[13px] font-semibold tracking-[-0.005em] text-bone sm:col-span-4">
                    {label}
                  </h3>
                  <div className="col-span-12 sm:col-span-8">
                    <Reading claim={claim} showChip={trackRetail(claim)} />
                  </div>
                </div>
              ))}

              <div className="u-plate-grid gap-y-2">
                <h3 className="col-span-12 text-[13px] font-semibold tracking-[-0.005em] text-bone sm:col-span-4">
                  Barreras de adopción
                </h3>
                <ul className="col-span-12 space-y-3 sm:col-span-8">
                  {trend.retail.adoptionBarriers.map((claim) => (
                    <li key={claim.id}>
                      <Reading claim={claim} showChip={trackRetail(claim)} />
                    </li>
                  ))}
                </ul>
              </div>

              <div className="u-plate-grid gap-y-2">
                <h3 className="col-span-12 text-[13px] font-semibold tracking-[-0.005em] text-bone sm:col-span-4">
                  Oportunidades de presentación
                </h3>
                <ul className="col-span-12 space-y-3 sm:col-span-8">
                  {trend.retail.merchandisingOpportunities.map((claim) => (
                    <li key={claim.id}>
                      <Reading claim={claim} showChip={trackRetail(claim)} />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Section>

          {related.length > 0 ? (
            <Section title="Relacionadas">
              <ul className="flex flex-wrap gap-x-7 gap-y-1">
                {related.map((entry) => (
                  <li key={entry.slug}>
                    {/* u-act-word: 44px minimum touch target, the
                        system's built-in underline affordance — the
                        hand-rolled min-h-8 (32px) underline is gone. */}
                    <Link to={`/tendencias/${entry.slug}`} className="u-act-word text-[14px]">
                      {entry.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </div>
      </main>
    </StudioRoom>
  )
}

export function Trend() {
  const { slug } = useParams<{ slug: string }>()
  const trend = slug ? findTrend(slug) : undefined

  if (!trend) {
    return <NotFound title="Esa tendencia no existe" />
  }

  return <TrendPage trend={trend} />
}
