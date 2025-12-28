// app/api/debug/wayback-html/route.ts
// Debug endpoint to inspect raw Wayback HTML

import { NextRequest, NextResponse } from 'next/server'
import { fetchWithRetry } from '@/lib/waybackFetch'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const date = searchParams.get('date')
  const source = searchParams.get('source') || 'www.nu.nl'

  if (!date) {
    return NextResponse.json({ error: 'Date parameter required (YYYY-MM-DD)' }, { status: 400 })
  }

  const [year, month, day] = date.split('-')
  const dateStr = `${year}${month}${day}`

  // Try HTTP first (for older dates like 2016)
  const protocols = ['http', 'https']
  const results: any[] = []

  for (const protocol of protocols) {
    const prefix = source.startsWith('www.') ? `${protocol}://www.` : `${protocol}://`
    const domain = source.replace(/^www\./, '')
    const fullUrl = `${prefix}${domain}/`

    // Step 1: Query CDX
    const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${fullUrl}&from=${dateStr}&to=${dateStr}&output=json&filter=statuscode:200&filter=mimetype:text/html&limit=5`

    try {
      const cdxResponse = await fetchWithRetry(cdxUrl, {
        headers: { 'User-Agent': 'Babykrant-Debug/1.0' }
      })

      if (!cdxResponse.ok) {
        results.push({
          protocol,
          cdxUrl,
          cdxStatus: cdxResponse.status,
          error: 'CDX query failed'
        })
        continue
      }

      const cdxData = await cdxResponse.json()

      if (cdxData.length < 2) {
        results.push({
          protocol,
          cdxUrl,
          snapshots: 0,
          message: 'No snapshots found'
        })
        continue
      }

      // Get first snapshot (skip header)
      const record = cdxData[1]
      const timestamp = record[1]
      const original = record[2]

      // Step 2: Fetch snapshot HTML
      const waybackUrl = `https://web.archive.org/web/${timestamp}/${prefix}${domain}/`

      const htmlResponse = await fetchWithRetry(waybackUrl, {
        headers: {
          'User-Agent': 'Babykrant-Debug/1.0',
          'Accept': 'text/html'
        }
      })

      if (!htmlResponse.ok) {
        results.push({
          protocol,
          cdxUrl,
          waybackUrl,
          snapshots: cdxData.length - 1,
          timestamp,
          original,
          fetchStatus: htmlResponse.status,
          error: 'Snapshot fetch failed'
        })
        continue
      }

      const html = await htmlResponse.text()

      // Test regex patterns
      const titleAttrPattern = /<span[^>]*title="([^"]+)"[^>]*class="[^"]*item-title__title[^"]*"[^>]*>/gi
      const spanContentPattern = /<span[^>]*class="[^"]*item-title__title[^"]*"[^>]*>(?:<!--.*?-->)?\s*([^<]+)\s*<\/span>/gi

      const titleAttrMatches = html.match(titleAttrPattern) || []
      const spanContentMatches = html.match(spanContentPattern) || []

      // Extract first 3000 chars for inspection
      const htmlPreview = html.substring(0, 3000)

      // Look for ANY headlines in HTML
      const anyHeadlinePatterns = [
        /<h1[^>]*>(.*?)<\/h1>/gi,
        /<h2[^>]*>(.*?)<\/h2>/gi,
        /<h3[^>]*>(.*?)<\/h3>/gi,
        /<title>(.*?)<\/title>/gi
      ]

      const foundPatterns: any = {}
      anyHeadlinePatterns.forEach((pattern, i) => {
        const matches = html.match(pattern)
        if (matches && matches.length > 0) {
          foundPatterns[`h${i+1}_or_title`] = matches.slice(0, 3)
        }
      })

      results.push({
        protocol,
        cdxUrl,
        waybackUrl,
        snapshots: cdxData.length - 1,
        timestamp,
        original,
        fetchStatus: 200,
        htmlLength: html.length,
        titleAttrMatches: titleAttrMatches.length,
        spanContentMatches: spanContentMatches.length,
        foundPatterns,
        htmlPreview,
        cdxRecords: cdxData.slice(1, 4) // First 3 snapshots
      })

    } catch (error: any) {
      results.push({
        protocol,
        cdxUrl,
        error: error.message
      })
    }
  }

  return NextResponse.json({
    date,
    source,
    results
  }, {
    headers: {
      'Content-Type': 'application/json'
    }
  })
}
