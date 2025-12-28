'use client'

import { useState } from 'react'

const TEST_DATES = [
  { date: '2011-09-12', label: '2011 (vroeg test)' },
  { date: '2015-01-15', label: '2015 (mid test)' },
  { date: '2017-07-20', label: '2017 (legacy test)' },
  { date: '2019-03-25', label: '2019 (modern test)' },
  { date: '2023-06-10', label: '2023 (recent test)' }
]

export default function PatternTestPage() {
  const [results, setResults] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState<string | null>(null)

  const testDate = async (date: string) => {
    setLoading(date)

    try {
      const response = await fetch(`/api/news/wayback?date=${date}`)
      const data = await response.json()

      setResults(prev => ({
        ...prev,
        [date]: data
      }))
    } catch (error: any) {
      setResults(prev => ({
        ...prev,
        [date]: { error: error.message }
      }))
    } finally {
      setLoading(null)
    }
  }

  const copyResult = (date: string) => {
    const result = results[date]
    navigator.clipboard.writeText(JSON.stringify(result, null, 2))
    alert('Resultaat gekopieerd!')
  }

  const clearCache = async (date: string) => {
    if (!confirm(`Cache voor ${date} verwijderen?`)) return

    try {
      await fetch(`/api/news/wayback?date=${date}&clearCache=true`)
      // Clear local result
      setResults(prev => {
        const newResults = { ...prev }
        delete newResults[date]
        return newResults
      })
      alert('Cache gecleared! Test opnieuw.')
    } catch (error: any) {
      alert('Fout bij clearen cache: ' + error.message)
    }
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>Wayback Parser Tester (v1.7.1)</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Test de nieuwe multi-year parser met noise filtering en duplicate prevention.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {TEST_DATES.map(({ date, label }) => {
          const result = results[date]
          const isLoading = loading === date
          const hasResult = !!result

          return (
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
                <button
                  onClick={() => testDate(date)}
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
                  {isLoading ? '⏳ Testing...' : hasResult ? `✓ Getest` : `Test ${date}`}
                </button>

                {hasResult && (
                  <>
                    <button
                      onClick={() => copyResult(date)}
                      style={{
                        padding: '0.75rem 1.5rem',
                        backgroundColor: '#f0f0f0',
                        color: '#333',
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '1rem'
                      }}
                    >
                      📋 Kopieer JSON
                    </button>

                    <button
                      onClick={() => clearCache(date)}
                      style={{
                        padding: '0.75rem 1.5rem',
                        backgroundColor: '#fee',
                        color: '#c00',
                        border: '1px solid #fcc',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '1rem'
                      }}
                    >
                      🗑️ Clear Cache
                    </button>
                  </>
                )}
              </div>

              {/* Results */}
              {result && (
                <div style={{
                  backgroundColor: 'white',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  padding: '1rem'
                }}>
                  {result.error ? (
                    <div style={{ color: '#c00', fontWeight: 'bold' }}>
                      ❌ Error: {result.error}
                    </div>
                  ) : (
                    <>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '180px 1fr',
                        gap: '0.75rem',
                        fontSize: '0.95rem',
                        marginBottom: '1rem',
                        paddingBottom: '1rem',
                        borderBottom: '2px solid #eee'
                      }}>
                        <span style={{ fontWeight: 'bold' }}>Status:</span>
                        <span style={{ color: result.totalHeadlines > 0 ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                          {result.totalHeadlines > 0 ? '✅ SUCCESS' : '❌ NO HEADLINES'}
                        </span>

                        <span style={{ fontWeight: 'bold' }}>Total Headlines:</span>
                        <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#0070f3' }}>
                          {result.totalHeadlines}
                        </span>

                        <span style={{ fontWeight: 'bold' }}>Sources:</span>
                        <span>{result.sources?.join(', ') || 'none'}</span>

                        <span style={{ fontWeight: 'bold' }}>API Version:</span>
                        <span>{result.apiVersion}</span>

                        <span style={{ fontWeight: 'bold' }}>Cache Hit:</span>
                        <span>{result.cacheHit ? '⚡ Yes' : '🌐 No (fresh)'}</span>

                        {result.snapshotTimestamp && (
                          <>
                            <span style={{ fontWeight: 'bold' }}>Snapshot:</span>
                            <a
                              href={result.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: '#0070f3', textDecoration: 'underline' }}
                            >
                              {result.snapshotTimestamp.substring(0, 8)} {result.snapshotTimestamp.substring(8, 10)}:{result.snapshotTimestamp.substring(10, 12)}
                            </a>
                          </>
                        )}
                      </div>

                      {/* Headlines preview */}
                      {result.headlines && result.headlines.length > 0 && (
                        <details open={result.totalHeadlines < 20}>
                          <summary style={{
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            color: '#0070f3',
                            marginBottom: '0.5rem'
                          }}>
                            📰 Headlines ({result.headlines.length})
                          </summary>
                          <div style={{
                            maxHeight: '400px',
                            overflowY: 'auto',
                            fontSize: '0.85rem',
                            marginTop: '0.5rem'
                          }}>
                            {result.headlines.slice(0, 50).map((h: any, i: number) => (
                              <div
                                key={i}
                                style={{
                                  padding: '0.5rem',
                                  borderBottom: '1px solid #eee',
                                  backgroundColor: i % 2 === 0 ? '#fafafa' : 'white'
                                }}
                              >
                                <div style={{ fontWeight: '500', color: '#333' }}>
                                  {i + 1}. {h.title}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                                  {h.source} {h.category ? `• ${h.category}` : ''} {h.time ? `• ${h.time}` : ''}
                                </div>
                              </div>
                            ))}
                            {result.headlines.length > 50 && (
                              <div style={{ padding: '0.5rem', color: '#666', fontStyle: 'italic' }}>
                                ... en {result.headlines.length - 50} meer
                              </div>
                            )}
                          </div>
                        </details>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
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
          <li>Test elk jaar met de knop (gebruikt v1.7.1 parser met noise filtering)</li>
          <li>Check of &quot;Total Headlines&quot; &gt; 0 en minder duplicaten/ruis</li>
          <li>Bekijk welke bronnen gebruikt werden (NU.nl of NOS.nl fallback)</li>
          <li>Kopieer JSON om te delen of debuggen</li>
          <li>Clear Cache om opnieuw te testen zonder cache</li>
        </ol>
      </div>
    </div>
  )
}
