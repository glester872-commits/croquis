import { Link } from 'react-router-dom'

import { SiteHeader } from '@/components/croquis/SiteHeader'
import { StudioRoom } from '@/components/croquis/StudioRoom'
import { trends } from '@/data/trends'
import { TREND_STAGE } from '@/lib/labels'

/**
 * Trend index.
 *
 * Name, stage, codes. The index does not describe a trend — the trend
 * page does, and only because somebody asked for it by clicking.
 */

export function Trends() {
  return (
    <StudioRoom className="min-h-dvh">
      <SiteHeader />

      <main className="u-page">
        <h1 className="u-title">Tendencias</h1>

        {trends.length === 0 ? (
          <p role="status" className="u-meta mt-(--rhythm-section) text-bone-dim">
            No hay tendencias publicadas todavía.
          </p>
        ) : (
          <ul className="mt-(--rhythm-section) border-t border-studio-600">
            {trends.map((trend, i) => (
              <li key={trend.slug} className="border-b border-studio-600">
                <Link
                  to={`/tendencias/${trend.slug}`}
                  aria-label={`${trend.name} — ${TREND_STAGE[trend.stage]}`}
                  className="group grid gap-x-10 gap-y-4 py-10 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,260px)]"
                >
                  <span className="u-num text-bone-mute">{String(i + 1).padStart(2, '0')}</span>

                  {/* D3, deliberately below the page's D2 title: the row
                      names a trend, it does not restate the page. */}
                  <div>
                    <h2 className="u-d3 text-bone-dim transition-colors duration-(--duration-default) group-hover:text-bone">
                      {trend.name}
                    </h2>
                    <p className="u-meta-sm mt-3">{TREND_STAGE[trend.stage]}</p>
                  </div>

                  <ul className="flex flex-wrap content-start gap-1.5 self-start">
                    {trend.visualCodes.slice(0, 4).map((code) => (
                      <li key={code} className="u-tag transition-colors duration-(--duration-default) group-hover:border-studio-500">
                        {code}
                      </li>
                    ))}
                  </ul>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </StudioRoom>
  )
}
