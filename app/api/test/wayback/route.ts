// app/api/test/wayback/route.ts
// Test endpoint voor Wayback Machine scraper reliability testing
// Genereert random datums en test de scraper 3x per datum

import { NextRequest, NextResponse } from 'next/server'

// Force dynamic rendering - don't try to pre-render during build
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max

interface TestRun {
  runNumber: number
  success: boolean
  headlines: number
  cacheHit: boolean
  duration: number
  error?: string
  source?: string
  snapshotTime?: string
}

interface DateTestResult {
  date: string
  runs: TestRun[]
  avgHeadlines: number
  consistency: 'consistent' | 'variable' | 'failed'
  avgDuration: number
}

/**
 * Generate random date between 2005 and 2024
 */
function generateRandomDate(): string {
  const startYear = 2005
  const endYear = 2024

  const year = Math.floor(Math.random() * (endYear - startYear + 1)) + startYear
  const month = Math.floor(Math.random() * 12) + 1
  const daysInMonth = new Date(year, month, 0).getDate()
  const day = Math.floor(Math.random() * daysInMonth) + 1

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Test a single date against the wayback API
 */
async function testDate(date: string, runNumber: number): Promise<TestRun> {
  const startTime = Date.now()

  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/news/wayback?date=${date}`, {
      headers: {
        'User-Agent': 'Babykrant-Test/1.0'
      }
    })

    const duration = Date.now() - startTime

    if (!response.ok) {
      return {
        runNumber,
        success: false,
        headlines: 0,
        cacheHit: false,
        duration,
        error: `HTTP ${response.status}`
      }
    }

    const data = await response.json()

    return {
      runNumber,
      success: data.totalHeadlines > 0,
      headlines: data.totalHeadlines || 0,
      cacheHit: data.cacheHit || false,
      duration,
      source: data.sources?.[0],
      snapshotTime: data.snapshotTimestamp ?
        `${data.snapshotTimestamp.substring(8, 10)}:${data.snapshotTimestamp.substring(10, 12)}` :
        undefined,
      error: data.error
    }
  } catch (error: any) {
    return {
      runNumber,
      success: false,
      headlines: 0,
      cacheHit: false,
      duration: Date.now() - startTime,
      error: error.message
    }
  }
}

/**
 * Analyze consistency across runs
 */
function analyzeConsistency(runs: TestRun[]): 'consistent' | 'variable' | 'failed' {
  const successCount = runs.filter(r => r.success).length

  if (successCount === 0) return 'failed'
  if (successCount === runs.length) {
    // Check if headline counts are similar (within 10%)
    const headlines = runs.map(r => r.headlines).filter(h => h > 0)
    const avg = headlines.reduce((a, b) => a + b, 0) / headlines.length
    const variance = headlines.every(h => Math.abs(h - avg) / avg < 0.1)
    return variance ? 'consistent' : 'variable'
  }

  return 'variable'
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const count = parseInt(searchParams.get('count') || '10')
  const runsPerDate = parseInt(searchParams.get('runs') || '3')

  console.log(`[Test Wayback] Starting test: ${count} dates × ${runsPerDate} runs`)

  const results: DateTestResult[] = []

  // Generate random dates
  const testDates = Array.from({ length: count }, () => generateRandomDate())

  // Test each date multiple times
  for (const date of testDates) {
    console.log(`[Test Wayback] Testing ${date}...`)

    const runs: TestRun[] = []

    for (let i = 1; i <= runsPerDate; i++) {
      const run = await testDate(date, i)
      runs.push(run)

      // Small delay between runs to avoid rate limiting
      if (i < runsPerDate) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    const successfulRuns = runs.filter(r => r.success)
    const avgHeadlines = successfulRuns.length > 0
      ? Math.round(successfulRuns.reduce((sum, r) => sum + r.headlines, 0) / successfulRuns.length)
      : 0

    const avgDuration = Math.round(runs.reduce((sum, r) => sum + r.duration, 0) / runs.length)

    results.push({
      date,
      runs,
      avgHeadlines,
      consistency: analyzeConsistency(runs),
      avgDuration
    })
  }

  // Generate summary
  const totalRuns = results.length * runsPerDate
  const successfulRuns = results.flatMap(r => r.runs).filter(r => r.success).length
  const consistentDates = results.filter(r => r.consistency === 'consistent').length
  const variableDates = results.filter(r => r.consistency === 'variable').length
  const failedDates = results.filter(r => r.consistency === 'failed').length
  const cacheHits = results.flatMap(r => r.runs).filter(r => r.cacheHit).length
  const avgDuration = Math.round(results.reduce((sum, r) => sum + r.avgDuration, 0) / results.length)

  const summary = {
    totalDates: count,
    runsPerDate,
    totalRuns,
    successRate: Math.round((successfulRuns / totalRuns) * 100),
    consistentDates,
    variableDates,
    failedDates,
    cacheHits,
    avgDuration
  }

  return NextResponse.json({
    summary,
    results,
    timestamp: new Date().toISOString()
  })
}
