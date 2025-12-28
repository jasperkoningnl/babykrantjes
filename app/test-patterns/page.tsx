'use client'

import { useState } from 'react'

const TEST_DATES = [
  { date: '2010-06-15', label: '2010 (vroeg)' },
  { date: '2014-03-10', label: '2014 (mid)' },
  { date: '2016-05-18', label: '2016 (Anne)' },
  { date: '2020-05-18', label: '2020 (recent)' },
  { date: '2022-03-28', label: '2022 (Lena)' }
]

const SOURCES = ['www.nu.nl', 'www.nos.nl']

export default function PatternTestPage() {
  const [results, setResults] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState<string | null>(null)

  const testDate = async (date: string, source: string) => {
    const key = `${date}-${source}`
    setLoading(key)

    try {
      const response = await fetch(`/api/debug/wayback-html?date=${date}&source=${source}`)
      const data = await response.json()

      setResults(prev => ({
        ...prev,
        [key]: data
      }))
    } catch (error: any) {
      setResults(prev => ({
        ...prev,
        [key]: { error: error.message }
      }))
    } finally {
      setLoading(null)
    }
  }

  const copyResult = (key: string) => {
    const result = results[key]
    navigator.clipboard.writeText(JSON.stringify(result, null, 2))
    alert('Resultaat gekopieerd!')
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>Wayback HTML Pattern Tester</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Test handmatig verschillende jaren en bronnen. Klik op een knop, deel het resultaat.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {TEST_DATES.map(({ date, label }) => (
          <div key={date} style={{
            border: '1px solid #ddd',
            borderRadius: '8px',
            padding: '1.5rem',
            backgroundColor: '#f9f9f9'
          }}>
            <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem' }}>
              {date} <span style={{ color: '#666', fontSize: '0.9rem' }}>({label})</span>
            </h2>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              {SOURCES.map(source => {
                const key = `${date}-${source}`
                const isLoading = loading === key
                const hasResult = !!results[key]

                return (
                  <button
                    key={source}
                    onClick={() => testDate(date, source)}
                    disabled={isLoading}
                    style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: hasResult ? '#10b981' : isLoading ? '#ccc' : '#0070f3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: isLoading ? 'wait' : 'pointer',
                      fontSize: '1rem',
                      fontWeight: '500'
                    }}
                  >
                    {isLoading ? '⏳ Testing...' : hasResult ? `✓ ${source}` : `Test ${source}`}
                  </button>
                )
              })}
            </div>

            {/* Results */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {SOURCES.map(source => {
                const key = `${date}-${source}`
                const result = results[key]

                if (!result) return null

                return (
                  <div key={source} style={{
                    backgroundColor: 'white',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    padding: '1rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1rem' }}>{source}</h3>
                      <button
                        onClick={() => copyResult(key)}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: '#f0f0f0',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.9rem'
                        }}
                      >
                        📋 Kopieer JSON
                      </button>
                    </div>

                    {result.error ? (
                      <div style={{ color: '#c00' }}>Error: {result.error}</div>
                    ) : (
                      <div style={{ fontSize: '0.9rem' }}>
                        {result.results?.map((r: any, i: number) => (
                          <div key={i} style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: i < result.results.length - 1 ? '1px solid #eee' : 'none' }}>
                            <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                              {r.protocol.toUpperCase()} {r.success ? '✅' : '❌'}
                            </div>

                            {r.success ? (
                              <>
                                <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
                                  <span style={{ color: '#666' }}>Snapshots:</span>
                                  <span>{r.snapshots}</span>

                                  <span style={{ color: '#666' }}>HTML size:</span>
                                  <span>{(r.htmlLength / 1024).toFixed(1)} KB</span>

                                  <span style={{ color: '#666' }}>item-title__title:</span>
                                  <span>{r.titleAttrMatches + r.spanContentMatches}</span>

                                  <span style={{ color: '#666' }}>Found patterns:</span>
                                  <span>{Object.keys(r.foundPatterns || {}).join(', ') || 'none'}</span>
                                </div>

                                {r.foundPatterns && Object.keys(r.foundPatterns).length > 0 && (
                                  <details style={{ marginTop: '0.5rem' }}>
                                    <summary style={{ cursor: 'pointer', color: '#0070f3' }}>
                                      Show found patterns
                                    </summary>
                                    <pre style={{
                                      fontSize: '0.75rem',
                                      backgroundColor: '#f5f5f5',
                                      padding: '0.5rem',
                                      borderRadius: '4px',
                                      overflow: 'auto',
                                      marginTop: '0.5rem'
                                    }}>
                                      {JSON.stringify(r.foundPatterns, null, 2)}
                                    </pre>
                                  </details>
                                )}
                              </>
                            ) : (
                              <div style={{ color: '#666', fontSize: '0.85rem' }}>
                                {r.error}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div style={{
        marginTop: '2rem',
        padding: '1rem',
        backgroundColor: '#f0f9ff',
        border: '1px solid #bae6fd',
        borderRadius: '8px'
      }}>
        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>📝 Instructies</h3>
        <ol style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
          <li>Test elk jaar met beide bronnen (NU.nl en NOS.nl)</li>
          <li>Voor elk resultaat: klik "Kopieer JSON"</li>
          <li>Deel de JSON outputs met Claude</li>
          <li>Claude analyseert de patterns en bouwt de juiste parser</li>
        </ol>
      </div>
    </div>
  )
}
