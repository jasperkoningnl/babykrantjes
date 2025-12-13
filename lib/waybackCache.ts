// lib/waybackCache.ts
// @version 1.0.0
// Wayback Machine snapshot cache
// Stores which dates have available snapshots to avoid redundant Archive.org queries

import fs from 'fs/promises'
import path from 'path'

const CACHE_FILE = path.join(process.cwd(), 'data', 'wayback-cache.json')

export interface WaybackCacheEntry {
  status: 'found' | 'not_found' | 'too_old'
  timestamp?: string  // Wayback timestamp if found
  headlines?: number  // Number of headlines if found
  reason?: string     // Reason if not found
  lastChecked: string // ISO date when last checked
}

export interface WaybackCache {
  [date: string]: WaybackCacheEntry
}

/**
 * Check if a date has cached Wayback Machine snapshot info
 */
export async function checkCache(date: string): Promise<WaybackCacheEntry | null> {
  try {
    const data = await fs.readFile(CACHE_FILE, 'utf-8')
    const cache: WaybackCache = JSON.parse(data)
    return cache[date] || null
  } catch (error) {
    // Cache file doesn't exist or can't be read - not a problem
    return null
  }
}

/**
 * Update cache with new snapshot information
 */
export async function updateCache(date: string, entry: Omit<WaybackCacheEntry, 'lastChecked'>): Promise<void> {
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
    console.log(`[WaybackCache] Updated cache for ${date}: ${entry.status}`)
  } catch (error) {
    // Don't fail the request if cache write fails
    console.error('[WaybackCache] Failed to update cache:', error)
  }
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

/**
 * Check if cache entry is stale (older than 30 days)
 * Wayback Machine can add new snapshots, so we occasionally re-check
 */
export function isCacheStale(entry: WaybackCacheEntry, maxAgeDays: number = 30): boolean {
  const lastChecked = new Date(entry.lastChecked)
  const now = new Date()
  const daysDiff = (now.getTime() - lastChecked.getTime()) / (1000 * 60 * 60 * 24)
  return daysDiff > maxAgeDays
}