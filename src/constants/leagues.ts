// ─── LEAGUE RANKING SYSTEM ────────────────────────────────────────────────────
// Comprehensive league ranking for player development and transfer analysis
// Based on: UEFA coefficients, market value, transfer activity, player development quality

export interface LeagueInfo {
  name: string
  country: string
  tier: 1 | 2 | 3 | 4 | 5 | 6
  tierName: string
  avgSalary: string // Estimated average annual salary for starters
  marketValue: string // Total league market value
  transferActivity: 'very_high' | 'high' | 'medium' | 'low'
  developmentScore: number // 1-100, how good for young player development
  exposureScore: number // 1-100, international visibility
  nextStepLeagues: string[] // Natural progression leagues
  description: string
  flag: string
}

// Tier descriptions
export const TIER_INFO: Record<number, { name: string; color: string; bgColor: string; description: string }> = {
  1: {
    name: 'Elite',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    description: 'Las 5 grandes ligas europeas. Máximo nivel competitivo y económico mundial.',
  },
  2: {
    name: 'Top Europa',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    description: 'Ligas europeas con participación regular en UEFA. Excelente trampolín hacia la elite.',
  },
  3: {
    name: 'Europa / Norteamérica',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    description: 'Ligas competitivas con buena proyección. Puerta de entrada a Europa top.',
  },
  4: {
    name: 'Top Sudamérica',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    description: 'Las mejores ligas sudamericanas. Alta competitividad, cantera de talentos.',
  },
  5: {
    name: 'Sudamérica',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    description: 'Ligas sudamericanas con buen nivel. Oportunidad de crecimiento.',
  },
  6: {
    name: 'Desarrollo',
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-gray-800/50',
    description: 'Ligas de desarrollo o segundas divisiones. Primeros pasos profesionales.',
  },
}

// League database with comprehensive information
export const LEAGUES: Record<string, LeagueInfo> = {
  // ─── TIER 1: ELITE (Big 5) ───────────────────────────────────────────────────
  'Premier League': {
    name: 'Premier League',
    country: 'Inglaterra',
    tier: 1,
    tierName: 'Elite',
    avgSalary: '€4-6M/año',
    marketValue: '€11.2B',
    transferActivity: 'very_high',
    developmentScore: 85,
    exposureScore: 100,
    nextStepLeagues: [],
    description: 'La liga más rica y competitiva del mundo. Máxima exposición mediática global.',
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  },
  'LaLiga': {
    name: 'LaLiga',
    country: 'España',
    tier: 1,
    tierName: 'Elite',
    avgSalary: '€2-4M/año',
    marketValue: '€5.1B',
    transferActivity: 'very_high',
    developmentScore: 90,
    exposureScore: 95,
    nextStepLeagues: ['Premier League'],
    description: 'Liga técnica por excelencia. Ideal para jugadores sudamericanos por idioma y estilo.',
    flag: '🇪🇸',
  },
  'Serie A': {
    name: 'Serie A',
    country: 'Italia',
    tier: 1,
    tierName: 'Elite',
    avgSalary: '€1.5-3M/año',
    marketValue: '€4.8B',
    transferActivity: 'high',
    developmentScore: 88,
    exposureScore: 90,
    nextStepLeagues: ['Premier League', 'LaLiga'],
    description: 'Liga táctica, defensivamente exigente. Excelente escuela para defensores.',
    flag: '🇮🇹',
  },
  'Bundesliga': {
    name: 'Bundesliga',
    country: 'Alemania',
    tier: 1,
    tierName: 'Elite',
    avgSalary: '€1.5-3M/año',
    marketValue: '€4.5B',
    transferActivity: 'high',
    developmentScore: 95,
    exposureScore: 88,
    nextStepLeagues: ['Premier League', 'LaLiga'],
    description: 'La mejor liga para desarrollo juvenil. Excelente infraestructura y filosofía.',
    flag: '🇩🇪',
  },
  'Ligue 1': {
    name: 'Ligue 1',
    country: 'Francia',
    tier: 1,
    tierName: 'Elite',
    avgSalary: '€1-2.5M/año',
    marketValue: '€3.8B',
    transferActivity: 'high',
    developmentScore: 92,
    exposureScore: 82,
    nextStepLeagues: ['Premier League', 'LaLiga', 'Serie A'],
    description: 'Gran cantera de talentos. Liga física y técnica. Puente hacia las top ligas.',
    flag: '🇫🇷',
  },

  // ─── TIER 2: PRIMERA LINEA EUROPEA ────────────────────────────────────────────
  'Eredivisie': {
    name: 'Eredivisie',
    country: 'Países Bajos',
    tier: 2,
    tierName: 'Primera linea europea',
    avgSalary: '€300K-800K/año',
    marketValue: '€1.8B',
    transferActivity: 'high',
    developmentScore: 93,
    exposureScore: 75,
    nextStepLeagues: ['Premier League', 'Bundesliga', 'LaLiga', 'Serie A'],
    description: 'La mejor liga para desarrollo técnico. Ajax, PSV y Feyenoord como escuelas élite.',
    flag: '🇳🇱',
  },
  'Primeira Liga': {
    name: 'Primeira Liga',
    country: 'Portugal',
    tier: 2,
    tierName: 'Primera linea europea',
    avgSalary: '€250K-600K/año',
    marketValue: '€1.6B',
    transferActivity: 'very_high',
    developmentScore: 90,
    exposureScore: 78,
    nextStepLeagues: ['Premier League', 'LaLiga', 'Serie A', 'Ligue 1'],
    description: 'Puerta de entrada a Europa para sudamericanos. Idioma similar, clubs vendedores.',
    flag: '🇵🇹',
  },
  'Pro League': {
    name: 'Pro League',
    country: 'Bélgica',
    tier: 2,
    tierName: 'Primera linea europea',
    avgSalary: '€200K-500K/año',
    marketValue: '€950M',
    transferActivity: 'high',
    developmentScore: 85,
    exposureScore: 70,
    nextStepLeagues: ['Premier League', 'Bundesliga', 'Ligue 1', 'Serie A'],
    description: 'Liga competitiva con excelente track record de transferencias a top ligas.',
    flag: '🇧🇪',
  },

  // ─── TIER 3: COMPETITIVAS ─────────────────────────────────────────────────────
  'Bundesliga Austria': {
    name: 'Bundesliga Austria',
    country: 'Austria',
    tier: 3,
    tierName: 'Competitivas',
    avgSalary: '€150K-400K/año',
    marketValue: '€450M',
    transferActivity: 'medium',
    developmentScore: 80,
    exposureScore: 55,
    nextStepLeagues: ['Bundesliga', 'Serie A', 'Eredivisie'],
    description: 'Red Bull Salzburg como modelo de desarrollo. Liga en crecimiento.',
    flag: '🇦🇹',
  },
  'Super League Suiza': {
    name: 'Super League Suiza',
    country: 'Suiza',
    tier: 3,
    tierName: 'Competitivas',
    avgSalary: '€150K-350K/año',
    marketValue: '€400M',
    transferActivity: 'medium',
    developmentScore: 75,
    exposureScore: 50,
    nextStepLeagues: ['Bundesliga', 'Ligue 1', 'Serie A'],
    description: 'Liga estable económicamente. Buenos salarios para el nivel.',
    flag: '🇨🇭',
  },
  'Liga MX': {
    name: 'Liga MX',
    country: 'México',
    tier: 3,
    tierName: 'Competitivas',
    avgSalary: '€300K-800K/año',
    marketValue: '€1.2B',
    transferActivity: 'medium',
    developmentScore: 60,
    exposureScore: 65,
    nextStepLeagues: ['LaLiga', 'MLS', 'Primeira Liga'],
    description: 'Alta competitividad y buenos salarios. Menos proyección a Europa.',
    flag: '🇲🇽',
  },
  'MLS': {
    name: 'MLS',
    country: 'Estados Unidos',
    tier: 3,
    tierName: 'Competitivas',
    avgSalary: '€400K-1M/año',
    marketValue: '€1.5B',
    transferActivity: 'high',
    developmentScore: 55,
    exposureScore: 60,
    nextStepLeagues: ['Premier League', 'Bundesliga', 'LaLiga'],
    description: 'Liga en crecimiento. Buenos salarios pero limitada proyección juvenil a Europa.',
    flag: '🇺🇸',
  },

  // ─── TIER 4: TOP SUDAMERICA ───────────────────────────────────────────────────
  'Serie A Brasil': {
    name: 'Serie A Brasil',
    country: 'Brasil',
    tier: 4,
    tierName: 'Top Sudamerica',
    avgSalary: '€150K-500K/año',
    marketValue: '€2.5B',
    transferActivity: 'very_high',
    developmentScore: 85,
    exposureScore: 70,
    nextStepLeagues: ['Primeira Liga', 'Eredivisie', 'LaLiga', 'Serie A', 'Ligue 1'],
    description: 'La liga más fuerte de Sudamérica. Gran nivel competitivo y visibilidad.',
    flag: '🇧🇷',
  },
  'Liga Argentina': {
    name: 'Liga Argentina',
    country: 'Argentina',
    tier: 4,
    tierName: 'Top Sudamerica',
    avgSalary: '€80K-300K/año',
    marketValue: '€1.2B',
    transferActivity: 'very_high',
    developmentScore: 88,
    exposureScore: 72,
    nextStepLeagues: ['Primeira Liga', 'LaLiga', 'Serie A', 'Eredivisie', 'Pro League'],
    description: 'Excelente cantera. Boca, River y clubs grandes exportan talentos constantemente.',
    flag: '🇦🇷',
  },

  // ─── TIER 5: SUDAMERICA COMPETITIVA ───────────────────────────────────────────
  'Liga BetPlay': {
    name: 'Liga BetPlay',
    country: 'Colombia',
    tier: 5,
    tierName: 'Sudamerica competitiva',
    avgSalary: '€50K-150K/año',
    marketValue: '€350M',
    transferActivity: 'medium',
    developmentScore: 72,
    exposureScore: 45,
    nextStepLeagues: ['Liga Argentina', 'Liga MX', 'Primeira Liga', 'MLS'],
    description: 'Liga en crecimiento. Buenos talentos pero menor valor de mercado.',
    flag: '🇨🇴',
  },
  'Primera División Chile': {
    name: 'Primera División Chile',
    country: 'Chile',
    tier: 5,
    tierName: 'Sudamerica competitiva',
    avgSalary: '€40K-120K/año',
    marketValue: '€180M',
    transferActivity: 'medium',
    developmentScore: 68,
    exposureScore: 40,
    nextStepLeagues: ['Liga Argentina', 'Liga MX', 'MLS'],
    description: 'Liga estable pero con menor proyección internacional.',
    flag: '🇨🇱',
  },
  'Primera División Uruguay': {
    name: 'Primera División Uruguay',
    country: 'Uruguay',
    tier: 5,
    tierName: 'Sudamerica competitiva',
    avgSalary: '€30K-100K/año',
    marketValue: '€120M',
    transferActivity: 'medium',
    developmentScore: 75,
    exposureScore: 42,
    nextStepLeagues: ['Liga Argentina', 'Serie A Brasil', 'Primeira Liga'],
    description: 'Gran tradición de formación. Peñarol y Nacional como canteras históricas.',
    flag: '🇺🇾',
  },

  // ─── TIER 6: DESARROLLO ───────────────────────────────────────────────────────
  '2° Colombia': {
    name: 'Torneo BetPlay II',
    country: 'Colombia',
    tier: 6,
    tierName: 'Desarrollo',
    avgSalary: '€20K-50K/año',
    marketValue: '€50M',
    transferActivity: 'low',
    developmentScore: 55,
    exposureScore: 20,
    nextStepLeagues: ['Liga BetPlay', 'Liga Argentina', 'Liga MX'],
    description: 'Segunda división colombiana. Primer paso profesional.',
    flag: '🇨🇴',
  },
  'Primera B Argentina': {
    name: 'Primera B Argentina',
    country: 'Argentina',
    tier: 6,
    tierName: 'Desarrollo',
    avgSalary: '€15K-40K/año',
    marketValue: '€80M',
    transferActivity: 'low',
    developmentScore: 60,
    exposureScore: 25,
    nextStepLeagues: ['Liga Argentina'],
    description: 'Segunda división argentina. Muchos talentos emergen de aquí.',
    flag: '🇦🇷',
  },
  'Serie B Brasil': {
    name: 'Serie B Brasil',
    country: 'Brasil',
    tier: 6,
    tierName: 'Desarrollo',
    avgSalary: '€30K-80K/año',
    marketValue: '€200M',
    transferActivity: 'medium',
    developmentScore: 65,
    exposureScore: 30,
    nextStepLeagues: ['Serie A Brasil'],
    description: 'Segunda división brasileña. Nivel competitivo considerable.',
    flag: '🇧🇷',
  },
  'División de Honor Paraguay': {
    name: 'División de Honor Paraguay',
    country: 'Paraguay',
    tier: 6,
    tierName: 'Desarrollo',
    avgSalary: '€20K-60K/año',
    marketValue: '€60M',
    transferActivity: 'low',
    developmentScore: 58,
    exposureScore: 22,
    nextStepLeagues: ['Liga Argentina', 'Serie A Brasil'],
    description: 'Liga paraguaya. Olimpia y Cerro Porteño como principales exportadores.',
    flag: '🇵🇾',
  },
  'LigaPro Ecuador': {
    name: 'LigaPro Ecuador',
    country: 'Ecuador',
    tier: 6,
    tierName: 'Desarrollo',
    avgSalary: '€25K-70K/año',
    marketValue: '€90M',
    transferActivity: 'low',
    developmentScore: 55,
    exposureScore: 25,
    nextStepLeagues: ['Liga Argentina', 'Liga MX', 'MLS'],
    description: 'Liga ecuatoriana en crecimiento. Independiente del Valle como modelo.',
    flag: '🇪🇨',
  },
  'División Profesional Bolivia': {
    name: 'División Profesional Bolivia',
    country: 'Bolivia',
    tier: 6,
    tierName: 'Desarrollo',
    avgSalary: '€15K-40K/año',
    marketValue: '€40M',
    transferActivity: 'low',
    developmentScore: 45,
    exposureScore: 15,
    nextStepLeagues: ['Liga Argentina', 'Serie A Brasil'],
    description: 'Liga boliviana. Menor exposición internacional.',
    flag: '🇧🇴',
  },
  'Liga Nacional Guatemala': {
    name: 'Liga Nacional Guatemala',
    country: 'Guatemala',
    tier: 6,
    tierName: 'Desarrollo',
    avgSalary: '€20K-50K/año',
    marketValue: '€30M',
    transferActivity: 'low',
    developmentScore: 40,
    exposureScore: 12,
    nextStepLeagues: ['Liga MX', 'MLS'],
    description: 'Liga centroamericana. Puerta hacia Liga MX.',
    flag: '🇬🇹',
  },
  'UAE Pro League': {
    name: 'UAE Pro League',
    country: 'Emiratos Árabes',
    tier: 3,
    tierName: 'Europa / Norteamérica',
    avgSalary: '€500K-2M/año',
    marketValue: '€400M',
    transferActivity: 'high',
    developmentScore: 40,
    exposureScore: 45,
    nextStepLeagues: ['Premier League', 'LaLiga'],
    description: 'Liga con alto poder económico. Destino para jugadores en pico de carrera.',
    flag: '🇦🇪',
  },
  'Liga Nacional Honduras': {
    name: 'Liga Nacional Honduras',
    country: 'Honduras',
    tier: 6,
    tierName: 'Desarrollo',
    avgSalary: '€15K-40K/año',
    marketValue: '€25M',
    transferActivity: 'low',
    developmentScore: 35,
    exposureScore: 10,
    nextStepLeagues: ['Liga MX', 'MLS'],
    description: 'Liga centroamericana. Puerta hacia Liga MX.',
    flag: '🇭🇳',
  },
  'Reserva': {
    name: 'Reserva',
    country: 'Argentina',
    tier: 6,
    tierName: 'Desarrollo',
    avgSalary: '€5K-20K/año',
    marketValue: '€10M',
    transferActivity: 'low',
    developmentScore: 70,
    exposureScore: 5,
    nextStepLeagues: ['Liga Argentina', 'Primera B Argentina'],
    description: 'Equipos de reserva y juveniles. Etapa de formación.',
    flag: '🇦🇷',
  },
}

// Helper to normalize a string for comparison (remove accents, lowercase, trim)
function normalizeForComparison(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // Remove accents
}

// Function to normalize league names for matching
export function normalizeLeagueName(liga: string): string {
  if (!liga) return ''
  const normalized = normalizeForComparison(liga)

  // Direct mappings - order matters, more specific first
  const mappings: [string, string][] = [
    // Argentina - many variations (including Torneo Inicial/Final format)
    ['torneo inicial', 'Liga Argentina'],
    ['torneo final', 'Liga Argentina'],
    ['primera división apertura', 'Liga Argentina'],
    ['primera división clausura', 'Liga Argentina'],
    ['primera division apertura', 'Liga Argentina'],
    ['primera division clausura', 'Liga Argentina'],
    ['liga profesional argentina', 'Liga Argentina'],
    ['liga profesional de fútbol', 'Liga Argentina'],
    ['liga profesional', 'Liga Argentina'],
    ['argentine primera división', 'Liga Argentina'],
    ['argentine primera division', 'Liga Argentina'],
    ['argentina primera división', 'Liga Argentina'],
    ['argentina primera division', 'Liga Argentina'],
    ['liga argentina', 'Liga Argentina'],
    ['primera división argentina', 'Liga Argentina'],
    ['primera division argentina', 'Liga Argentina'],
    ['superliga argentina', 'Liga Argentina'],
    ['arg1', 'Liga Argentina'],
    // Argentina Segunda División
    ['2° argentina', 'Primera B Argentina'],
    ['2 argentina', 'Primera B Argentina'],
    ['segunda argentina', 'Primera B Argentina'],
    ['primera nacional', 'Primera B Argentina'],
    ['primera b nacional', 'Primera B Argentina'],
    ['primera b argentina', 'Primera B Argentina'],
    ['arg2', 'Primera B Argentina'],
    // Reserva / Youth
    ['reserva', 'Reserva'],
    // Brasil - many variations
    ['campeonato brasileiro série a', 'Serie A Brasil'],
    ['campeonato brasileiro serie a', 'Serie A Brasil'],
    ['brazilian série a', 'Serie A Brasil'],
    ['brazilian serie a', 'Serie A Brasil'],
    ['brazil série a', 'Serie A Brasil'],
    ['brazil serie a', 'Serie A Brasil'],
    ['série a brasil', 'Serie A Brasil'],
    ['serie a brasil', 'Serie A Brasil'],
    ['brasileirão', 'Serie A Brasil'],
    ['brasileirao', 'Serie A Brasil'],
    ['campeonato brasileiro', 'Serie A Brasil'],
    ['bra1', 'Serie A Brasil'],
    ['série b', 'Serie B Brasil'],
    ['serie b brasil', 'Serie B Brasil'],
    ['brazilian série b', 'Serie B Brasil'],
    ['bra2', 'Serie B Brasil'],
    // Europa - Big 5
    ['english premier league', 'Premier League'],
    ['premier league', 'Premier League'],
    ['eng1', 'Premier League'],
    ['laliga santander', 'LaLiga'],
    ['laliga', 'LaLiga'],
    ['la liga', 'LaLiga'],
    ['liga española', 'LaLiga'],
    ['spanish la liga', 'LaLiga'],
    ['esp1', 'LaLiga'],
    ['italian serie a', 'Serie A'],
    ['serie a italy', 'Serie A'],
    ['serie a', 'Serie A'],
    ['calcio', 'Serie A'],
    ['ita1', 'Serie A'],
    ['german bundesliga', 'Bundesliga'],
    ['bundesliga', 'Bundesliga'],
    ['ger1', 'Bundesliga'],
    ['french ligue 1', 'Ligue 1'],
    ['ligue 1 uber eats', 'Ligue 1'],
    ['ligue 1', 'Ligue 1'],
    ['fra1', 'Ligue 1'],
    // Europa - Tier 2
    ['dutch eredivisie', 'Eredivisie'],
    ['eredivisie', 'Eredivisie'],
    ['ned1', 'Eredivisie'],
    ['liga portugal', 'Primeira Liga'],
    ['portuguese primeira liga', 'Primeira Liga'],
    ['liga portugal bwin', 'Primeira Liga'],
    ['primeira liga', 'Primeira Liga'],
    ['liga nos', 'Primeira Liga'],
    ['por1', 'Primeira Liga'],
    ['belgian pro league', 'Pro League'],
    ['pro league', 'Pro League'],
    ['jupiler pro league', 'Pro League'],
    ['belgian first division', 'Pro League'],
    ['bel1', 'Pro League'],
    // Europa - Tier 3
    ['austrian bundesliga', 'Bundesliga Austria'],
    ['bundesliga austria', 'Bundesliga Austria'],
    ['aut1', 'Bundesliga Austria'],
    ['swiss super league', 'Super League Suiza'],
    ['super league suiza', 'Super League Suiza'],
    ['sui1', 'Super League Suiza'],
    // Americas - Mexico
    ['liga mexico', 'Liga MX'],
    ['liga mx apertura', 'Liga MX'],
    ['liga mx clausura', 'Liga MX'],
    ['mexican liga mx', 'Liga MX'],
    ['liga mx', 'Liga MX'],
    ['liga bbva mx', 'Liga MX'],
    ['mex1', 'Liga MX'],
    ['major league soccer', 'MLS'],
    ['mls', 'MLS'],
    ['usa1', 'MLS'],
    // Colombia
    ['torneo dimayor', 'Liga BetPlay'],
    ['colombian primera a', 'Liga BetPlay'],
    ['liga betplay dimayor', 'Liga BetPlay'],
    ['liga betplay', 'Liga BetPlay'],
    ['categoría primera a', 'Liga BetPlay'],
    ['categoria primera a', 'Liga BetPlay'],
    ['primera a colombia', 'Liga BetPlay'],
    ['col1', 'Liga BetPlay'],
    ['2° colombia', '2° Colombia'],
    ['2 colombia', '2° Colombia'],
    ['segunda colombia', '2° Colombia'],
    ['torneo betplay', '2° Colombia'],
    ['col2', '2° Colombia'],
    // Chile
    ['liga chile', 'Primera División Chile'],
    ['primera división de chile', 'Primera División Chile'],
    ['primera division de chile', 'Primera División Chile'],
    ['chilean primera división', 'Primera División Chile'],
    ['chilean primera division', 'Primera División Chile'],
    ['primera división chile', 'Primera División Chile'],
    ['primera division chile', 'Primera División Chile'],
    ['campeonato chileno', 'Primera División Chile'],
    ['chi1', 'Primera División Chile'],
    ['liga uruguay', 'Primera División Uruguay'],
    ['uruguayan primera división', 'Primera División Uruguay'],
    ['uruguayan primera division', 'Primera División Uruguay'],
    ['primera división uruguay', 'Primera División Uruguay'],
    ['primera division uruguay', 'Primera División Uruguay'],
    ['campeonato uruguayo', 'Primera División Uruguay'],
    ['uru1', 'Primera División Uruguay'],
    ['paraguayan primera división', 'División de Honor Paraguay'],
    ['división de honor paraguay', 'División de Honor Paraguay'],
    ['division de honor paraguay', 'División de Honor Paraguay'],
    ['liga paraguaya', 'División de Honor Paraguay'],
    ['par1', 'División de Honor Paraguay'],
    ['liga ecuador', 'LigaPro Ecuador'],
    ['ecuadorian serie a', 'LigaPro Ecuador'],
    ['ligapro serie a', 'LigaPro Ecuador'],
    ['ligapro ecuador', 'LigaPro Ecuador'],
    ['liga pro ecuador', 'LigaPro Ecuador'],
    ['serie a ecuador', 'LigaPro Ecuador'],
    ['ecu1', 'LigaPro Ecuador'],
    // Bolivia
    ['liga bolivia', 'División Profesional Bolivia'],
    ['división profesional apertura', 'División Profesional Bolivia'],
    ['division profesional apertura', 'División Profesional Bolivia'],
    ['división profesional clausura', 'División Profesional Bolivia'],
    ['division profesional clausura', 'División Profesional Bolivia'],
    ['liga boliviana', 'División Profesional Bolivia'],
    ['bol1', 'División Profesional Bolivia'],
    // Guatemala
    ['liga nacional clausura', 'Liga Nacional Guatemala'],
    ['liga nacional apertura', 'Liga Nacional Guatemala'],
    ['liga nacional guatemala', 'Liga Nacional Guatemala'],
    ['gua1', 'Liga Nacional Guatemala'],
    // Honduras
    ['liga honduras', 'Liga Nacional Honduras'],
    ['liga nacional honduras', 'Liga Nacional Honduras'],
    ['hon1', 'Liga Nacional Honduras'],
    // UAE
    ['liga emiratos arabes unidos', 'UAE Pro League'],
    ['uae arabian gulf league', 'UAE Pro League'],
    ['arabian gulf league', 'UAE Pro League'],
    ['uae pro league', 'UAE Pro League'],
    ['uae1', 'UAE Pro League'],
  ]

  // Try match (normalize patterns too for accent-insensitive matching)
  for (const [pattern, value] of mappings) {
    const normPattern = normalizeForComparison(pattern)
    if (normalized === normPattern || normalized.includes(normPattern)) {
      return value
    }
  }

  // Fallback patterns - match by country/region keywords
  if (normalized.includes('argentin')) return 'Liga Argentina'
  if (normalized.includes('brasil') || normalized.includes('brazil') || normalized.includes('brasileir')) return 'Serie A Brasil'
  if (normalized.includes('colombi')) return 'Liga BetPlay'
  if (normalized.includes('chile') || normalized.includes('chilen')) return 'Primera División Chile'
  if (normalized.includes('uruguay')) return 'Primera División Uruguay'
  if (normalized.includes('paragua')) return 'División de Honor Paraguay'
  if (normalized.includes('ecuador')) return 'LigaPro Ecuador'
  if (normalized.includes('portug') || normalized.includes('lisbon')) return 'Primeira Liga'
  if (normalized.includes('holand') || normalized.includes('netherland') || normalized.includes('dutch') || normalized.includes('amsterdam')) return 'Eredivisie'
  if (normalized.includes('belgi') || normalized.includes('belgian')) return 'Pro League'
  if (normalized.includes('austria') || normalized.includes('austrian')) return 'Bundesliga Austria'
  if (normalized.includes('suiz') || normalized.includes('swiss') || normalized.includes('switzerland')) return 'Super League Suiza'
  if (normalized.includes('mexic') || normalized.includes('méxico')) return 'Liga MX'
  if (normalized.includes('england') || normalized.includes('english') || normalized.includes('premier')) return 'Premier League'
  if (normalized.includes('spain') || normalized.includes('spanish') || normalized.includes('españa')) return 'LaLiga'
  if (normalized.includes('italy') || normalized.includes('italian') || normalized.includes('italia')) return 'Serie A'
  if (normalized.includes('german') || normalized.includes('germany') || normalized.includes('alemania')) return 'Bundesliga'
  if (normalized.includes('france') || normalized.includes('french') || normalized.includes('francia')) return 'Ligue 1'
  if (normalized.includes('usa') || normalized.includes('united states') || normalized.includes('estados unidos')) return 'MLS'

  // Return original if no match
  return liga
}

// Get league info by name (with fuzzy matching)
export function getLeagueInfo(liga: string): LeagueInfo | null {
  const normalized = normalizeLeagueName(liga)
  return LEAGUES[normalized] || null
}

// Get tier color classes
export function getTierClasses(tier: number): { color: string; bgColor: string } {
  return TIER_INFO[tier] || TIER_INFO[6]
}

// Calculate potential league jump opportunities
export function getLeagueJumpOpportunities(
  currentLeague: string,
  age: number,
  score: number
): { league: string; info: LeagueInfo; likelihood: 'high' | 'medium' | 'low'; reason: string }[] {
  const current = getLeagueInfo(currentLeague)
  if (!current) return []

  const opportunities: { league: string; info: LeagueInfo; likelihood: 'high' | 'medium' | 'low'; reason: string }[] = []

  for (const nextLeague of current.nextStepLeagues) {
    const next = LEAGUES[nextLeague]
    if (!next) continue

    let likelihood: 'high' | 'medium' | 'low' = 'low'
    let reason = ''

    // Calculate likelihood based on age and score
    if (age <= 23 && score >= 55) {
      likelihood = 'high'
      reason = 'Joven con alto rendimiento'
    } else if (age <= 26 && score >= 50) {
      likelihood = 'medium'
      reason = 'Buen rendimiento, edad óptima'
    } else if (score >= 60) {
      likelihood = 'medium'
      reason = 'Rendimiento destacado'
    } else if (age <= 21 && score >= 40) {
      likelihood = 'medium'
      reason = 'Joven promesa con potencial'
    } else {
      reason = 'Requiere consolidación'
    }

    opportunities.push({
      league: nextLeague,
      info: next,
      likelihood,
      reason,
    })
  }

  // Sort by tier (lower = better) and likelihood
  opportunities.sort((a, b) => {
    const likelihoodOrder = { high: 0, medium: 1, low: 2 }
    if (a.info.tier !== b.info.tier) return a.info.tier - b.info.tier
    return likelihoodOrder[a.likelihood] - likelihoodOrder[b.likelihood]
  })

  return opportunities.slice(0, 3)
}

// Analyze contract situation for potential moves
export function analyzeContractOpportunity(
  monthsRemaining: number | null,
  currentTier: number,
  score: number
): { status: 'critical' | 'opportunity' | 'stable'; message: string } {
  if (monthsRemaining === null) {
    return { status: 'stable', message: 'Sin información de contrato' }
  }

  if (monthsRemaining <= 6) {
    if (score >= 50) {
      return {
        status: 'critical',
        message: 'Contrato crítico. Alto valor, oportunidad de salida libre.',
      }
    }
    return {
      status: 'critical',
      message: 'Contrato crítico. Renovar o buscar destino.',
    }
  }

  if (monthsRemaining <= 12) {
    if (score >= 55 && currentTier >= 4) {
      return {
        status: 'opportunity',
        message: 'Ventana de negociación. Buen momento para salto de liga.',
      }
    }
    return {
      status: 'opportunity',
      message: 'Próximo a vencer. Evaluar renovación o transferencia.',
    }
  }

  return { status: 'stable', message: 'Contrato estable' }
}
