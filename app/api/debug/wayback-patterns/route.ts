// app/api/debug/wayback-patterns/route.ts
// Analyseert HTML patterns over verschillende jaren en bronnen

import { NextRequest, NextResponse } from 'next/server'
import { fetchWithRetry } from '@/lib/waybackFetch'

// Force dynamic rendering - don't try to pre-render during build
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max

// Test verschillende jaren om HTML evolutie te zien
const TEST_YEARS = [
  { year: 2010, month: '06', day: '15' },
  { year: 2012, month: '05', day: '19' },
  { year: 2014, month: '03', day: '10' },
  { year: 2016, month: '05', day: '18' },
  { year: 2018, month: '08', day: '20' },
  { year: 2020, month: '05', day: '18' },
  { year: 2022, month: '03', day: '28' },
  { year: 2024, month: '06', day: '15' }
]

const SOURCES = ['www.nu.nl', 'www.nos.nl', 'nos.nl']

interface PatternAnalysis {
  date: string
  source: string
  protocol: string
  success: boolean
  htmlLength?: number
  patterns?: {
    // Current patterns
    itemTitleAttr: number
    itemTitleSpan: number

    // Legacy patterns to test
    spanClassTitle: number
    h1: number
    h2: number
    h3: number
    h4: number
    divClassTitle: number
    aClassTitle: number

    // Specific NU.nl patterns
    articleLink: number
    newsItem: number

    // Specific NOS.nl patterns
    topStory: number
    featured: number
  }
  sampleHeadlines?: string[]
  error?: string
}

async function analyzeDate(year: number, month: string, day: string, source: string): Promise<PatternAnalysis[]> {
  const date = `${year}-${month}-${day}`
  const dateStr = `${year}${month}${day}`
  const results: PatternAnalysis[] = []

  const protocols = ['http', 'https']

  for (const protocol of protocols) {
    const prefix = source.startsWith('www.') ? `${protocol}://www.` : `${protocol}://`
    const domain = source.replace(/^www\./, '')
    const fullUrl = `${prefix}${domain}/`
    const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${fullUrl}&from=${dateStr}&to=${dateStr}&output=json&filter=statuscode:200&filter=mimetype:text/html&limit=3`

    try {
      const cdxResponse = await fetchWithRetry(cdxUrl, {
        headers: { 'User-Agent': 'Babykrant-Pattern-Analyzer/1.0' }
      })

      if (!cdxResponse.ok || cdxResponse.status === 503) {
        results.push({
          date,
          source,
          protocol,
          success: false,
          error: `CDX ${cdxResponse.status}`
        })
        continue
      }

      const cdxData = await cdxResponse.json()

      if (cdxData.length < 2) {
        results.push({
          date,
          source,
          protocol,
          success: false,
          error: 'No snapshots'
        })
        continue
      }

      // Get first snapshot
      const record = cdxData[1]
      const timestamp = record[1]
      const waybackUrl = `https://web.archive.org/web/${timestamp}/${prefix}${domain}/`

      const htmlResponse = await fetchWithRetry(waybackUrl, {
        headers: {
          'User-Agent': 'Babykrant-Pattern-Analyzer/1.0',
          'Accept': 'text/html'
        }
      })

      if (!htmlResponse.ok) {
        results.push({
          date,
          source,
          protocol,
          success: false,
          error: `Fetch ${htmlResponse.status}`
        })
        continue
      }

      const html = await htmlResponse.text()

      // Test all possible headline patterns
      const patterns = {
        // Current parser patterns
        itemTitleAttr: (html.match(/<span[^>]*title="([^"]+)"[^>]*class="[^"]*item-title__title[^"]*"[^>]*>/gi) || []).length,
        itemTitleSpan: (html.match(/<span[^>]*class="[^"]*item-title__title[^"]*"[^>]*>/gi) || []).length,

        // Legacy patterns
        spanClassTitle: (html.match(/<span[^>]*class="title"[^>]*>([^<]+)<\/span>/gi) || []).length,
        h1: (html.match(/<h1[^>]*>.*?<\/h1>/gi) || []).length,
        h2: (html.match(/<h2[^>]*>.*?<\/h2>/gi) || []).length,
        h3: (html.match(/<h3[^>]*>.*?<\/h3>/gi) || []).length,
        h4: (html.match(/<h4[^>]*>.*?<\/h4>/gi) || []).length,
        divClassTitle: (html.match(/<div[^>]*class="[^"]*title[^"]*"[^>]*>/gi) || []).length,
        aClassTitle: (html.match(/<a[^>]*class="[^"]*title[^"]*"[^>]*>/gi) || []).length,

        // Specific NU.nl patterns
        articleLink: (html.match(/<a[^>]*href="[^"]*\/artikel\/[^"]*"[^>]*>/gi) || []).length,
        newsItem: (html.match(/<[^>]*class="[^"]*news-item[^"]*"[^>]*>/gi) || []).length,

        // Specific NOS.nl patterns
        topStory: (html.match(/<[^>]*class="[^"]*top-story[^"]*"[^>]*>/gi) || []).length,
        featured: (html.match(/<[^>]*class="[^"]*featured[^"]*"[^>]*>/gi) || []).length
      }

      // Extract sample headlines using the best matching pattern
      const sampleHeadlines: string[] = []

      // Try span.title first (legacy)
      const spanTitleMatches = html.match(/<span[^>]*class="title"[^>]*>([^<]+)<\/span>/gi)
      if (spanTitleMatches) {
        spanTitleMatches.slice(0, 3).forEach(match => {
          const content = match.match(/>([^<]+)<\/span>/i)
          if (content && content[1]) {
            sampleHeadlines.push(content[1].trim())
          }
        })
      }

      // Try h3 if no span.title
      if (sampleHeadlines.length === 0) {
        const h3Matches = html.match(/<h3[^>]*>.*?<\/h3>/gi)
        if (h3Matches) {
          h3Matches.slice(0, 3).forEach(match => {
            const cleanText = match.replace(/<[^>]+>/g, '').trim()
            if (cleanText && cleanText.length > 10) {
              sampleHeadlines.push(cleanText)
            }
          })
        }
      }

      results.push({
        date,
        source,
        protocol,
        success: true,
        htmlLength: html.length,
        patterns,
        sampleHeadlines: sampleHeadlines.slice(0, 3)
      })

    } catch (error: any) {
      results.push({
        date,
        source,
        protocol,
        success: false,
        error: error.message
      })
    }
  }

  return results
}

export async function GET(request: NextRequest) {
  console.log('[Pattern Analyzer] Starting analysis...')

  const allResults: PatternAnalysis[] = []

  for (const { year, month, day } of TEST_YEARS) {
    for (const source of SOURCES) {
      console.log(`[Pattern Analyzer] Analyzing ${year}-${month}-${day} ${source}...`)
      const results = await analyzeDate(year, month, day, source)
      allResults.push(...results)

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  // Analyze patterns per year
  const yearlyAnalysis: any = {}

  TEST_YEARS.forEach(({ year }) => {
    const yearResults = allResults.filter(r => r.date.startsWith(`${year}-`) && r.success)

    if (yearResults.length === 0) {
      yearlyAnalysis[year] = { available: false }
      return
    }

    // Find dominant patterns for this year
    const patternCounts: any = {}
    yearResults.forEach(r => {
      if (r.patterns) {
        Object.entries(r.patterns).forEach(([pattern, count]) => {
          if (!patternCounts[pattern]) patternCounts[pattern] = 0
          patternCounts[pattern] += count
        })
      }
    })

    // Sort by most common
    const dominantPatterns = Object.entries(patternCounts)
      .filter(([_, count]) => (count as number) > 0)
      .sort((a: any, b: any) => b[1] - a[1])
      .slice(0, 5)
      .map(([pattern, count]) => ({ pattern, count: count as number }))

    yearlyAnalysis[year] = {
      available: true,
      samples: yearResults.length,
      dominantPatterns,
      sampleHeadlines: yearResults.find(r => r.sampleHeadlines && r.sampleHeadlines.length > 0)?.sampleHeadlines || []
    }
  })

  return NextResponse.json({
    summary: {
      totalTests: allResults.length,
      successful: allResults.filter(r => r.success).length,
      failed: allResults.filter(r => !r.success).length
    },
    yearlyAnalysis,
    detailedResults: allResults
  }, {
    headers: {
      'Content-Type': 'application/json'
    }
  })
}
