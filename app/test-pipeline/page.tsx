'use client'

import { useState, useCallback } from 'react'

interface TokenCost {
  input: number
  output: number
  inputCostPer1M: number
  outputCostPer1M: number
  totalCostUSD: number
}

interface StepResult {
  model: string
  text: string
  tokens: TokenCost
  durationMs: number
  error?: string
}

interface PipelineResult {
  datum: string
  roepnaam: string
  sectie: 'nieuws' | 'cultuur'
  variant: 'chatgpt' | 'gemini'
  stap1: StepResult
  stap2: StepResult
}

const DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag']
const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']

function dateToLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return `${DAGEN[d.getDay()]} ${d.getDate()} ${MAANDEN[d.getMonth()]} ${d.getFullYear()}`
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

const ROEPNAAM = 'Lena'

function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

function formatCost(usd: number): string {
  return `$${usd.toFixed(4)}`
}

function StepCard({ label, result }: { label: string; result: StepResult }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, marginBottom: 8, background: result.error ? '#fef2f2' : '#f9fafb' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
        <div>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span>
          <span style={{ color: '#6b7280', fontSize: 13, marginLeft: 8 }}>{result.model}</span>
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 13, color: '#6b7280' }}>
          {result.error ? (
            <span style={{ color: '#ef4444' }}>Fout</span>
          ) : (
            <>
              <span>{result.tokens.input + result.tokens.output} tokens</span>
              <span>{formatDuration(result.durationMs)}</span>
              <span>{formatCost(result.tokens.totalCostUSD)}</span>
            </>
          )}
          <span style={{ fontSize: 12 }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>
      {expanded && (
        <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6 }}>
          {result.error ? (
            <div style={{ color: '#ef4444', fontFamily: 'monospace', fontSize: 13, whiteSpace: 'pre-wrap' }}>{result.error}</div>
          ) : (
            <div style={{ whiteSpace: 'pre-wrap', background: 'white', padding: 12, borderRadius: 6, border: '1px solid #e5e7eb' }}>{result.text}</div>
          )}
        </div>
      )}
    </div>
  )
}

function ResultCard({ result }: { result: PipelineResult }) {
  const variantLabel = result.variant === 'chatgpt' ? 'ChatGPT' : 'Gemini'
  const totalCost = result.stap1.tokens.totalCostUSD + result.stap2.tokens.totalCostUSD
  const totalDuration = result.stap1.durationMs + result.stap2.durationMs

  return (
    <div style={{ border: '1px solid #d1d5db', borderRadius: 12, padding: 16, background: 'white' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
          {result.sectie === 'nieuws' ? 'Nieuws' : 'Cultuur'} — {variantLabel} → Claude
        </h3>
        <div style={{ fontSize: 13, color: '#6b7280' }}>
          {formatDuration(totalDuration)} | {formatCost(totalCost)}
        </div>
      </div>
      <StepCard label="Stap 1: Feiten" result={result.stap1} />
      <StepCard label="Stap 2: Artikel" result={result.stap2} />
    </div>
  )
}

function ComparisonView({ results, sectie }: { results: PipelineResult[]; sectie: 'nieuws' | 'cultuur' }) {
  const chatgpt = results.find(r => r.sectie === sectie && r.variant === 'chatgpt')
  const gemini = results.find(r => r.sectie === sectie && r.variant === 'gemini')
  if (!chatgpt || !gemini) return null

  return (
    <div style={{ marginTop: 16 }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
        {sectie === 'nieuws' ? 'Nieuws' : 'Cultuur'} — ChatGPT vs Gemini
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>ChatGPT → Claude</div>
          <div style={{ background: '#f0f9ff', padding: 12, borderRadius: 8, fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', minHeight: 120 }}>
            {chatgpt.stap2.error || chatgpt.stap2.text || '(geen output)'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Gemini → Claude</div>
          <div style={{ background: '#f0fdf4', padding: 12, borderRadius: 8, fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', minHeight: 120 }}>
            {gemini.stap2.error || gemini.stap2.text || '(geen output)'}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function TestPipelinePage() {
  const [dateInput, setDateInput] = useState(todayISO())
  const [testDates, setTestDates] = useState<string[]>(['2025-01-14', '2026-08-21', '2014-03-12'])
  const [running, setRunning] = useState(false)
  const [runningLabel, setRunningLabel] = useState('')
  const [progress, setProgress] = useState<string>('')
  const [stepsDone, setStepsDone] = useState(0)
  const [totalSteps, setTotalSteps] = useState(0)
  const [results, setResults] = useState<PipelineResult[]>([])
  const [totalCost, setTotalCost] = useState<number | null>(null)
  const [allRuns, setAllRuns] = useState<Array<{ datum: string; results: PipelineResult[]; totalCost: number }>>([])

  const addDate = useCallback(() => {
    if (dateInput && !testDates.includes(dateInput)) {
      setTestDates(prev => [...prev, dateInput])
    }
  }, [dateInput, testDates])

  const removeDate = useCallback((d: string) => {
    setTestDates(prev => prev.filter(x => x !== d))
  }, [])

  const runPipeline = useCallback(async (isoDate: string) => {
    const datum = dateToLabel(isoDate)
    setRunning(true)
    setRunningLabel(datum)
    setResults([])
    setTotalCost(null)
    setStepsDone(0)
    setTotalSteps(8)
    setProgress('Pipeline starten...')

    try {
      const res = await fetch('/api/test/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datum, roepnaam: ROEPNAAM }),
      })

      if (!res.ok) {
        const err = await res.text()
        setProgress(`Fout: ${err}`)
        setRunning(false)
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        let currentEvent = ''
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7)
          } else if (line.startsWith('data: ') && currentEvent) {
            const data = JSON.parse(line.slice(6))
            if (currentEvent === 'progress') {
              const phaseLabel = data.phase === 'feiten' ? 'feiten ophalen' : 'artikel schrijven'
              const variantLabel = data.variant === 'chatgpt' ? 'ChatGPT' : 'Gemini'
              setProgress(`${data.sectie} / ${variantLabel}: ${phaseLabel}...`)
              setTotalSteps(data.total)
              setStepsDone(data.step - 1)
            } else if (currentEvent === 'step_done') {
              setStepsDone(data.step)
            } else if (currentEvent === 'result') {
              setResults(prev => [...prev, data as PipelineResult])
            } else if (currentEvent === 'done') {
              setTotalCost(data.totalCost)
              setAllRuns(prev => [...prev, { datum, results: data.results, totalCost: data.totalCost }])
            }
            currentEvent = ''
          }
        }
      }
    } catch (err) {
      setProgress(`Fout: ${err instanceof Error ? err.message : err}`)
    }

    setRunning(false)
    setRunningLabel('')
    setProgress('')
  }, [])

  const runAll = useCallback(async () => {
    for (const d of testDates) {
      await runPipeline(d)
    }
  }, [testDates, runPipeline])

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', padding: '24px 16px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Babykrant Testpipeline</h1>
        <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24 }}>
          ChatGPT / Gemini feitenverzameling → Claude artikelgeneratie
        </p>

        {/* Date management */}
        <div style={{ background: 'white', borderRadius: 12, padding: 20, border: '1px solid #e5e7eb', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 8 }}>Testdatums</div>

          {/* Date chips */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {testDates.map(d => (
              <div
                key={d}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 10px', fontSize: 13, borderRadius: 6,
                  border: '1px solid #d1d5db', background: '#f9fafb',
                }}
              >
                <span>{dateToLabel(d)}</span>
                <button
                  onClick={() => removeDate(d)}
                  disabled={running}
                  style={{
                    background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer',
                    fontSize: 14, lineHeight: 1, padding: 0,
                  }}
                  title="Verwijder"
                >
                  ×
                </button>
              </div>
            ))}
            {testDates.length === 0 && (
              <span style={{ fontSize: 13, color: '#9ca3af' }}>Geen datums — voeg er hieronder een toe</span>
            )}
          </div>

          {/* Add date */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 2 }}>Datum toevoegen</label>
              <input
                type="date"
                value={dateInput}
                onChange={e => setDateInput(e.target.value)}
                disabled={running}
                style={{ padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}
              />
            </div>
            <button
              onClick={addDate}
              disabled={running || !dateInput || testDates.includes(dateInput)}
              style={{
                padding: '8px 14px', fontSize: 13, fontWeight: 500, borderRadius: 8,
                background: 'white', color: '#374151', border: '1px solid #d1d5db', cursor: 'pointer',
              }}
            >
              + Toevoegen
            </button>
          </div>

          {/* Run buttons */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={runAll}
              disabled={running || testDates.length === 0}
              style={{
                padding: '10px 20px', fontSize: 14, fontWeight: 600, borderRadius: 8,
                background: running ? '#9ca3af' : '#2563eb', color: 'white', border: 'none', cursor: 'pointer',
              }}
            >
              {running ? 'Bezig...' : testDates.length === 1 ? 'Start pipeline' : `Alle ${testDates.length} datums draaien`}
            </button>
          </div>
        </div>

        {/* Progress */}
        {running && (
          <div style={{ background: '#eff6ff', borderRadius: 12, padding: 16, marginBottom: 20, border: '1px solid #bfdbfe' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{runningLabel}</span>
              <span style={{ fontSize: 13, color: '#6b7280' }}>{stepsDone}/{totalSteps}</span>
            </div>
            <div style={{ fontSize: 13, color: '#4b5563', marginBottom: 8 }}>{progress}</div>
            <div style={{ width: '100%', height: 6, background: '#dbeafe', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${totalSteps ? (stepsDone / totalSteps) * 100 : 0}%`, height: '100%', background: '#2563eb', borderRadius: 3, transition: 'width 0.3s' }} />
            </div>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div>
            {totalCost !== null && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Resultaten — {results[0]?.datum}</h2>
                <span style={{ fontSize: 14, fontWeight: 500, color: '#6b7280' }}>Totaal: {formatCost(totalCost)}</span>
              </div>
            )}

            {/* Comparison view */}
            <div style={{ background: 'white', borderRadius: 12, padding: 20, border: '1px solid #e5e7eb', marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Vergelijking artikelen</h2>
              <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>Eindresultaten naast elkaar</p>
              <ComparisonView results={results} sectie="nieuws" />
              <ComparisonView results={results} sectie="cultuur" />
            </div>

            {/* Detail cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {results.map((r, i) => (
                <ResultCard key={i} result={r} />
              ))}
            </div>

            {/* JSON export */}
            <details style={{ background: 'white', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb' }}>
              <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>Ruwe JSON</summary>
              <pre style={{ marginTop: 8, fontSize: 12, overflow: 'auto', maxHeight: 400, background: '#f9fafb', padding: 12, borderRadius: 8 }}>
                {JSON.stringify(results, null, 2)}
              </pre>
            </details>
          </div>
        )}

        {/* History */}
        {allRuns.length > 1 && (
          <div style={{ marginTop: 32 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Alle runs deze sessie</h2>
            {allRuns.map((run, i) => (
              <details key={i} style={{ background: 'white', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb', marginBottom: 8 }}>
                <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
                  {run.datum} ({formatCost(run.totalCost)})
                </summary>
                <div style={{ marginTop: 12 }}>
                  <ComparisonView results={run.results} sectie="nieuws" />
                  <ComparisonView results={run.results} sectie="cultuur" />
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
