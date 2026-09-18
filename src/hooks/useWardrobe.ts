import { useCallback, useEffect, useRef, useState } from 'react'

import {
  wardrobeRepository,
  type WardrobeItemSummary,
} from '@/lib/storage/wardrobe-repository'

export type WardrobeState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly items: readonly WardrobeItemSummary[] }
  | { readonly status: 'error'; readonly message: string }

/**
 * The wardrobe, kept in step with storage.
 *
 * Subscribes to the repository, so adding, renaming or deleting a
 * garment anywhere in the application updates every surface showing
 * them without either one knowing about the other.
 */
export function useWardrobe(): WardrobeState & { readonly reload: () => void } {
  const [state, setState] = useState<WardrobeState>({ status: 'loading' })
  /** Only the newest read may write state; a slower one is discarded. */
  const generation = useRef(0)
  const mounted = useRef(true)

  const read = useCallback(() => {
    const mine = (generation.current += 1)
    void wardrobeRepository
      .list()
      .then((items) => {
        if (mounted.current && generation.current === mine) {
          setState({ status: 'ready', items })
        }
      })
      .catch(() => {
        if (mounted.current && generation.current === mine) {
          setState({ status: 'error', message: 'No se ha podido abrir tu armario.' })
        }
      })
  }, [])

  useEffect(() => {
    mounted.current = true
    read()
    const unsubscribe = wardrobeRepository.subscribe(read)
    return () => {
      mounted.current = false
      unsubscribe()
    }
  }, [read])

  return { ...state, reload: read }
}
