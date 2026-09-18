import type { OutfitAnalysis } from '@/types'

/**
 * Where a user's outfits live.
 *
 * The UI only talks to this interface, so the browser-local
 * implementation behind it can be replaced by a hosted backend without
 * a component changing.
 */

export type OutfitContext =
  | 'diario'
  | 'trabajo'
  | 'streetwear'
  | 'evento'
  | 'editorial'
  | 'otro'

export const OUTFIT_CONTEXTS: readonly { id: OutfitContext; label: string }[] = [
  { id: 'diario', label: 'Diario' },
  { id: 'trabajo', label: 'Trabajo' },
  { id: 'streetwear', label: 'Streetwear' },
  { id: 'evento', label: 'Evento' },
  { id: 'editorial', label: 'Editorial' },
  { id: 'otro', label: 'Otro' },
]

/** What the library lists: everything but the photograph itself. */
export interface OutfitSummary {
  readonly id: string
  readonly name: string
  readonly context: OutfitContext
  readonly notes: string
  /** ISO date the record was created. */
  readonly createdAt: string
  /** ISO date the look was worn, as given by the user. */
  readonly wornAt: string
  readonly imageWidth: number
  readonly imageHeight: number
  readonly hasAnalysis: boolean
  /** ISO date the reading was produced, if there is one. */
  readonly analysedAt: string | null
  /**
   * Display metadata lifted out of the analysis so a list never has to
   * load a full row to label itself. Empty when the reading does not
   * contain it — nothing here is filled in with a guess.
   */
  readonly styleDna: readonly string[]
  readonly trend: string | null
  /** Small copy for the grid. The original never reaches a list. */
  readonly thumbnail: Blob
}

/** A summary plus the photograph, as stored. */
export interface StoredOutfit extends OutfitSummary {
  readonly image: Blob
  /**
   * The reading, if one has been produced. Its `image.src` is empty on
   * disk — a blob URL is not a durable reference, so it is attached at
   * read time and revoked by whoever displayed it.
   */
  readonly analysis: OutfitAnalysis | null
}

export interface NewOutfit {
  readonly name: string
  readonly context: OutfitContext
  readonly notes: string
  readonly wornAt: string
  readonly image: Blob
  readonly imageWidth: number
  readonly imageHeight: number
  readonly thumbnail: Blob
}

/** Fields the user can change after the fact. */
export interface OutfitPatch {
  readonly name?: string
  readonly context?: OutfitContext
  readonly notes?: string
  readonly wornAt?: string
  readonly analysis?: OutfitAnalysis | null
}

export interface OutfitRepository {
  /** Newest first. */
  list(): Promise<readonly OutfitSummary[]>
  /**
   * Called after every write, so a surface showing outfits can reload
   * without the surface that changed them knowing it exists. Returns
   * the unsubscribe.
   */
  subscribe(listener: () => void): () => void
  get(id: string): Promise<StoredOutfit | undefined>
  save(outfit: NewOutfit): Promise<OutfitSummary>
  update(id: string, patch: OutfitPatch): Promise<void>
  remove(id: string): Promise<void>
}

/**
 * Thrown for anything the user needs to be told about in words. The
 * message is Spanish and actionable, because it is what reaches the
 * screen — "Something went wrong" is never acceptable.
 */
export class StorageError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'StorageError'
  }
}
