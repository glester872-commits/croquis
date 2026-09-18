import { useEffect, useState } from 'react'

import { defaultProvider } from '@/lib/analysis/provider'
import { outfitRepository } from '@/lib/storage/indexeddb-outfit-repository'
import { StorageError } from '@/lib/storage/outfit-repository'
import type { OutfitAnalysis } from '@/types'

/**
 * Resolves an outfit id to a reading.
 *
 * Reads the row from IndexedDB and gives its photograph a blob URL for
 * the lifetime of the screen. An unknown id is a missing outfit.
 */

export type AnalysisState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly analysis: OutfitAnalysis }
  | { readonly status: 'missing' }
  | { readonly status: 'error'; readonly message: string }

const LOADING: AnalysisState = { status: 'loading' }
const MISSING: AnalysisState = { status: 'missing' }

export function useOutfitAnalysis(id: string | undefined): AnalysisState {
  /* The reading is held against the id it was read for. A different id
     is a different reading, and until that one arrives the screen is
     loading — which the arguments already say, so nothing has to be
     reset on the way in. */
  const [read, setRead] = useState<{ readonly id: string; readonly state: AnalysisState } | null>(
    null,
  )

  useEffect(() => {
    if (!id) return

    let url: string | null = null
    let live = true
    const settle = (state: AnalysisState) => {
      if (live) setRead({ id, state })
    }

    const load = async () => {
      try {
        const stored = await outfitRepository.get(id)
        if (!live) return
        if (!stored) {
          settle(MISSING)
          return
        }

        url = URL.createObjectURL(stored.image)

        // An outfit can exist without a reading: the photograph is
        // saved before the analysis runs, so a failure leaves the
        // picture behind. Produce the reading now.
        let analysis = stored.analysis
        if (!analysis) {
          const result = await defaultProvider.analyze({
            kind: 'upload',
            image: stored.image,
            title: stored.name,
            id: stored.id,
          })
          if (!live) return
          if (result.kind === 'error') {
            settle({ status: 'error', message: result.message })
            return
          }
          analysis = result.analysis
          await outfitRepository.update(stored.id, { analysis })
        }

        settle({
          status: 'ready',
          analysis: {
            ...analysis,
            title: stored.name,
            image: {
              ...analysis.image,
              src: url,
              width: stored.imageWidth,
              height: stored.imageHeight,
            },
          },
        })
      } catch (caught) {
        settle({
          status: 'error',
          message:
            caught instanceof StorageError
              ? caught.message
              : 'No se ha podido abrir este look. Vuelve a intentarlo.',
        })
      }
    }

    void load()

    return () => {
      live = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [id])

  // A screen reached without an id has nothing to open.
  if (!id) return MISSING
  return read && read.id === id ? read.state : LOADING
}
