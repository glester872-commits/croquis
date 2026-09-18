import { findTrend } from '@/data/trends'
import type { Claim, OutfitAnalysis, SegmentationKind, SegmentationReport, Trend } from '@/types'

/**
 * The interface between the UI and whatever produces a reading.
 *
 * Components never learn which implementation is behind it, so a
 * vision model or a retrieval layer can be swapped in without touching
 * one. Readings the current provider cannot produce come back null.
 */

/** A reading is always produced from a photograph the user added. */
export interface AnalysisSource {
  readonly kind: 'upload'
  readonly image: Blob
  readonly title: string
  /** Stable id, so a stored look keeps the same reading id. */
  readonly id: string
}

export interface AnalysisProgress {
  readonly step: string
  /** 0-1. */
  readonly progress: number
}

export type AnalysisResult =
  | { readonly kind: 'analysis'; readonly analysis: OutfitAnalysis }
  | { readonly kind: 'error'; readonly message: string }

export interface AnalyzeOptions {
  readonly signal?: AbortSignal
  readonly onProgress?: (progress: AnalysisProgress) => void
}

export interface FashionAnalysisProvider {
  readonly id: string
  /** Whether this provider can read anything beyond measured colour. */
  readonly canInterpret: boolean
  /** The steps it actually performs, in order. */
  readonly steps: readonly string[]
  /**
   * How this provider isolates the outfit before measuring its colour.
   * With 'none' the palette would describe the whole frame.
   */
  readonly segmentation: SegmentationKind
  analyze(source: AnalysisSource, options?: AnalyzeOptions): Promise<AnalysisResult>
  getTrend(slug: string): Promise<Trend | undefined>
}

export class AbortError extends Error {
  constructor() {
    super('Análisis cancelado')
    this.name = 'AbortError'
  }
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AbortError())
      return
    }
    const onAbort = () => {
      clearTimeout(timer)
      reject(new AbortError())
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/** The steps this provider performs, in order. */
const MEASURED_STEPS: readonly string[] = [
  'Decodificando la fotografía',
  'Agrupando los tonos dominantes',
  'Midiendo contraste, claridad y temperatura',
]

let claimSeq = 0

/** Colour is measured, so its claim carries evidence, not a hedge. */
function measuredClaim(statement: string, observations: readonly string[]): Claim {
  claimSeq += 1
  return {
    id: `claim-colour-${claimSeq}`,
    kind: 'visual-inference',
    statement,
    confidence: 'high',
    evidence: observations.map((observation, index) => ({
      id: `ev-colour-${claimSeq}-${index}`,
      observation,
    })),
    sources: [],
    asOf: new Date().toISOString().slice(0, 10),
  }
}

export class MeasuredFashionAnalysisProvider implements FashionAnalysisProvider {
  readonly id = 'measured-local'
  /** No model is connected, so nothing beyond colour is interpreted. */
  readonly canInterpret = false

  readonly steps = MEASURED_STEPS
  readonly segmentation: SegmentationKind = 'heuristic-background'

  async analyze(source: AnalysisSource, options: AnalyzeOptions = {}): Promise<AnalysisResult> {
    const { signal, onProgress } = options

    try {
      const step = (index: number) =>
        onProgress?.({
          step: MEASURED_STEPS[index] ?? '',
          progress: index / MEASURED_STEPS.length,
        })

      step(0)
      await delay(120, signal)

      step(1)
      // Loaded here rather than at the top of the module: segmentation
      // and colour measurement are some 800 lines that only a reading
      // needs, and a static import pulled them into every surface that
      // so much as touched this provider — the home screen included.
      const { analyseOutfitColour } = await import('./measure-colour')
      // Isolate first, measure second.
      const read = await analyseOutfitColour(source.image)
      if (signal?.aborted) throw new AbortError()

      step(2)
      await delay(120, signal)

      onProgress?.({ step: 'Medida terminada', progress: 1 })

      const segmentation: SegmentationReport = {
        kind: 'heuristic-background',
        preview: read.segmentation.preview,
        subjectShare: read.segmentation.subjectShare,
        garmentShare: read.segmentation.garmentShare,
        confidence: read.segmentation.confidence,
        notes: read.segmentation.notes,
      }

      const measured = read.palette
      const dominant = measured?.swatches[0]

      const analysis: OutfitAnalysis = {
        id: source.id,
        title: source.title,
        analysedAt: new Date().toISOString(),
        providerId: this.id,
        image: {
          // Attached by whoever displays it: a blob URL is not durable.
          src: '',
          alt: `Fotografía del look ${source.title}`,
          width: read.width,
          height: read.height,
          credit: 'Tu fotografía',
        },
        segmentation,
        // Null when the outfit could not be isolated from the room.
        palette:
          measured && dominant
            ? {
                scheme: measured.harmony,
                swatches: measured.swatches,
                contrast: measured.contrast,
                contrastRatio: measured.contrastRatio,
                temperature: measured.temperature,
                claim: measuredClaim(
                  `En las prendas aisladas el tono dominante es ${dominant.name.toLowerCase()} y ocupa el ${dominant.share}% de esa superficie. El contraste entre el color más claro y el más oscuro es ${measured.contrast}, ${measured.contrastRatio}:1, y la temperatura general es ${measured.temperature}.`,
                  [
                    'Medido solo sobre la región de prendas, con el fondo excluido',
                    `Superficie analizada: ${Math.round(read.segmentation.garmentShare * 100)}% del encuadre, ${measured.sampled} píxeles muestreados`,
                    `Relación entre tonos: ${measured.harmony.toLowerCase()}`,
                  ],
                ),
              }
            : null,
        // Everything below requires a garment-aware model.
        silhouette: null,
        garments: [],
        materials: [],
        breakdown: [],
        styleDna: [],
        whyItWorks: [],
        trendSignals: [],
      }

      return { kind: 'analysis', analysis }
    } catch (error) {
      if (error instanceof AbortError) throw error
      return {
        kind: 'error',
        message:
          'No se ha podido leer esta imagen. Prueba a exportarla de nuevo como JPEG o PNG.',
      }
    }
  }

  async getTrend(slug: string): Promise<Trend | undefined> {
    return findTrend(slug)
  }
}

export const defaultProvider: FashionAnalysisProvider = new MeasuredFashionAnalysisProvider()
