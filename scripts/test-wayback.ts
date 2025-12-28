#!/usr/bin/env tsx
// scripts/test-wayback.ts
// Standalone test script for Wayback Machine scraper
// Tests multiple dates and generates detailed report

import { fetchWithRetry } from '../lib/waybackFetch'

// Test dates (mix of known good dates and edge cases)
const TEST_DATES = [
  { date: '2022-03-28', label: 'Lena (28 maart 2022)' },
  { date: '2012-05-19', label: 'Anne (19 mei 2012)' },
  { date: '2020-05-18', label: 'Known good (18 mei 2020)' },
  { date: '2019-03-25', label: 'Brexit period (25 mrt 2019)' },
  { date: '2015-01-15', label: 'Mid-range (15 jan 2015)' },
  { date: '2023-10-15', label: 'Recent (15 okt 2023)' },
  { date: '2024-12-21', label: 'Very recent (21 dec 2024)' },
  { date: '2025-01-15', label: 'Current (15 jan 2025)' },
  { date: '2010-06-20', label: 'Older (20 jun 2010)' },
]

const NEWS_SOURCES = ['www.nu.nl', 'www.nos.nl', 'nos.nl']
const CDX_LIMIT = 20
const MIN_HEADLINES = 10

interface TestResult {
  date: string
  label: string
  source: string
  success: boolean
  snapshotsFound: number
  selectedSnapshot?: {
    timestamp: string
    hour: number
    score: number
  }
  headlineCount: number
  error?: string
  duration: number
}

const results: TestResult[] = []

/**
 * Test CDX API for a specific date and source
 */
async function testCDXQuery(date: string, source: string): Promise<{
  snapshots: any[]
  error?: string
}> {
  const [year, month, day] = date.split('-')
  const dateStr = `${year}${month}${day}`
  const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${source}&from=${dateStr}&to=${dateStr}&output=json&filter=statuscode:200&filter=mimetype:text/html&limit=${CDX_LIMIT}`

  console.log(`  📡 CDX query: ${cdxUrl}`)

  try {
    const response = await fetchWithRetry(cdxUrl, {
      headers: {
        'User-Agent': 'Babykrant/1.0 (educational project; test mode)'
      }
    })

    if (!response.ok) {
      return { snapshots: [], error: `HTTP ${response.status}` }
    }

    const data = await response.json()

    if (!Array.isArray(data) || data.length < 2) {
      return { snapshots: [], error: 'No snapshots found' }
    }

    // Skip header row
    return { snapshots: data.slice(1) }
  } catch (error: any) {
    return { snapshots: [], error: error.message }
  }
}

/**
 * Fetch and parse snapshot HTML
 */
async function testSnapshotFetch(timestamp: string, source: string): Promise<{
  headlines: number
  error?: string
}> {
  const protocol = source.startsWith('www.') ? 'https://www.' : 'https://'
  const domain = source.replace(/^www\./, '')
  const waybackUrl = `https://web.archive.org/web/${timestamp}/${protocol}${domain}/`

  console.log(`  📄 Fetching snapshot: ${waybackUrl}`)

  try {
    const response = await fetchWithRetry(waybackUrl, {
      headers: {
        'User-Agent': 'Babykrant/1.0 (educational project; test mode)',
        'Accept': 'text/html'
      }
    })

    if (!response.ok) {
      return { headlines: 0, error: `HTTP ${response.status}` }
    }

    const html = await response.text()

    // Quick headline count (nu.nl pattern)
    const titleMatches = html.match(/<span[^>]*class="[^"]*item-title__title[^"]*"[^>]*>/g)
    const headlineCount = titleMatches ? titleMatches.length : 0

    return { headlines: headlineCount }
  } catch (error: any) {
    return { headlines: 0, error: error.message }
  }
}

/**
 * Test a single date/source combination
 */
async function testDateSource(date: string, label: string, source: string): Promise<TestResult> {
  console.log(`\n🔍 Testing ${label} - ${source}`)
  const startTime = Date.now()

  const result: TestResult = {
    date,
    label,
    source,
    success: false,
    snapshotsFound: 0,
    headlineCount: 0,
    duration: 0
  }

  try {
    // Step 1: Query CDX API
    const cdxResult = await testCDXQuery(date, source)

    if (cdxResult.error) {
      result.error = `CDX: ${cdxResult.error}`
      result.duration = Date.now() - startTime
      return result
    }

    result.snapshotsFound = cdxResult.snapshots.length
    console.log(`  ✓ Found ${result.snapshotsFound} snapshots`)

    if (result.snapshotsFound === 0) {
      result.error = 'No snapshots available'
      result.duration = Date.now() - startTime
      return result
    }

    // Step 2: Apply smart selection
    const snapshots = cdxResult.snapshots.map((record: any) => {
      const timestamp = record[1]
      const hour = parseInt(timestamp.substring(8, 10))

      let score = 1
      if (hour >= 12 && hour <= 20) score = 10
      else if (hour >= 8 && hour < 12) score = 5

      return {
        timestamp,
        url: record[2],
        hour,
        score
      }
    })

    snapshots.sort((a, b) => b.score - a.score)
    const best = snapshots[0]

    result.selectedSnapshot = {
      timestamp: best.timestamp,
      hour: best.hour,
      score: best.score
    }

    console.log(`  ⭐ Selected snapshot: ${best.hour}:${best.timestamp.substring(10, 12)} (score: ${best.score})`)

    // Step 3: Fetch snapshot and count headlines
    const fetchResult = await testSnapshotFetch(best.timestamp, source)

    if (fetchResult.error) {
      result.error = `Fetch: ${fetchResult.error}`
      result.duration = Date.now() - startTime
      return result
    }

    result.headlineCount = fetchResult.headlines
    result.success = result.headlineCount >= MIN_HEADLINES

    console.log(`  ${result.success ? '✅' : '⚠️'} Headlines found: ${result.headlineCount} (threshold: ${MIN_HEADLINES})`)

  } catch (error: any) {
    result.error = `Unexpected: ${error.message}`
  }

  result.duration = Date.now() - startTime
  return result
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║  WAYBACK MACHINE SCRAPER - DIAGNOSTIC TEST SUITE          ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  console.log(`\nTesting ${TEST_DATES.length} dates × ${NEWS_SOURCES.length} sources = ${TEST_DATES.length * NEWS_SOURCES.length} total tests`)
  console.log(`Minimum headline threshold: ${MIN_HEADLINES}`)
  console.log(`CDX limit: ${CDX_LIMIT} snapshots\n`)

  const startTime = Date.now()

  // Test each date with primary source first
  for (const { date, label } of TEST_DATES) {
    console.log(`\n${'='.repeat(70)}`)
    console.log(`📅 ${label} (${date})`)
    console.log('='.repeat(70))

    // Test primary source (www.nu.nl)
    const primaryResult = await testDateSource(date, label, NEWS_SOURCES[0])
    results.push(primaryResult)

    // If primary fails, try fallbacks
    if (!primaryResult.success) {
      console.log(`  ℹ️  Primary source failed/insufficient, trying fallbacks...`)

      for (const fallbackSource of NEWS_SOURCES.slice(1)) {
        const fallbackResult = await testDateSource(date, label, fallbackSource)
        results.push(fallbackResult)

        if (fallbackResult.success) {
          console.log(`  ✅ Fallback source ${fallbackSource} succeeded!`)
          break
        }
      }
    }
  }

  const totalDuration = Date.now() - startTime

  // Generate report
  console.log('\n\n╔════════════════════════════════════════════════════════════╗')
  console.log('║  TEST REPORT                                               ║')
  console.log('╚════════════════════════════════════════════════════════════╝\n')

  // Summary statistics
  const successCount = results.filter(r => r.success).length
  const failCount = results.filter(r => !r.success).length
  const avgDuration = Math.round(results.reduce((sum, r) => sum + r.duration, 0) / results.length)

  console.log('📊 SUMMARY:')
  console.log(`   Total tests: ${results.length}`)
  console.log(`   ✅ Success: ${successCount} (${Math.round(successCount / results.length * 100)}%)`)
  console.log(`   ❌ Failed: ${failCount} (${Math.round(failCount / results.length * 100)}%)`)
  console.log(`   ⏱️  Avg duration: ${avgDuration}ms`)
  console.log(`   ⏱️  Total duration: ${Math.round(totalDuration / 1000)}s\n`)

  // Per-date summary
  console.log('📅 PER DATE RESULTS:')
  for (const { date, label } of TEST_DATES) {
    const dateResults = results.filter(r => r.date === date)
    const dateSuccess = dateResults.find(r => r.success)
    const primaryResult = dateResults.find(r => r.source === NEWS_SOURCES[0])

    if (dateSuccess) {
      console.log(`   ✅ ${label}`)
      console.log(`      Source: ${dateSuccess.source}`)
      console.log(`      Headlines: ${dateSuccess.headlineCount}`)
      console.log(`      Snapshots: ${dateSuccess.snapshotsFound}`)
      if (dateSuccess.selectedSnapshot) {
        console.log(`      Selected: ${dateSuccess.selectedSnapshot.hour}:00 (score: ${dateSuccess.selectedSnapshot.score})`)
      }
    } else {
      console.log(`   ❌ ${label}`)
      if (primaryResult) {
        console.log(`      Primary: ${primaryResult.error || 'No headlines'}`)
        console.log(`      Snapshots: ${primaryResult.snapshotsFound}`)
        console.log(`      Headlines: ${primaryResult.headlineCount}`)
      }
    }
  }

  // Detailed errors
  const errors = results.filter(r => r.error)
  if (errors.length > 0) {
    console.log('\n⚠️  ERRORS ENCOUNTERED:')
    const errorTypes = new Map<string, number>()
    errors.forEach(r => {
      const errorType = r.error?.split(':')[0] || 'Unknown'
      errorTypes.set(errorType, (errorTypes.get(errorType) || 0) + 1)
    })
    errorTypes.forEach((count, type) => {
      console.log(`   ${type}: ${count} occurrences`)
    })
  }

  // Recommendations
  console.log('\n💡 RECOMMENDATIONS:')

  const lowSnapshotResults = results.filter(r => r.snapshotsFound > 0 && r.snapshotsFound < 5)
  if (lowSnapshotResults.length > 0) {
    console.log(`   ⚠️  ${lowSnapshotResults.length} dates have <5 snapshots (CDX_LIMIT might be too low)`)
  }

  const belowThresholdResults = results.filter(r => r.headlineCount > 0 && r.headlineCount < MIN_HEADLINES)
  if (belowThresholdResults.length > 0) {
    console.log(`   ⚠️  ${belowThresholdResults.length} dates have headlines but below threshold (threshold might be too strict)`)
    const avgBelow = Math.round(belowThresholdResults.reduce((sum, r) => sum + r.headlineCount, 0) / belowThresholdResults.length)
    console.log(`       Average headlines in these cases: ${avgBelow}`)
  }

  const noSnapshotsResults = results.filter(r => r.snapshotsFound === 0)
  if (noSnapshotsResults.length > 0) {
    console.log(`   ⚠️  ${noSnapshotsResults.length} date/source combinations have no snapshots (Wayback coverage issue)`)
  }

  console.log('\n✅ Test suite completed!')
  console.log(`   Results saved to: test-wayback-results.json\n`)

  // Save detailed results to JSON
  const reportData = {
    summary: {
      totalTests: results.length,
      successCount,
      failCount,
      successRate: Math.round(successCount / results.length * 100),
      avgDuration,
      totalDuration
    },
    results,
    timestamp: new Date().toISOString()
  }

  const fs = await import('fs/promises')
  await fs.writeFile(
    'test-wayback-results.json',
    JSON.stringify(reportData, null, 2)
  )
}

// Run tests
runTests().catch(console.error)
