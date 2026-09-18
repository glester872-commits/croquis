/**
 * Croquis data model.
 *
 * No `any`. Every assertion carries its epistemic status, its evidence
 * and its provenance.
 */

/** How much weight a claim carries. Never rendered as a percentage. */
export type Confidence = 'low' | 'moderate' | 'high'

/**
 * The three kinds of knowledge, kept strictly apart. The colour system
 * encodes them: inference = slate blue, interpretation = terracotta,
 * supported = bone plus a source chip.
 */
export type KnowledgeKind =
  /** Readable from the photograph itself. Must point at a Region. */
  | 'visual-inference'
  /** Backed by a citable Source. Must carry at least one. */
  | 'supported'
  /** A reasoned reading or hypothesis. Never presented as fact. */
  | 'interpretation'

export interface Source {
  readonly id: string
  readonly title: string
  readonly publisher: string
  readonly url?: string
  /** ISO date the source was consulted. */
  readonly retrievedAt: string
}

/**
 * A rectangle on the photograph, normalised 0-1 against the image box.
 * Regions are data, never CSS: a vision model returns them unchanged.
 */
export interface Region {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** A point on the photograph, normalised 0-1. Anchors leader lines. */
export interface Anchor {
  readonly x: number
  readonly y: number
}

/** What in the picture supports a claim. */
export interface Evidence {
  readonly id: string
  /** What is visible, stated plainly. */
  readonly observation: string
  readonly region?: Region
  readonly anchor?: Anchor
}

/**
 * Every assertion the product makes is a Claim, carrying what kind of
 * knowledge it is, its evidence and its provenance.
 */
export interface Claim {
  readonly id: string
  readonly kind: KnowledgeKind
  readonly statement: string
  readonly confidence: Confidence
  readonly evidence: readonly Evidence[]
  readonly sources: readonly Source[]
  /** ISO date this reading was produced. */
  readonly asOf: string
}

/* ── the look itself ─────────────────────────────────────────────── */

export type GarmentLayer = 'base' | 'mid' | 'outer' | 'lower' | 'footwear' | 'accessory'

/**
 * A garment seen in a photograph, read as one the user owns.
 *
 * Resolving what is in a frame to what is in a wardrobe is a reading,
 * never a fact: two black crew necks photograph the same. The match
 * therefore carries its own interpretation claim and can be wrong in
 * the open, and an itemId alone is never enough to render a name.
 */
export interface GarmentMatch {
  /** Identifies a stored wardrobe item. */
  readonly itemId: string
  readonly claim: Claim
}

export interface Garment {
  readonly id: string
  readonly name: string
  readonly layer: GarmentLayer
  readonly region: Region
  readonly anchor: Anchor
  /** Construction details actually visible in the frame. */
  readonly details: readonly string[]
  readonly materials: readonly string[]
  /** The wardrobe item this is read as, if any. Null is the default. */
  readonly match: GarmentMatch | null
  readonly claim: Claim
}

export interface Silhouette {
  readonly name: string
  readonly line: string
  /** Upper : lower split as read off the frame, e.g. [45, 55]. */
  readonly split: readonly [number, number]
  readonly shoulder: string
  readonly waist: string
  readonly volume: string
  readonly claim: Claim
}

export interface ColorSwatch {
  readonly hex: string
  readonly name: string
  /** Share of the look, 0-100. Read from the frame, not measured. */
  readonly share: number
  readonly region?: Region
}

export interface ColorPalette {
  /** How the hues relate, in plain language. */
  readonly scheme: string
  readonly swatches: readonly ColorSwatch[]
  /** Measured, not estimated: 'bajo' | 'medio' | 'alto'. */
  readonly contrast: string
  /** WCAG ratio between the lightest and darkest dominant colour. */
  readonly contrastRatio: number
  readonly temperature: string
  readonly claim: Claim
}

/**
 * How the outfit was separated from the background before its colour
 * was measured. Travels with the palette so the isolation behind a
 * reading can always be inspected.
 */
export type SegmentationKind =
  /** No isolation at all. The palette would be a histogram of the frame. */
  | 'none'
  /** Background estimated from the frame's own corners and edges. */
  | 'heuristic-background'
  /** A person / garment segmentation model. */
  | 'model'

export interface SegmentationReport {
  readonly kind: SegmentationKind
  /** The analysed region drawn over the photograph, as a data URL. */
  readonly preview: string
  /** Share of the frame taken as person, and as garment, 0-1. */
  readonly subjectShare: number
  readonly garmentShare: number
  /** How well the isolation is believed to have worked, 0-1. */
  readonly confidence: number
  /** What limited it, in Spanish, for the interface to show. */
  readonly notes: readonly string[]
}

export interface Material {
  readonly id: string
  readonly name: string
  readonly finish: string
  readonly weight: string
  readonly region: Region
  readonly claim: Claim
}

/* ── reading the look ────────────────────────────────────────────── */

export interface StyleInfluence {
  readonly id: string
  readonly name: string
  /** Share of the read, 0-100. Sums to 100 across the set. */
  readonly share: number
  readonly summary: string
  /** Which garments produce this association. Garment ids. */
  readonly drivenBy: readonly string[]
  readonly visualCodes: readonly string[]
  readonly historicalContext: string
  readonly claim: Claim
}

/** A named design principle the look uses, pointed at real evidence. */
export type DesignPrinciple =
  | 'balance'
  | 'rhythm'
  | 'contrast'
  | 'repetition'
  | 'proportion'
  | 'hierarchy'
  | 'focal-point'
  | 'colour-harmony'
  | 'texture'
  | 'silhouette'
  | 'layering'

export interface WorkingArgument {
  readonly id: string
  readonly principle: DesignPrinciple
  readonly headline: string
  readonly claim: Claim
}

/* ── trends ──────────────────────────────────────────────────────── */

export type TrendStage =
  | 'emergence'
  | 'adoption'
  | 'peak'
  | 'diffusion'
  | 'decline'

export interface TrendSignal {
  readonly trendSlug: string
  readonly trendName: string
  readonly stage: TrendStage
  /** The specific things in this look that raised the signal. */
  readonly signals: readonly string[]
  readonly claim: Claim
}

export interface TrendTimelineEvent {
  readonly id: string
  readonly period: string
  readonly title: string
  readonly description: string
  readonly claim: Claim
}

export type BrandTier = 'leading' | 'interpreting' | 'mass-adoption' | 'emerging'

export interface BrandPosition {
  readonly id: string
  readonly name: string
  readonly tier: BrandTier
  readonly note: string
}

export type CulturalDomain =
  | 'music' | 'art' | 'film' | 'sport' | 'technology'
  | 'economy' | 'internet' | 'subculture' | 'youth'
  | 'celebrity' | 'design' | 'city'

export interface CulturalReference {
  readonly id: string
  readonly domain: CulturalDomain
  readonly title: string
  readonly description: string
  readonly claim: Claim
}

export interface RetailInterpretation {
  readonly commercialRead: Claim
  readonly targetConsumer: Claim
  readonly pricePositioning: Claim
  readonly retailPotential: Claim
  readonly adoptionBarriers: readonly Claim[]
  readonly merchandisingOpportunities: readonly Claim[]
}

export interface Trend {
  readonly slug: string
  readonly name: string
  readonly stage: TrendStage
  readonly origin: Claim
  readonly visualCodes: readonly string[]
  readonly keyPieces: readonly string[]
  readonly culturalContext: readonly CulturalReference[]
  readonly brands: readonly BrandPosition[]
  readonly timeline: readonly TrendTimelineEvent[]
  readonly relatedSlugs: readonly string[]
  readonly nextSignals: readonly Claim[]
  readonly retail: RetailInterpretation
}

/* ── the analysis ────────────────────────────────────────────────── */

/** The ten breakdown categories, in reading order. */
export type BreakdownCategory =
  | 'silhouette' | 'proportions' | 'garments' | 'colour' | 'materials'
  | 'textures' | 'layering' | 'footwear' | 'accessories' | 'styling'

export interface BreakdownSection {
  readonly category: BreakdownCategory
  readonly label: string
  /** The region of the photograph this section is about. */
  readonly region: Region
  readonly reading: string
  readonly claims: readonly Claim[]
}

export interface OutfitImage {
  readonly src: string
  readonly alt: string
  readonly width: number
  readonly height: number
  /** Attribution shown under the photograph. */
  readonly credit: string
}

/**
 * A reading of one outfit.
 *
 * Every field that requires a garment-aware model is nullable, and
 * null is a first-class answer the interface renders as such.
 * `palette` is nullable too: colour is arithmetic, but something still
 * has to decide which pixels are the outfit, and that decision can
 * fail. A component therefore cannot render a silhouette that was
 * never read, nor a palette that was never isolated.
 */
export interface OutfitAnalysis {
  readonly id: string
  readonly title: string
  readonly image: OutfitImage
  readonly analysedAt: string
  /** Which provider produced this, so a stored reading stays traceable. */
  readonly providerId: string

  /**
   * Measured off the garments, not off the frame. Null when they could
   * not be isolated from the background well enough to measure.
   */
  readonly palette: ColorPalette | null
  /** How the outfit was isolated, and how well. Null if never tried. */
  readonly segmentation: SegmentationReport | null

  readonly silhouette: Silhouette | null
  readonly garments: readonly Garment[]
  readonly materials: readonly Material[]
  readonly breakdown: readonly BreakdownSection[]
  readonly styleDna: readonly StyleInfluence[]
  readonly whyItWorks: readonly WorkingArgument[]
  readonly trendSignals: readonly TrendSignal[]
}

export type AnalysisPhase =
  | { readonly status: 'idle' }
  | { readonly status: 'reading'; readonly step: string; readonly progress: number }
  | { readonly status: 'done'; readonly analysis: OutfitAnalysis }
  | { readonly status: 'error'; readonly message: string }
