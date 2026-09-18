import { createContext, useContext } from 'react'

import type { AskMessage } from '@/lib/chat/contract'

/**
 * The conversation's store, kept out of the component file.
 *
 * Only so the panel module exports components and nothing else — a
 * mixed module breaks fast refresh, and this hook is imported by the
 * header as well as by the panel.
 */

export type AskStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'asking' }
  | { readonly kind: 'error'; readonly message: string }

export interface AskState {
  readonly open: boolean
  readonly messages: readonly AskMessage[]
  readonly status: AskStatus
  readonly toggle: () => void
  readonly close: () => void
  readonly send: (question: string) => void
}

export const AskStore = createContext<AskState | null>(null)

export function useAsk(): AskState {
  const value = useContext(AskStore)
  if (!value) throw new Error('useAsk fuera de AskProvider')
  return value
}
