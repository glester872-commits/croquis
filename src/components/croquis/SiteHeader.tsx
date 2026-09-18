import { Link, NavLink } from 'react-router-dom'

import { AskTrigger } from '@/components/croquis/ask/AskCroquis'
import { cn } from '@/lib/utils'

/**
 * One set of destinations, one naming, one order, everywhere.
 *
 * The list is the architecture of the product read aloud: you add a
 * look, you keep the garments, you keep the looks, you read what is
 * happening outside. Surfaces that cannot host the whole header — the
 * analysis, which is a scene — mount `SiteNav` on its own so the words
 * and their order still cannot drift apart between screens.
 */

const LINKS: readonly { to: string; label: string }[] = [
  { to: '/analizar', label: 'Añadir look' },
  { to: '/armario', label: 'Mi armario' },
  { to: '/outfits', label: 'Mis outfits' },
  { to: '/tendencias', label: 'Tendencias' },
]

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    // Where you are is marked by a rule under the word, not by a pill
    // or a fill: the same mark the archive uses for a selected act, so
    // the language holds across the product.
    'u-meta u-nav-link shrink-0 hover:text-bone',
    isActive ? 'border-b-bone text-bone' : '',
  )

/**
 * The words, inline. Desktop only — below `lg` the four links plus Ask
 * Croquis do not fit beside the wordmark, and the answer to that is
 * not to wrap them.
 */
export function SiteNav({ className }: { className?: string }) {
  return (
    <nav aria-label="Secciones" className={cn('flex flex-wrap items-center gap-x-7', className)}>
      {LINKS.map((link) => (
        <NavLink key={link.to} to={link.to} className={linkClass}>
          {link.label}
        </NavLink>
      ))}
    </nav>
  )
}

/**
 * The words, on a phone.
 *
 * They used to be a two-by-two grid pinned under the wordmark, which
 * ate a fifth of the first screen on every page before any of the
 * product appeared — on an application whose entire value is looking
 * at photographs.
 *
 * Desktop and mobile are two mountings of the same material, not one
 * layout that folds. On the phone the chrome goes to the bottom edge,
 * where a thumb already is, and runs as a single line that scrolls
 * rather than a block that wraps. The page keeps its own bottom
 * padding (`--page-bottom`, 80px at the floor) so nothing is covered.
 */
function ThumbNav() {
  return (
    <nav
      aria-label="Secciones"
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 lg:hidden',
        'flex items-center gap-x-6 overflow-x-auto border-t border-studio-600 bg-studio-800 px-5',
        '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        'pb-[env(safe-area-inset-bottom)]',
        // A row that can hold more than it shows says so at its own
        // edge, the way a strip of contact prints keeps fading into
        // the next frame instead of stopping square at the light box.
        '[mask-image:linear-gradient(to_right,transparent,black_14px,black_calc(100%-28px),transparent)]',
      )}
    >
      {LINKS.map((link) => (
        <NavLink key={link.to} to={link.to} className={linkClass}>
          {link.label}
        </NavLink>
      ))}
    </nav>
  )
}

/**
 * The head of the sheet.
 *
 * The rule under it is the edge of a page, not a floating bar: it runs
 * the full measure and the wordmark stands on it. That is the whole
 * difference between a header and a chrome bar, and it costs one
 * border.
 */
export function SiteHeader({ section }: { section?: string }) {
  return (
    <>
      <header className="u-page-flush relative z-20 flex items-baseline gap-x-6 border-b border-studio-600 py-5 sm:py-6">
        <Link
          to="/"
          className={cn(
            'inline-flex shrink-0 items-baseline font-display text-[19px] font-bold uppercase leading-none',
            // Law 1 of the type system, kept. This was +0.28em — the
            // tic of every fashion wordmark of the last decade, and
            // the single most visible breach in the product.
            'tracking-[-0.02em] sm:text-[21px]',
            'transition-colors duration-(--duration-fast) hover:text-bone-dim',
          )}
        >
          Croquis
        </Link>
        {section ? <span className="u-meta-sm truncate">{section}</span> : null}
        <span className="flex-1" />
        <SiteNav className="hidden lg:flex" />
        <AskTrigger className="ml-6 lg:border-l lg:border-studio-600 lg:pl-6" />
      </header>
      <ThumbNav />
    </>
  )
}
