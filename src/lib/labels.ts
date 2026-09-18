import type {
  BrandTier,
  BreakdownCategory,
  CulturalDomain,
  DesignPrinciple,
  GarmentLayer,
  TrendStage,
} from '@/types'

/**
 * Spanish labels for the data model's union keys.
 *
 * The unions in `types` stay in English because they are keys: they end
 * up in stored records and in comparisons. Anything a person reads is
 * looked up here, so a key can never reach the screen.
 */

export const GARMENT_LAYER: Record<GarmentLayer, string> = {
  base: 'primera capa',
  mid: 'capa media',
  outer: 'capa exterior',
  lower: 'parte inferior',
  footwear: 'calzado',
  accessory: 'accesorio',
}

export const TREND_STAGE: Record<TrendStage, string> = {
  emergence: 'Emergencia',
  adoption: 'Adopción',
  peak: 'Máxima presencia',
  diffusion: 'Difusión',
  decline: 'Retirada',
}

export const DESIGN_PRINCIPLE: Record<DesignPrinciple, string> = {
  balance: 'equilibrio',
  rhythm: 'ritmo',
  contrast: 'contraste',
  repetition: 'repetición',
  proportion: 'proporción',
  hierarchy: 'jerarquía',
  'focal-point': 'punto focal',
  'colour-harmony': 'armonía de color',
  texture: 'textura',
  silhouette: 'silueta',
  layering: 'superposición',
}

export const BRAND_TIER: Record<BrandTier, string> = {
  leading: 'Marcan la dirección',
  interpreting: 'La interpretan',
  'mass-adoption': 'Gran distribución',
  emerging: 'Emergentes',
}

export const CULTURAL_DOMAIN: Record<CulturalDomain, string> = {
  music: 'Música',
  art: 'Arte',
  film: 'Cine',
  sport: 'Deporte',
  technology: 'Tecnología',
  economy: 'Economía',
  internet: 'Internet',
  subculture: 'Subcultura',
  youth: 'Juventud',
  celebrity: 'Personajes públicos',
  design: 'Diseño',
  city: 'Ciudad',
}

export const BREAKDOWN_CATEGORY: Record<BreakdownCategory, string> = {
  silhouette: 'Silueta',
  proportions: 'Proporciones',
  garments: 'Prendas',
  colour: 'Sistema de color',
  materials: 'Materiales',
  textures: 'Texturas',
  layering: 'Superposición',
  footwear: 'Calzado',
  accessories: 'Accesorios',
  styling: 'Estilismo',
}
