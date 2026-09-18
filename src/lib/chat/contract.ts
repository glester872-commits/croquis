/**
 * The wire contract between the panel and `/api/chat`.
 *
 * Shared so the browser and the function cannot drift apart, and kept
 * free of anything secret: the system prompt and the key live only in
 * the function.
 *
 * Every field here is lifted from a reading Croquis already produced.
 * Nothing is composed, and an absent field is absent rather than
 * filled in — the assistant is told to say so instead of inventing it.
 */

export interface AskMessage {
  readonly role: 'user' | 'assistant'
  readonly content: string
}

/** A tone measured off the garments, as the palette stores it. */
export interface AskSwatch {
  readonly name: string
  readonly hex: string
  /** Share of the look, 0-100. */
  readonly share: number
}

export interface AskGarment {
  readonly name: string
  /** The layer it occupies, in Spanish, as the interface labels it. */
  readonly layer: string
  readonly details: readonly string[]
  readonly materials: readonly string[]
}

export interface AskInfluence {
  readonly name: string
  /** Share of the read, 0-100. */
  readonly share: number
  readonly summary: string
}

export interface AskSilhouette {
  readonly name: string
  readonly line: string
  /** Upper : lower, as read off the frame. */
  readonly split: readonly [number, number]
  readonly shoulder: string
  readonly waist: string
  readonly volume: string
}

export interface AskTrendSignal {
  readonly name: string
  readonly stage: string
  readonly signals: readonly string[]
}

/** One look, as much of it as the archive actually holds. */
export interface AskOutfit {
  readonly name: string
  /** ISO date the look was worn. */
  readonly wornAt: string
  readonly context: string
  readonly notes: string
  readonly hasAnalysis: boolean
  readonly palette: readonly AskSwatch[]
  /** How the palette reads as a scheme, when one was named. */
  readonly colourScheme: string | null
  readonly silhouette: AskSilhouette | null
  readonly garments: readonly AskGarment[]
  readonly materials: readonly string[]
  readonly styleDna: readonly AskInfluence[]
  readonly trendSignals: readonly AskTrendSignal[]
  /** Why the look works, as the reading argued it. */
  readonly whyItWorks: readonly string[]
}

/** A trend record, when the reader is standing on one. */
export interface AskTrend {
  readonly name: string
  readonly stage: string
  readonly visualCodes: readonly string[]
  readonly keyPieces: readonly string[]
}

/**
 * What the assistant is told about where the reader is standing.
 *
 * Only `route` is always present. Everything else appears when the
 * screen actually has it.
 */
export interface AskContext {
  readonly route: string
  readonly outfit?: AskOutfit
  readonly trend?: AskTrend
  /** Names of the looks in the archive, for questions about the set. */
  readonly archive?: readonly string[]
}

export interface AskRequest {
  readonly messages: readonly AskMessage[]
  readonly context: AskContext
}

export interface AskResponse {
  readonly reply: string
}

export interface AskError {
  readonly error: string
}

/** Caps, enforced on both sides so a bad client cannot run up a bill. */
export const ASK_LIMITS = {
  /** Turns kept and sent. Older ones drop off the front. */
  maxMessages: 20,
  maxCharsPerMessage: 2000,
} as const
