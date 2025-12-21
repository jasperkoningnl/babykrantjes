// lib/waybackCache.ts
// @version 2.2.0
// Wayback Machine snapshot cache
// Stores which dates have available snapshots to avoid redundant Archive.org queries
// UPDATE v2.0.0: Hybrid storage - Upstash Redis (Vercel) + filesystem fallback (local)
// UPDATE v2.1.0: Store full headlines in cache for true performance gain
// UPDATE v2.2.0: Simplified - only cache successful results (no overwrite issues)

import { Redis } from '@upstash/redis'

// Types
export interface WaybackHeadline {
  title: string
  url: string
  category: string | null
  time: string | null
  source: string
}

export interface WaybackCacheEntry {
  status: 'found' | 'not_found' | 'too_old'
  timestamp?: string  // Wayback timestamp if found
  headlines?: WaybackHeadline[]  // Full headlines array (v2.1.0+)
  headlineCount?: number  // Number of headlines (legacy, for backwards compat)
  sources?: string[]  // Sources used
  reason?: string     // Reason if not found
  lastChecked: string // ISO date when last checked
}

export interface WaybackCache {
  [date: string]: WaybackCacheEntry
}

// =============================================================================
// Storage Detection & Initialization
// =============================================================================

const CACHE_KEY_PREFIX = 'wayback:'

// Check if we're running on Vercel with Upstash Redis
const hasUpstashEnv = () => {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

// Initialize Upstash Redis client (only on Vercel)
let redis: Redis | null = null
if (hasUpstashEnv()) {
  redis = new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  })
  console.log('[WaybackCache] Using Upstash Redis for cache storage')
} else {
  console.log('[WaybackCache] Using filesystem for cache storage (local development)')
}

// =============================================================================
// Upstash Redis Implementation
// =============================================================================

async function checkCacheRedis(date: string): Promise<WaybackCacheEntry | null> {
  if (!redis) return null

  try {
    const key = `${CACHE_KEY_PREFIX}${date}`
    const data = await redis.get<WaybackCacheEntry>(key)
    return data
  } catch (error) {
    console.error('[WaybackCache] Redis read error:', error)
    return null
  }
}

async function updateCacheRedis(date: string, entry: Omit<WaybackCacheEntry, 'lastChecked'>): Promise<void> {
  if (!redis) return

  // SIMPLE STRATEGY: Only cache successful results
  // - 'found': permanent cache → builds shared database
  // - 'not_found'/'too_old': DON'T cache → retry next time
  if (entry.status !== 'found' || !entry.headlines || entry.headlines.length === 0) {
    console.log(`[WaybackCache] Redis: Skipping cache write for ${date}: ${entry.status} (only success is cached)`)
    return
  }

  try {
    const key = `${CACHE_KEY_PREFIX}${date}`
    const cacheEntry: WaybackCacheEntry = {
      ...entry,
      lastChecked: new Date().toISOString()
    }

    // Permanent cache - historical news doesn't change
    await redis.set(key, cacheEntry)
    console.log(`[WaybackCache] Redis: Cached ${entry.headlines.length} headlines for ${date} (PERMANENT - shared benefit!)`)
  } catch (error) {
    console.error('[WaybackCache] Redis write error:', error)
  }
}

async function getCacheStatsRedis(): Promise<{
  total: number
  found: number
  notFound: number
  tooOld: number
}> {
  if (!redis) return { total: 0, found: 0, notFound: 0, tooOld: 0 }

  try {
    // Get all cache keys
    const keys = await redis.keys(`${CACHE_KEY_PREFIX}*`)

    if (keys.length === 0) {
      return { total: 0, found: 0, notFound: 0, tooOld: 0 }
    }

    // Fetch all entries
    const entries = await Promise.all(
      keys.map(key => redis!.get<WaybackCacheEntry>(key))
    )

    const validEntries = entries.filter((e): e is WaybackCacheEntry => e !== null)

    return {
      total: validEntries.length,
      found: validEntries.filter(e => e.status === 'found').length,
      notFound: validEntries.filter(e => e.status === 'not_found').length,
      tooOld: validEntries.filter(e => e.status === 'too_old').length
    }
  } catch (error) {
    console.error('[WaybackCache] Redis stats error:', error)
    return { total: 0, found: 0, notFound: 0, tooOld: 0 }
  }
}

// =============================================================================
// Filesystem Implementation (fallback for local development)
// =============================================================================

import fs from 'fs/promises'
import path from 'path'

const CACHE_FILE = path.join(process.cwd(), 'data', 'wayback-cache.json')

async function checkCacheFile(date: string): Promise<WaybackCacheEntry | null> {
  try {
    const data = await fs.readFile(CACHE_FILE, 'utf-8')
    const cache: WaybackCache = JSON.parse(data)
    return cache[date] || null
  } catch (error) {
    // Cache file doesn't exist or can't be read - not a problem
    return null
  }
}

async function updateCacheFile(date: string, entry: Omit<WaybackCacheEntry, 'lastChecked'>): Promise<void> {
  // SIMPLE STRATEGY: Only cache successful results (same as Redis)
  if (entry.status !== 'found' || !entry.headlines || entry.headlines.length === 0) {
    console.log(`[WaybackCache] File: Skipping cache write for ${date}: ${entry.status} (only success is cached)`)
    return
  }

  try {
    // Ensure data directory exists
    const dataDir = path.join(process.cwd(), 'data')
    try {
      await fs.mkdir(dataDir, { recursive: true })
    } catch {}

    // Read existing cache
    let cache: WaybackCache = {}
    try {
      const data = await fs.readFile(CACHE_FILE, 'utf-8')
      cache = JSON.parse(data)
    } catch {
      // File doesn't exist yet, start fresh
    }

    // Add entry with lastChecked timestamp
    cache[date] = {
      ...entry,
      lastChecked: new Date().toISOString()
    }

    // Write back to file
    await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2))
    console.log(`[WaybackCache] File: Cached ${entry.headlines.length} headlines for ${date}`)
  } catch (error) {
    // Don't fail the request if cache write fails
    console.error('[WaybackCache] File write error:', error)
  }
}

async function getCacheStatsFile(): Promise<{
  total: number
  found: number
  notFound: number
  tooOld: number
}> {
  try {
    const data = await fs.readFile(CACHE_FILE, 'utf-8')
    const cache: WaybackCache = JSON.parse(data)
    const entries = Object.values(cache)

    return {
      total: entries.length,
      found: entries.filter(e => e.status === 'found').length,
      notFound: entries.filter(e => e.status === 'not_found').length,
      tooOld: entries.filter(e => e.status === 'too_old').length
    }
  } catch {
    return { total: 0, found: 0, notFound: 0, tooOld: 0 }
  }
}

// =============================================================================
// Public API (automatically chooses Redis or File based on environment)
// =============================================================================

/**
 * Check if a date has cached Wayback Machine snapshot info
 */
export async function checkCache(date: string): Promise<WaybackCacheEntry | null> {
  return hasUpstashEnv() ? checkCacheRedis(date) : checkCacheFile(date)
}

/**
 * Update cache with new snapshot information
 */
export async function updateCache(date: string, entry: Omit<WaybackCacheEntry, 'lastChecked'>): Promise<void> {
  return hasUpstashEnv() ? updateCacheRedis(date, entry) : updateCacheFile(date, entry)
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  total: number
  found: number
  notFound: number
  tooOld: number
}> {
  return hasUpstashEnv() ? getCacheStatsRedis() : getCacheStatsFile()
}

/**
 * Check if cache entry is stale (older than N days)
 * Wayback Machine can add new snapshots, so we occasionally re-check
 */
export function isCacheStale(entry: WaybackCacheEntry, maxAgeDays: number = 30): boolean {
  const lastChecked = new Date(entry.lastChecked)
  const now = new Date()
  const daysDiff = (now.getTime() - lastChecked.getTime()) / (1000 * 60 * 60 * 24)
  return daysDiff > maxAgeDays
}
