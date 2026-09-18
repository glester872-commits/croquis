import { Link } from 'react-router-dom'

import { SiteHeader } from '@/components/croquis/SiteHeader'
import { StudioRoom } from '@/components/croquis/StudioRoom'

/**
 * An unknown address says so.
 *
 * Sending every unrecognised URL to the home page hides typos and
 * broken links behind a page that looks like it worked.
 */
export function NotFound({
  title = 'Esta página no existe',
  body = '',
}: {
  title?: string
  body?: string
}) {
  return (
    <StudioRoom className="min-h-dvh">
      <SiteHeader />

      <main className="u-page">
        {/* Same failure semantics as Notice in Analysis.tsx: an unknown
            address is an error state, announced the same way. */}
        <div className="max-w-[46ch]" role="alert">
          <h1 className="u-statement">{title}</h1>
          {body ? <p className="mt-5 text-[14px] leading-relaxed text-bone-dim">{body}</p> : null}

          <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-3">
            <Link to="/" className="u-act">
              Volver al inicio
            </Link>
            <Link to="/outfits" className="u-meta u-act-word">
              Mis outfits
            </Link>
            <Link to="/tendencias" className="u-meta u-act-word">
              Tendencias
            </Link>
          </div>
        </div>
      </main>
    </StudioRoom>
  )
}
