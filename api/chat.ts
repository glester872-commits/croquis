import Anthropic from '@anthropic-ai/sdk'
import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  ASK_LIMITS,
  type AskContext,
  type AskMessage,
  type AskRequest,
} from '../src/lib/chat/contract'

/**
 * Ask Croquis — the server half.
 *
 * The key lives here and only here: the browser sends a question and
 * the reading it is standing on, and gets text back. Nothing is
 * persisted; the conversation exists in the tab that asked it.
 */

const MODEL = 'claude-opus-5'

/**
 * The voice.
 *
 * Stated as constraints rather than adjectives, because "be editorial"
 * produces the same copy every model produces. The hard rule is the
 * last one: the reading is the only evidence there is, and when it is
 * silent the honest answer is that Croquis did not measure it.
 */
const SYSTEM = `Eres el asistente de Croquis, una herramienta de inteligencia de moda que lee fotografías de outfits.

Actúas como estilista, analista de moda y lector de tendencias a la vez.

Cómo respondes:
- Directo. Primero la respuesta, después el porqué.
- Breve por defecto: dos o tres frases, o una lista corta. Solo te extiendes si te lo piden.
- Nada de halagos genéricos. No abres diciendo que es un gran look.
- Señalas problemas reales de proporción, color o coherencia cuando los haya, sin suavizarlos.
- Das alternativas concretas: una prenda, un tono, una proporción. No categorías vagas.
- Distingues lo medido de lo que recomiendas. Para lo medido puedes decir "la lectura mide…"; para lo tuyo, "yo cambiaría…".
- Español natural. Sin emojis, sin encabezados de markdown, sin negritas decorativas.

Lo que no haces nunca:
- No inventas datos. Si el contexto no trae paleta, prendas, ADN de estilo o tendencias, dices que Croquis no lo ha medido en este look y respondes con lo que sí tengas.
- No te inventas tendencias, marcas, porcentajes de adopción, cifras de ventas ni fechas de previsión. Croquis no publica cifras que no puede respaldar.
- No describes la fotografía como si la vieras: no la ves. Solo tienes la lectura estructurada.
- Si te preguntan algo fuera de moda, estilo, color, silueta, proporción, prendas o tendencias, lo dices en una frase y reconduces.`

/** The reading, rendered as the note the assistant reads before answering. */
function renderContext(context: AskContext): string {
  const lines: string[] = [`Ruta actual: ${context.route}`]

  const outfit = context.outfit
  if (outfit) {
    lines.push('', `LOOK ABIERTO: ${outfit.name}`)
    lines.push(`Fecha: ${outfit.wornAt} · Contexto: ${outfit.context}`)
    if (outfit.notes) lines.push(`Notas del usuario: ${outfit.notes}`)

    if (!outfit.hasAnalysis) {
      lines.push('Este look todavía no tiene lectura: Croquis no ha medido nada de él.')
    }

    if (outfit.palette.length > 0) {
      lines.push(
        'Paleta medida sobre las prendas: ' +
          outfit.palette.map((s) => `${s.name} ${s.hex} (${s.share}%)`).join(', '),
      )
      if (outfit.colourScheme) lines.push(`Esquema de color: ${outfit.colourScheme}`)
    } else {
      lines.push('Paleta: Croquis no ha podido medirla en este look.')
    }

    if (outfit.silhouette) {
      const s = outfit.silhouette
      lines.push(
        `Silueta: ${s.name} — ${s.line}. Proporción superior:inferior ${s.split[0]}:${s.split[1]}. ` +
          `Hombro ${s.shoulder}. Cintura ${s.waist}. Volumen ${s.volume}.`,
      )
    } else {
      lines.push('Silueta y proporciones: no medidas en este look.')
    }

    if (outfit.garments.length > 0) {
      lines.push('Prendas detectadas:')
      for (const g of outfit.garments) {
        const bits = [g.layer, ...g.details, ...g.materials].filter(Boolean)
        lines.push(`- ${g.name}${bits.length ? ` (${bits.join(', ')})` : ''}`)
      }
    } else {
      lines.push('Prendas: ninguna detectada.')
    }

    if (outfit.materials.length > 0) lines.push(`Materiales leídos: ${outfit.materials.join(', ')}`)

    if (outfit.styleDna.length > 0) {
      lines.push(
        'ADN de estilo: ' +
          outfit.styleDna.map((i) => `${i.name} ${i.share}% — ${i.summary}`).join(' | '),
      )
    } else {
      lines.push('ADN de estilo: no medido en este look.')
    }

    if (outfit.trendSignals.length > 0) {
      lines.push(
        'Señales de tendencia: ' +
          outfit.trendSignals
            .map((t) => `${t.name} (${t.stage}) por ${t.signals.join(', ')}`)
            .join(' | '),
      )
    } else {
      lines.push('Señales de tendencia: ninguna detectada en este look.')
    }

    if (outfit.whyItWorks.length > 0) {
      lines.push('Por qué funciona, según la lectura: ' + outfit.whyItWorks.join(' | '))
    }
  }

  const trend = context.trend
  if (trend) {
    lines.push('', `TENDENCIA ABIERTA: ${trend.name} (${trend.stage})`)
    if (trend.visualCodes.length) lines.push(`Códigos visuales: ${trend.visualCodes.join(', ')}`)
    if (trend.keyPieces.length) lines.push(`Piezas clave: ${trend.keyPieces.join(', ')}`)
  }

  if (context.archive && context.archive.length > 0) {
    lines.push('', `Looks en el archivo: ${context.archive.join(', ')}`)
  }

  if (!outfit && !trend) {
    lines.push('', 'No hay ningún look ni tendencia abiertos en esta pantalla.')
  }

  return lines.join('\n')
}

/** Trusts nothing the browser sent: shape, length and count all checked. */
function readRequest(body: unknown): AskRequest | null {
  if (typeof body !== 'object' || body === null) return null
  const raw = body as Partial<AskRequest>
  if (!Array.isArray(raw.messages) || raw.messages.length === 0) return null
  if (typeof raw.context !== 'object' || raw.context === null) return null
  if (typeof (raw.context as AskContext).route !== 'string') return null

  const messages: AskMessage[] = []
  for (const entry of raw.messages.slice(-ASK_LIMITS.maxMessages)) {
    if (typeof entry !== 'object' || entry === null) return null
    const { role, content } = entry as AskMessage
    if (role !== 'user' && role !== 'assistant') return null
    if (typeof content !== 'string' || content.trim().length === 0) return null
    messages.push({ role, content: content.slice(0, ASK_LIMITS.maxCharsPerMessage) })
  }
  if (messages[messages.length - 1]?.role !== 'user') return null

  return { messages, context: raw.context as AskContext }
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ error: 'Método no permitido.' })
  }

  // Shape first: a malformed request is the caller's bug whatever the
  // deployment is configured with, and reporting it as "not configured"
  // sends whoever is debugging it to the wrong place.
  const parsed = readRequest(request.body)
  if (!parsed) return response.status(400).json({ error: 'Petición mal formada.' })

  // Either credential the SDK knows how to resolve. Checked up front so
  // an unconfigured deployment says so instead of failing at the wire.
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    // Said plainly rather than as a 500: this is a deployment that has
    // not been given a key, not a failure the reader can retry past.
    return response
      .status(503)
      .json({ error: 'El asistente no está configurado en este entorno.' })
  }

  try {
    const client = new Anthropic()
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      // Short answers are the brief, so thinking runs shallow: this is a
      // styling read over data already measured, not a hard problem.
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' },
      system: [
        // The voice never changes, so it is the cached prefix; the
        // reading and the question come after it.
        { type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: renderContext(parsed.context) },
      ],
      messages: parsed.messages.map((entry) => ({ role: entry.role, content: entry.content })),
    })

    if (message.stop_reason === 'refusal') {
      return response.status(200).json({ reply: 'No puedo responder a eso.' })
    }

    const reply = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim()

    return response.status(200).json({ reply: reply || 'No he podido formular una respuesta.' })
  } catch (caught) {
    if (caught instanceof Anthropic.AuthenticationError) {
      return response.status(503).json({ error: 'El asistente no está configurado en este entorno.' })
    }
    if (caught instanceof Anthropic.RateLimitError) {
      return response.status(429).json({ error: 'Demasiadas preguntas seguidas. Prueba en un momento.' })
    }
    if (caught instanceof Anthropic.APIError) {
      return response.status(502).json({ error: 'El asistente no ha respondido. Vuelve a intentarlo.' })
    }
    return response.status(500).json({ error: 'Algo ha fallado al preguntar.' })
  }
}
