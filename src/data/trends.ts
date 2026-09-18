import type { Trend } from '@/types'

/**
 * Trend records.
 *
 * Visual codes, origin and cultural context only. No growth rates,
 * search volumes, market share, sales figures, adoption percentages or
 * forecast dates: there is no data source for them. Every assertion is
 * a Claim typed by what kind of knowledge it is.
 */

const ASOF = '2026-09-01'

const VOGUE_UTILITY = {
  id: 'src-utility',
  title: 'La estética utilitaria en la moda contemporánea',
  publisher: 'Documentación editorial de referencia',
  retrievedAt: ASOF,
} as const

function sourced(statement: string, confidence: 'low' | 'moderate' | 'high' = 'moderate') {
  return {
    id: `trend-claim-${statement.slice(0, 12).replace(/\W/g, '')}`,
    kind: 'supported' as const,
    statement,
    confidence,
    evidence: [],
    sources: [VOGUE_UTILITY],
    asOf: ASOF,
  }
}

function reading(statement: string, confidence: 'low' | 'moderate' | 'high' = 'moderate') {
  return {
    id: `trend-read-${statement.slice(0, 12).replace(/\W/g, '')}`,
    kind: 'interpretation' as const,
    statement,
    confidence,
    evidence: [],
    sources: [],
    asOf: ASOF,
  }
}

const quietUtility: Trend = {
  slug: 'utilidad-silenciosa',
  name: 'Utilidad silenciosa',
  stage: 'diffusion',
  origin: sourced(
    'La silueta procede de la ropa de trabajo europea de mediados del siglo XX: el chore coat francés y el mono de faena, cuyos bolsillos de parche y hombro caído se diseñaron para moverse, no para vestir.',
    'high',
  ),
  visualCodes: [
    'Bolsillos de parche a la vista',
    'Hombro caído sin estructura',
    'Paleta tonal, sin contraste de color',
    'Herrajes mates',
    'Volumen holgado en la parte inferior',
  ],
  keyPieces: ['Sobrecamisa', 'Pantalón de faena de pierna ancha', 'Chaleco modular', 'Bota o zapatilla de suela gruesa'],
  culturalContext: [
    {
      id: 'ctx-work',
      domain: 'economy',
      title: 'El trabajo como estética, no como oficio',
      description:
        'La ropa de trabajo llega al armario urbano cuando el trabajo manual deja de ser mayoritario en las ciudades donde se lleva. La prenda conserva la forma de la función y pierde su uso.',
      claim: reading(
        'La adopción de códigos utilitarios en contextos donde no hay función que cumplir sugiere que lo que se busca es la credibilidad de la prenda, no su prestación.',
      ),
    },
  ],
  brands: [
    { id: 'b-lead', name: 'Casas de sastrería contemporánea', tier: 'leading', note: 'Introducen el corte utilitario en tejidos de traje.' },
    { id: 'b-interp', name: 'Marcas de autor europeas', tier: 'interpreting', note: 'Reducen la paleta y eliminan el logotipo.' },
    { id: 'b-mass', name: 'Cadenas de gran distribución', tier: 'mass-adoption', note: 'Replican el bolsillo de parche sobre tejidos ligeros.' },
  ],
  timeline: [
    {
      id: 't-origin',
      period: 'Origen',
      title: 'Ropa de faena europea',
      description: 'El chore coat y el mono de trabajo fijan la silueta: hombro caído, bolsillos frontales, tejido resistente.',
      claim: sourced('La forma actual desciende directamente de prendas de trabajo, no de uniformes militares.', 'high'),
    },
    {
      id: 't-now',
      period: 'Ahora',
      title: 'Difusión tonal',
      description: 'El código se ha separado de su origen: se lleva en conjunto tonal, sin contraste ni herrajes visibles.',
      claim: reading('La fase tonal suele indicar que un código ha dejado de leerse como subcultural.'),
    },
  ],
  relatedSlugs: ['vestir-tonal'],
  nextSignals: [
    reading(
      'Si el código sigue difundiéndose, lo esperable es que el detalle utilitario se reduzca a la costura y desaparezca el bolsillo aplicado. Es una lectura, no una previsión con datos detrás.',
      'low',
    ),
  ],
  retail: {
    commercialRead: reading(
      'La prenda funciona comercialmente porque se lee como básica y como pieza de autor al mismo tiempo, lo que le permite convivir con precios muy distintos.',
    ),
    targetConsumer: reading(
      'Consumidor que compra por construcción y no por logotipo, y que sustituye piezas con poca frecuencia.',
    ),
    pricePositioning: reading(
      'Se sostiene en un rango amplio porque el valor percibido está en el tejido y el corte, no en la identificación de marca.',
    ),
    retailPotential: reading('Alta reposición en tonos neutros; baja en colores de temporada.', 'low'),
    adoptionBarriers: [
      reading('El volumen holgado exige probador: es una silueta difícil de vender sin prueba física.'),
    ],
    merchandisingOpportunities: [
      reading('Presentación por conjunto tonal completo antes que por prenda suelta.'),
    ],
  },
}

const tonalDressing: Trend = {
  slug: 'vestir-tonal',
  name: 'Vestir tonal',
  stage: 'peak',
  origin: sourced(
    'El recurso procede de la sastrería, donde la coordinación tonal se emplea para alargar visualmente la figura sin interrumpir la línea vertical.',
    'high',
  ),
  visualCodes: ['Una sola familia de tono', 'Contraste bajo', 'La textura sustituye al color', 'Línea vertical sin corte'],
  keyPieces: ['Conjunto de dos piezas', 'Punto en el mismo tono', 'Calzado dentro de la paleta'],
  culturalContext: [
    {
      id: 'ctx-tonal',
      domain: 'design',
      title: 'Reducción como señal',
      description: 'Cuando el color deja de comunicar, la lectura se desplaza al material y a la construcción.',
      claim: reading('El vestir tonal traslada la atención del color a la calidad del tejido, lo que exige mejor tejido.'),
    },
  ],
  brands: [
    { id: 'bt-lead', name: 'Casas minimalistas', tier: 'leading', note: 'Colecciones completas dentro de un mismo tono.' },
    { id: 'bt-emerging', name: 'Marcas de punto de autor', tier: 'emerging', note: 'Trabajan la variación por textura.' },
  ],
  timeline: [
    {
      id: 'tt-now',
      period: 'Ahora',
      title: 'Máxima presencia',
      description: 'El conjunto tonal es una de las construcciones más repetidas en street style contemporáneo.',
      claim: reading('Su presencia sostenida sugiere una fase de madurez, no de emergencia.'),
    },
  ],
  relatedSlugs: ['utilidad-silenciosa'],
  nextSignals: [
    reading('El siguiente movimiento probable es la reintroducción de un único acento de color. Lectura, sin datos detrás.', 'low'),
  ],
  retail: {
    commercialRead: reading('Favorece la venta cruzada: el conjunto se compra completo con más frecuencia que la pieza suelta.'),
    targetConsumer: reading('Consumidor que construye armario por coordinación, no por pieza destacada.'),
    pricePositioning: reading('Sensible a la calidad del tejido, porque no hay color que distraiga de él.'),
    retailPotential: reading('Depende por completo de la fidelidad del tono entre prendas distintas.', 'low'),
    adoptionBarriers: [reading('Dos prendas del mismo tono nominal rara vez coinciden, y la diferencia se ve.')],
    merchandisingOpportunities: [reading('Exposición por familia de tono en lugar de por tipo de prenda.')],
  },
}

export const trends: readonly Trend[] = [quietUtility, tonalDressing]

export function findTrend(slug: string): Trend | undefined {
  return trends.find((trend) => trend.slug === slug)
}
