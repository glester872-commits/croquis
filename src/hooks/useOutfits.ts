import { useCallback, useEffect, useRef, useState } from 'react'

import { outfitRepository } from '@/lib/storage/indexeddb-outfit-repository'
import type { OutfitSummary } from '@/lib/storage/outfit-repository'

export type OutfitsState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly outfits: readonly OutfitSummary[] }
  | { readonly status: 'error'; readonly message: string }

/**
 * The archive, kept in step with storage.
 *
 * Subscribes to the repository, so adding, renaming or deleting an
 * outfit anywhere in the application updates every surface showing
 * them without either one knowing about the other.
 */
export function useOutfits(): OutfitsState & { readonly reload: () => void } {
  const [state, setState] = useState<OutfitsState>({ status: 'loading' })
  /** Only the newest read may write state; a slower one is discarded. */
  const generation = useRef(0)
  const mounted = useRef(true)

  const read = useCallback(() => {
    const mine = (generation.current += 1)
    void outfitRepository
      .list()
      .then((outfits) => {
        if (mounted.current && generation.current === mine) {
          setState({ status: 'ready', outfits })
        }
      })
      .catch(() => {
        if (mounted.current && generation.current === mine) {
          setState({ status: 'error', message: 'No se ha podido leer tu archivo de outfits.' })
        }
      })
  }, [])

  useEffect(() => {
    mounted.current = true
    read()
    const unsubscribe = outfitRepository.subscribe(read)
    return () => {
      mounted.current = false
      unsubscribe()
    }
  }, [read])

  return { ...state, reload: read }
}
