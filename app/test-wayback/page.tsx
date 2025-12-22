'use client'

import { useState } from 'react'

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

interface TestResult {
  summary: {
    totalDates: number
    runsPerDate: number
    totalRuns: number
    successRate: number
    consistentDates: number
    variableDates: number
    failedDates: number
    cacheHits: number
    avgDuration: number
  }
  results: DateTestResult[]
  timestamp: string
}

export default function TestWaybackPage() {
  const [testing, setTesting] = useState(false)
  const [progress, setProgress] = useState('')
  const [result, setResult] = useState<TestResult | null>(null)
  const [error, setError] = useState('')

  const startTest = async () => {
    setTesting(true)
    setProgress('Starting test...')
    setResult(null)
    setError('')

    try {
      const response = await fetch('/api/test/wayback?count=10&runs=3')

      if (!response.ok) {
        throw new Error(`Test failed: ${response.status}`)
      }

      const data = await response.json()
      setResult(data)
      setProgress('Test completed!')
    } catch (err: any) {
      setError(err.message)
      setProgress('Test failed')
    } finally {
      setTesting(false)
    }
  }

  const generateReport = (data: TestResult): string => {
    const lines: string[] = []

    lines.push('═══════════════════════════════════════════════════════════')
    lines.push('  WAYBACK MACHINE SCRAPER - TEST RAPPORT')
    lines.push('═══════════════════════════════════════════════════════════')
    lines.push('')
    lines.push(`Test uitgevoerd: ${new Date(data.timestamp).toLocaleString('nl-NL')}`)
    lines.push('')

    // Summary
    lines.push('📊 SAMENVATTING')
    lines.push('───────────────────────────────────────────────────────────')
    lines.push(`Datums getest:        ${data.summary.totalDates}`)
    lines.push(`Runs per datum:       ${data.summary.runsPerDate}`)
    lines.push(`Totaal runs:          ${data.summary.totalRuns}`)
    lines.push(`Success rate:         ${data.summary.successRate}%`)
    lines.push(`Consistent:           ${data.summary.consistentDates} datums`)
    lines.push(`Variabel:             ${data.summary.variableDates} datums`)
    lines.push(`Gefaald:              ${data.summary.failedDates} datums`)
    lines.push(`Cache hits:           ${data.summary.cacheHits}`)
    lines.push(`Gemiddelde duur:      ${data.summary.avgDuration}ms`)
    lines.push('')

    // Per date results
    lines.push('📅 RESULTATEN PER DATUM')
    lines.push('───────────────────────────────────────────────────────────')

    data.results.forEach((dateResult, index) => {
      const status = dateResult.consistency === 'consistent' ? '✅' :
                     dateResult.consistency === 'variable' ? '⚠️' : '❌'

      lines.push(`\n${index + 1}. ${status} ${dateResult.date} (${dateResult.consistency.toUpperCase()})`)

      dateResult.runs.forEach(run => {
        const runStatus = run.success ? '✓' : '✗'
        const cache = run.cacheHit ? '[CACHE]' : '[LIVE]'
        const info = run.success
          ? `${run.headlines} headlines, ${run.duration}ms ${cache}`
          : `Error: ${run.error}`

        if (run.success && run.source) {
          lines.push(`   Run ${run.runNumber}: ${runStatus} ${info}`)
          lines.push(`            Source: ${run.source}, Time: ${run.snapshotTime || 'unknown'}`)
        } else {
          lines.push(`   Run ${run.runNumber}: ${runStatus} ${info}`)
        }
      })

      if (dateResult.consistency !== 'failed') {
        lines.push(`   → Gemiddeld: ${dateResult.avgHeadlines} headlines, ${dateResult.avgDuration}ms`)
      }
    })

    // Issues found
    lines.push('')
    lines.push('⚠️  GEVONDEN ISSUES')
    lines.push('───────────────────────────────────────────────────────────')

    const variableResults = data.results.filter(r => r.consistency === 'variable')
    if (variableResults.length > 0) {
      lines.push(`\nInconsistente resultaten (${variableResults.length} datums):`)
      variableResults.forEach(r => {
        const counts = r.runs.map(run => run.headlines).join(', ')
        lines.push(`  • ${r.date}: ${counts} headlines`)
      })
    }

    const failedResults = data.results.filter(r => r.consistency === 'failed')
    if (failedResults.length > 0) {
      lines.push(`\nGefaalde datums (${failedResults.length} datums):`)
      failedResults.forEach(r => {
        const errorSet = new Set(r.runs.map(run => run.error).filter(Boolean))
        const errors = Array.from(errorSet)
        lines.push(`  • ${r.date}: ${errors.join(', ')}`)
      })
    }

    const slowResults = data.results.filter(r => r.avgDuration > 10000)
    if (slowResults.length > 0) {
      lines.push(`\nTrage requests (>10s, ${slowResults.length} datums):`)
      slowResults.forEach(r => {
        lines.push(`  • ${r.date}: ${r.avgDuration}ms gemiddeld`)
      })
    }

    // Recommendations
    lines.push('')
    lines.push('💡 AANBEVELINGEN')
    lines.push('───────────────────────────────────────────────────────────')

    if (data.summary.successRate < 70) {
      lines.push('⚠️  Success rate is laag (<70%). Mogelijke oorzaken:')
      lines.push('   - Wayback Machine downtime')
      lines.push('   - Rate limiting issues')
      lines.push('   - Timeout te kort')
    }

    if (variableResults.length > 2) {
      lines.push('⚠️  Veel inconsistente resultaten. Mogelijke oorzaken:')
      lines.push('   - HTML parsing faalt sporadisch')
      lines.push('   - Verschillende snapshots worden geselecteerd')
      lines.push('   - Cache inconsistentie')
    }

    if (slowResults.length > 3) {
      lines.push('⚠️  Veel trage requests (>10s). Overweeg:')
      lines.push('   - Retry timeout verlagen')
      lines.push('   - Parallelle requests implementeren')
    }

    if (data.summary.successRate >= 80 && variableResults.length <= 2) {
      lines.push('✅ Scraper presteert goed!')
      lines.push('   Success rate is hoog en resultaten zijn consistent.')
    }

    lines.push('')
    lines.push('═══════════════════════════════════════════════════════════')
    lines.push('  EINDE RAPPORT')
    lines.push('═══════════════════════════════════════════════════════════')

    return lines.join('\n')
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem', fontFamily: 'system-ui' }}>
      <h1 style={{ marginBottom: '2rem' }}>Wayback Machine Scraper Test</h1>

      <div style={{ marginBottom: '2rem' }}>
        <button
          onClick={startTest}
          disabled={testing}
          style={{
            padding: '1rem 2rem',
            fontSize: '1.1rem',
            backgroundColor: testing ? '#ccc' : '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: testing ? 'not-allowed' : 'pointer',
            fontWeight: 'bold'
          }}
        >
          {testing ? 'Testing...' : 'Start Test'}
        </button>

        {testing && (
          <div style={{ marginTop: '1rem' }}>
            <div style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>{progress}</div>
            <div style={{
              width: '100%',
              height: '8px',
              backgroundColor: '#eee',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: '100%',
                height: '100%',
                backgroundColor: '#0070f3',
                animation: 'pulse 1.5s ease-in-out infinite'
              }} />
            </div>
          </div>
        )}
      </div>

      {error && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '8px',
          marginBottom: '2rem',
          color: '#c00'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div>
          <div style={{
            display: 'flex',
            gap: '1rem',
            marginBottom: '1rem',
            flexWrap: 'wrap'
          }}>
            <div style={{
              padding: '1rem',
              backgroundColor: '#f0f9ff',
              borderRadius: '8px',
              flex: '1',
              minWidth: '200px'
            }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                {result.summary.successRate}%
              </div>
              <div style={{ color: '#666' }}>Success Rate</div>
            </div>

            <div style={{
              padding: '1rem',
              backgroundColor: '#f0fdf4',
              borderRadius: '8px',
              flex: '1',
              minWidth: '200px'
            }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                {result.summary.consistentDates}/{result.summary.totalDates}
              </div>
              <div style={{ color: '#666' }}>Consistent</div>
            </div>

            <div style={{
              padding: '1rem',
              backgroundColor: '#fefce8',
              borderRadius: '8px',
              flex: '1',
              minWidth: '200px'
            }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                {result.summary.avgDuration}ms
              </div>
              <div style={{ color: '#666' }}>Avg Duration</div>
            </div>
          </div>

          <div style={{
            backgroundColor: '#f8f9fa',
            padding: '1.5rem',
            borderRadius: '8px',
            marginTop: '2rem'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem'
            }}>
              <h2 style={{ margin: 0 }}>Gedetailleerd Rapport</h2>
              <button
                onClick={() => {
                  const text = generateReport(result)
                  navigator.clipboard.writeText(text)
                  alert('Rapport gekopieerd naar clipboard!')
                }}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#0070f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                📋 Kopieer Rapport
              </button>
            </div>

            <pre style={{
              backgroundColor: 'white',
              padding: '1.5rem',
              borderRadius: '4px',
              overflow: 'auto',
              fontSize: '0.9rem',
              lineHeight: '1.6',
              border: '1px solid #ddd',
              maxHeight: '600px'
            }}>
              {generateReport(result)}
            </pre>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}
