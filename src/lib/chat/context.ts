import { findTrend } from '@/data/trends'
import { GARMENT_LAYER, TREND_STAGE } from '@/lib/labels'
import { outfitRepository } from '@/lib/storage/indexeddb-outfit-repository'
import { OUTFIT_CONTEXTS } from '@/lib/storage/outfit-repository'
import type { AskContext, AskOutfit, AskTrend } from '@/lib/chat/contract'

/**
 * What the assistant is told, built from what is already on screen.
 *
 * Resolved from the address rather than from every route reporting its
 * own state: the URL already says which look or trend is open, and the
 * repository already holds the reading. Nothing new is stored and no
 * screen has to remember to announce itself.
 *
 * Only measured fields travel. The photograph never does — the reading
 * is structured and complete enough to answer on, and sending the image
 * would be sending the user's own picture to a third party for nothing.
 */

function contextLabel(id: string): string {
  return OUTFIT_CONTEXTS.find((entry) => entry.id === id)?.label ?? 'Otro'
}

async function outfitFor(id: string): Promise<AskOutfit | undefined> {
  const stored = await outfitRepository.get(id).catch(() => undefined)
  if (!stored) return undefined

  const analysis = stored.analysis
  return {
    name: stored.name || 'Look sin título',
    wornAt: stored.wornAt,
    context: contextLabel(stored.context),
    notes: stored.notes,
    hasAnalysis: analysis !== null,
    palette: (analysis?.palette?.swatches ?? []).map((swatch) => ({
      name: swatch.name,
      hex: swatch.hex,
      share: swatch.share,
    })),
    colourScheme: analysis?.palette?.scheme ?? null,
    silhouette: analysis?.silhouette
      ? {
          name: analysis.silhouette.name,
          line: analysis.silhouette.line,
          split: analysis.silhouette.split,
          shoulder: analysis.silhouette.shoulder,
          waist: analysis.silhouette.waist,
          volume: analysis.silhouette.volume,
        }
      : null,
    garments: (analysis?.garments ?? []).map((garment) => ({
      name: garment.name,
      layer: GARMENT_LAYER[garment.layer],
      details: garment.details,
      materials: garment.materials,
    })),
    materials: (analysis?.materials ?? []).map((material) => material.name),
    styleDna: (analysis?.styleDna ?? []).map((influence) => ({
      name: influence.name,
      share: influence.share,
      summary: influence.summary,
    })),
    trendSignals: (analysis?.trendSignals ?? []).map((signal) => ({
      name: signal.trendName,
      stage: TREND_STAGE[signal.stage],
      signals: signal.signals,
    })),
    whyItWorks: (analysis?.whyItWorks ?? []).map((argument) => argument.headline),
  }
}

function trendFor(slug: string): AskTrend | undefined {
  const trend = findTrend(slug)
  if (!trend) return undefined
  return {
    name: trend.name,
    stage: TREND_STAGE[trend.stage],
    visualCodes: trend.visualCodes,
    keyPieces: trend.keyPieces,
  }
}

/** The archive's names only — never its photographs or its readings. */
async function archiveNames(): Promise<readonly string[] | undefined> {
  const outfits = await outfitRepository.list().catch(() => [])
  if (outfits.length === 0) return undefined
  return outfits.slice(0, 40).map((outfit) => outfit.name || 'Look sin título')
}

export async function buildAskContext(pathname: string): Promise<AskContext> {
  const analysisMatch = /^\/analisis\/([^/]+)$/.exec(pathname)
  if (analysisMatch?.[1]) {
    const outfit = await outfitFor(decodeURIComponent(analysisMatch[1]))
    if (outfit) return { route: pathname, outfit }
  }

  const trendMatch = /^\/tendencias\/([^/]+)$/.exec(pathname)
  if (trendMatch?.[1]) {
    const trend = trendFor(decodeURIComponent(trendMatch[1]))
    if (trend) return { route: pathname, trend }
  }

  if (pathname === '/outfits' || pathname === '/') {
    const archive = await archiveNames()
    return archive ? { route: pathname, archive } : { route: pathname }
  }

  return { route: pathname }
}

/**
 * Openers, offered only where they have something to stand on.
 *
 * A suggestion about proportion on a screen with no silhouette read is
 * a question the assistant would have to answer with "no lo he medido",
 * so it is not offered.
 */
export function suggestionsFor(context: AskContext): readonly string[] {
  const outfit = context.outfit
  if (outfit) {
    const asks: string[] = []
    if (outfit.hasAnalysis) asks.push('¿Cómo mejorarías este look?')
    if (outfit.silhouette) asks.push('¿Qué cambiarías en las proporciones?')
    if (outfit.palette.length > 0) asks.push('¿Funciona esta paleta?')
    if (outfit.garments.length > 0) asks.push('¿Con qué calzado funcionaría mejor?')
    if (outfit.trendSignals.length > 0) asks.push('¿Qué tendencia representa?')
    return asks.slice(0, 4)
  }

  if (context.trend) {
    return ['¿Qué define esta tendencia?', '¿A quién le favorece?']
  }

  if (context.archive && context.archive.length > 1) {
    return ['¿Qué repito en mi archivo?']
  }

  return []
}
