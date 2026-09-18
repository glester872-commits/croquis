import { usePrefersReducedMotion } from '@/hooks/useMediaPreference'

export function AnalyzingIndicator() {
  const reduced = usePrefersReducedMotion()

  if (reduced) {
    return (
      <div className="flex items-center justify-center gap-2">
        <span className="inline-block size-2 rounded-full bg-bone" />
        <span className="u-meta-sm text-bone-dim">Analizando…</span>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center gap-2">
      <span className="inline-block size-2 rounded-full bg-bone animate-pulse" />
      <span className="u-meta-sm text-bone-dim">Analizando…</span>
    </div>
  )
}
