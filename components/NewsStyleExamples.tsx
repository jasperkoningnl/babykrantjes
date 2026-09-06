'use client'
import { useState } from 'react'
import type { NewsStyleExample } from '@/lib/newsStylePrompt'
import { renewAdminSession } from '@/lib/adminSessionClient'

export default function NewsStyleExamples() {
  const [examples, setExamples] = useState<NewsStyleExample[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function load() {
    if (busy) return
    setBusy(true); setError('')
    try {
      let response = await fetch('/api/admin/news/examples', { cache: 'no-store' })
      if (response.status === 401 && (await renewAdminSession()).ok) response = await fetch('/api/admin/news/examples', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setExamples(result.examples)
    } catch (e) { setError(e instanceof Error ? e.message : 'Laden mislukt') }
    finally { setBusy(false) }
  }
  return <details className="bk-card mt-6" onToggle={event => { if (event.currentTarget.open && !examples) void load() }}>
    <summary className="cursor-pointer font-bold">Voorbeeldartikelen van Jasper</summary>
    <p className="text-sm text-gray-600 mt-4">De nieuwsberichten uit je vijf voorbeeldkrantjes, als tekst overgenomen. Regelafbrekingen en afgebroken woorden zijn samengevoegd. De schrijver gebruikt ze als stijlvoorbeeld, niet als feitenbron voor andere dagen. Je huidige aanwijzingen blijven leidend.</p>
    {busy && <p role="status" className="mt-4">Voorbeelden laden…</p>}
    {error && <p role="alert" className="mt-4">{error} <button onClick={load} className="underline">Probeer opnieuw</button></p>}
    {examples?.map(example => <details key={example.id} className="border-t mt-5 pt-4">
      <summary className="cursor-pointer">{example.title} · {new Date(`${example.news_date}T12:00:00`).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}</summary>
      <article className="space-y-4 leading-7 mt-4">{example.body.split(/\n\s*\n/).map((p, i) => <p className="whitespace-pre-wrap" key={i}>{p}</p>)}</article>
      <p className="text-sm text-gray-600 mt-4">Wat dit voorbeeld laat zien: {example.style_note}</p>
    </details>)}
  </details>
}
