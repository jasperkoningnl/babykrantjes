// lib/rateLimit.ts
// @version 1.0.0
// Server-side rate limiting op IP-basis via Upstash Redis.
// Vervangt de oude in-memory Map + client-gekozen sessionId, die op
// serverless niet werkte (reset bij cold start, per instance, en de
// client kon zijn eigen limiet omzeilen door een nieuw sessionId te kiezen).
//
// Env vars: UPSTASH_REDIS_REST_URL en UPSTASH_REDIS_REST_TOKEN.
// Zonder configuratie wordt er gewaarschuwd en doorgelaten (fail-open),
// zodat een misconfiguratie de site niet platlegt — zet de env vars in
// productie dus altijd.

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { USAGE_LIMITS } from './articleTypes'

let redis: Redis | null = null
let articleLimiter: Ratelimit | null = null
let paperLimiter: Ratelimit | null = null

function isRedisConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  }
  return redis
}

/** Per-sectie generatie: ruime limiet, kleine calls. */
function getArticleLimiter(): Ratelimit {
  if (!articleLimiter) {
    articleLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(USAGE_LIMITS.maxRequestsPerDay, '1 d'),
      prefix: 'babykrant:article',
    })
  }
  return articleLimiter
}

/** Complete-krant generatie: duurdere call, strakkere limiet. */
function getPaperLimiter(): Ratelimit {
  if (!paperLimiter) {
    paperLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(10, '1 d'),
      prefix: 'babykrant:paper',
    })
  }
  return paperLimiter
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  /** Alleen gezet wanneer de limiter daadwerkelijk actief is */
  enforced: boolean
}

/** Client-IP uit de request headers (Vercel zet x-forwarded-for). */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') || 'onbekend'
}

export async function checkRateLimit(
  request: Request,
  type: 'article' | 'paper'
): Promise<RateLimitResult> {
  if (!isRedisConfigured()) {
    console.warn('[RateLimit] Upstash niet geconfigureerd — rate limiting staat UIT')
    return { allowed: true, remaining: -1, enforced: false }
  }

  try {
    const limiter = type === 'paper' ? getPaperLimiter() : getArticleLimiter()
    const result = await limiter.limit(getClientIp(request))
    return { allowed: result.success, remaining: result.remaining, enforced: true }
  } catch (err) {
    // Redis-storing mag generatie niet blokkeren; wel luid loggen.
    console.error('[RateLimit] Fout bij limiet-check:', err)
    return { allowed: true, remaining: -1, enforced: false }
  }
}

const DAILY_COST_KEY_PREFIX = 'babykrant:cost:'

function todayKey(): string {
  return `${DAILY_COST_KEY_PREFIX}${new Date().toISOString().slice(0, 10)}`
}

/**
 * Globale dagelijkse kostenbewaking (alle gebruikers samen). Geeft de
 * nieuwe dagtotaal-stand terug; -1 als Redis niet beschikbaar is.
 */
export async function addDailyCost(cost: number): Promise<number> {
  if (!isRedisConfigured()) return -1
  try {
    const key = todayKey()
    const total = await getRedis().incrbyfloat(key, cost)
    await getRedis().expire(key, 60 * 60 * 48)
    return Number(total)
  } catch (err) {
    console.error('[RateLimit] Fout bij kosten-tracking:', err)
    return -1
  }
}

/** Huidige dagkosten (alle gebruikers samen); 0 als onbekend. */
export async function getDailyCost(): Promise<number> {
  if (!isRedisConfigured()) return 0
  try {
    const value = await getRedis().get<number>(todayKey())
    return Number(value ?? 0)
  } catch {
    return 0
  }
}

/** Globaal dagbudget in dollars voor alle generatie samen. */
export const DAILY_COST_BUDGET = 5.0
