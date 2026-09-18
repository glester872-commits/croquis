import { cn } from '@/lib/utils'
import type { Claim, KnowledgeKind } from '@/types'

/* A claim's epistemic status decides how it is drawn, not just which
   badge it carries. */

interface KindStyle {
  readonly label: string
  readonly meaning: string
  readonly text: string
  readonly rule: string
  readonly dot: string
}

const KIND: Record<KnowledgeKind, KindStyle> = {
  'visual-inference': {
    label: 'Inferencia',
    meaning: 'Leído en la fotografía',
    text: 'text-inference',
    rule: 'border-inference/45',
    dot: 'bg-inference',
  },
  supported: {
    label: 'Con fuente',
    meaning: 'Respaldado por una fuente citable',
    text: 'text-bone',
    rule: 'border-bone/35',
    dot: 'bg-bone',
  },
  interpretation: {
    label: 'Lectura',
    meaning: 'Una interpretación razonada, no un hecho',
    text: 'text-interpretation',
    rule: 'border-interpretation/45',
    dot: 'bg-interpretation',
  },
}

const CONFIANZA: Record<string, string> = { low: 'baja', moderate: 'media', high: 'alta' }

export function ClaimChip({ kind, className }: { kind: KnowledgeKind; className?: string }) {
  const style = KIND[kind]
  return (
    <span
      className={cn(
        'u-meta-sm inline-flex shrink-0 items-center gap-1.5 border px-1.5 py-[3px]',
        style.rule,
        style.text,
        className,
      )}
      title={style.meaning}
    >
      <span aria-hidden className={cn('size-[5px]', style.dot)} />
      {style.label}
    </span>
  )
}

/** A claim with its status, evidence and provenance all reachable. */
export function ClaimStatement({
  claim,
  className,
  showEvidence = true,
}: {
  claim: Claim
  className?: string
  showEvidence?: boolean
}) {
  const style = KIND[claim.kind]
  const hasEvidence = showEvidence && claim.evidence.length > 0

  return (
    <div className={cn('border-l pl-3.5', style.rule, className)}>
      <p className="text-[13.5px] leading-relaxed text-bone-dim">{claim.statement}</p>

      {hasEvidence ? (
        <ul className="mt-2.5 space-y-1">
          {claim.evidence.map((item) => (
            <li key={item.id} className="flex gap-2">
              <span aria-hidden className={cn('mt-[7px] h-px w-2.5 shrink-0', style.dot)} />
              <span className="u-note leading-snug">{item.observation}</span>
            </li>
          ))}
        </ul>
      ) : null}

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
    </div>
  )
}
