import { usePrefersReducedMotion } from '@/hooks/useMediaPreference'

/**
 * Croquis reading, said with the apparatus rather than with a spinner.
 *
 * It was two round dots and `animate-pulse` — Tailwind's factory
 * skeleton class, and the only circle in a product whose whole rule is
 * that nothing has a radius. A measurement is a rule with a mark
 * travelling along it, so that is what this is: one hairline, one ink
 * segment crossing it, at the speed of a hand and not of a loader.
 */
export function AnalyzingIndicator({ label = 'Analizando' }: { label?: string }) {
  const reduced = usePrefersReducedMotion()

  return (
    <p className="flex items-center gap-3">
      <span
        aria-hidden
        className="relative block h-px w-14 shrink-0 overflow-hidden bg-studio-500"
      >
        {/* Under reduced motion the mark stops where a measurement
            would rest: present, legible, not moving. */}
        <span
          className="absolute inset-y-0 left-0 block w-1/3 bg-bone"
          style={reduced ? undefined : { animation: 'croquis-measure 1.4s var(--ease-settle) infinite' }}
        />
      </span>
      <span className="u-meta-sm text-bone-dim">{label}</span>
    </p>
  )
}
