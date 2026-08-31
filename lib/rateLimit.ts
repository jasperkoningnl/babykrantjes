// lib/rateLimit.ts
// @version 1.0.0
// Server-side rate limiting op IP-basis via Upstash Redis.
// Vervangt de oude in-memory Map + client-gekozen sessionId, die op
// serverless niet werkte (reset bij cold start, per instance, en de
// client kon zijn eigen limiet omzeilen door een nieuw sessionId te kiezen).
//
// Env vars: KV_REST_API_URL en KV_REST_API_TOKEN (de namen die de
// Upstash/Vercel-integratie injecteert en die lib/waybackCache.ts al
// gebruikt), met UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN als
// alternatief. Beveiligde en kostbare routes falen dicht wanneer Redis
// ontbreekt of niet bereikbaar is.

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { USAGE_LIMITS } from './articleTypes'

let redis: Redis | null = null
let articleLimiter: Ratelimit | null = null
let paperLimiter: Ratelimit | null = null
let emailLimiter: Ratelimit | null = null

function redisCredentials(): { url: string; token: string } | null {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    return { url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN }
  }
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return { url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN }
  }
  return null
}

export function isRedisConfigured(): boolean {
  return redisCredentials() !== null
}

function getEmailLimiter(): Ratelimit {
  if (!emailLimiter) {
    emailLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(3, '1 h'),
      prefix: 'babykrant:email',
    })
  }
  return emailLimiter
}

function getRedis(): Redis {
  if (!redis) {
    const credentials = redisCredentials()
    if (!credentials) throw new Error('Redis is niet geconfigureerd')
    redis = new Redis(credentials)
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
  unavailable?: boolean
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
    console.error('[RateLimit] Upstash niet geconfigureerd — request geweigerd')
    return { allowed: false, remaining: 0, enforced: false, unavailable: true }
  }

  try {
    const limiter = type === 'paper' ? getPaperLimiter() : getArticleLimiter()
    const result = await limiter.limit(getClientIp(request))
    return { allowed: result.success, remaining: result.remaining, enforced: true }
  } catch (err) {
    console.error('[RateLimit] Fout bij limiet-check:', err)
    return { allowed: false, remaining: 0, enforced: false, unavailable: true }
  }
}

export async function checkEmailRateLimit(request: Request, paperId: string, email: string): Promise<RateLimitResult> {
  if (!isRedisConfigured()) return { allowed: false, remaining: 0, enforced: false, unavailable: true }
  try {
    const limiter = getEmailLimiter()
    const identifiers = [`paper:${paperId}`, `email:${email}`, `ip:${getClientIp(request)}`]
    const results = await Promise.all(identifiers.map((identifier) => limiter.limit(identifier)))
    return {
      allowed: results.every((result) => result.success),
      remaining: Math.min(...results.map((result) => result.remaining)),
      enforced: true,
    }
  } catch (error) {
    console.error('[RateLimit] E-maillimiter niet beschikbaar:', error)
    return { allowed: false, remaining: 0, enforced: false, unavailable: true }
  }
}

const DAILY_COST_KEY_PREFIX = 'babykrant:cost:'

function todayKey(): string {
  return `${DAILY_COST_KEY_PREFIX}${new Date().toISOString().slice(0, 10)}`
}

/** Globaal dagbudget in dollars voor alle generatie samen. */
export const DAILY_COST_BUDGET = 5.0

const RESERVE_SCRIPT = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
local amount = tonumber(ARGV[1])
local budget = tonumber(ARGV[2])
if current + amount > budget then return -1 end
local total = redis.call('INCRBYFLOAT', KEYS[1], amount)
redis.call('EXPIRE', KEYS[1], 172800)
return total
`

/** Reserveert het maximale bedrag atomair vóór een kostbare call. */
export async function reserveDailyCost(amount: number): Promise<{ ok: boolean; total: number; unavailable?: boolean }> {
  if (!isRedisConfigured()) return { ok: false, total: -1, unavailable: true }
  try {
    const result = await getRedis().eval(RESERVE_SCRIPT, [todayKey()], [String(amount), String(DAILY_COST_BUDGET)])
    const total = Number(result)
    return { ok: total >= 0, total }
  } catch (error) {
    console.error('[RateLimit] Budgetreservering mislukt:', error)
    return { ok: false, total: -1, unavailable: true }
  }
}

/** Verrekent na afloop het verschil met de vooraf gereserveerde bovengrens. */
export async function settleDailyCost(reserved: number, actual: number): Promise<void> {
  if (!isRedisConfigured()) return
  const difference = actual - reserved
  if (Math.abs(difference) < 0.000001) return
  try {
    await getRedis().incrbyfloat(todayKey(), difference)
  } catch (error) {
    console.error('[RateLimit] Budgetverrekening mislukt:', error)
  }
}
