// lib/articleTypes.ts
// @version 1.0.0

export type ArticleSection = 
  | 'hoofdartikel'
  | 'sterrenbeeld'
  | 'nieuws'
  | 'weer'
  | 'cultuur'
  | 'naam_betekenis'
  | 'beroemde_namen'
  | 'geboren_op_dag'

export interface ArticleGenerationRequest {
  section: ArticleSection
  data: any
  sessionId: string
}

export interface ArticleGenerationResponse {
  success: boolean
  section: ArticleSection
  text?: string
  wordCount?: number
  tokensUsed?: number
  cost?: number
  error?: string
  remainingRequests?: number
  dailyCost?: number
}

export interface GeneratedArticle {
  section: ArticleSection
  text: string
  generatedAt: string
  wordCount: number
}

export interface ArticleSectionConfig {
  id: ArticleSection
  title: string
  description: string
  targetWordCount: number
  icon: string
  priority: number
}

export const ARTICLE_SECTIONS: Record<ArticleSection, ArticleSectionConfig> = {
  hoofdartikel: {
    id: 'hoofdartikel',
    title: 'Hoofdartikel - Het Geboorte Verhaal',
    description: 'Persoonlijk verhaal over de geboorte',
    targetWordCount: 250,
    icon: '📰',
    priority: 1
  },
  sterrenbeeld: {
    id: 'sterrenbeeld',
    title: 'Sterrenbeeld & Chinees Teken',
    description: 'Beschrijving van sterrenbeeld en Chinese horoscoop',
    targetWordCount: 180,
    icon: '♈',
    priority: 2
  },
  nieuws: {
    id: 'nieuws',
    title: 'Nieuws op de Geboortedag',
    description: 'Wat er gebeurde op de geboortedag',
    targetWordCount: 140,
    icon: '📰',
    priority: 3
  },
  weer: {
    id: 'weer',
    title: 'Het Weer',
    description: 'Weerbericht van de geboortedag',
    targetWordCount: 80,
    icon: '🌤️',
    priority: 4
  },
  cultuur: {
    id: 'cultuur',
    title: 'Muziek, Radio & Televisie',
    description: 'Entertainment op de geboortedag',
    targetWordCount: 130,
    icon: '🎵',
    priority: 5
  },
  naam_betekenis: {
    id: 'naam_betekenis',
    title: 'Betekenis van de Naam',
    description: 'Oorsprong en betekenis van de naam',
    targetWordCount: 150,
    icon: '📛',
    priority: 6
  },
  beroemde_namen: {
    id: 'beroemde_namen',
    title: 'Beroemde Naamgenoten',
    description: 'Bekende mensen met dezelfde naam',
    targetWordCount: 100,
    icon: '⭐',
    priority: 7
  },
  geboren_op_dag: {
    id: 'geboren_op_dag',
    title: 'Ook Geboren op deze Dag',
    description: 'Beroemde mensen geboren op dezelfde dag',
    targetWordCount: 100,
    icon: '🎂',
    priority: 8
  }
}

export interface UsageStats {
  requestsToday: number
  costToday: number
  lastRequestAt: string
}

export const USAGE_LIMITS = {
  maxRequestsPerDay: 50,
  maxCostPerDay: 1.00,
  timeoutMs: 20000,
  maxTokensPerRequest: 1000
}

export const CLAUDE_PRICING = {
  inputCostPer1MTokens: 1.00,
  outputCostPer1MTokens: 5.00,
}