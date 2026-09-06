'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { renewAdminSession } from '@/lib/adminSessionClient'

const blank = { body: '', facts: '', sources: [] as { name: string; url: string }[] }
export default function NewsEditor() {
  const router = useRouter()
  const [date, setDate] = useState('')
  const [loadedDate, setLoadedDate] = useState('')
  const [record, setRecord] = useState<any>(null)
  const [form, setForm] = useState(blank)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [editing, setEditing] = useState(false)
  async function api(url: string, body?: unknown) {
    const options: RequestInit = body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' }
    let response = await fetch(url, options)
    if (response.status === 401 && (await renewAdminSession()).ok) response = await fetch(url, options)
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Verzoek mislukt')
    return data
  }
  function accept(data: any) {
    setRecord(data); setLoadedDate(data.date); setDate(data.date)
    const revision = data.revisions?.[0]
    setForm({ body: data.draft?.body ?? revision?.body ?? '', facts: data.draft?.facts?.notes ?? revision?.facts_snapshot?.notes ?? '', sources: data.draft?.sources ?? revision?.sources_snapshot ?? [] })
    setDirty(false); setEditing(false)
  }
  async function load() {
    if (dirty && !window.confirm('Je hebt onbewaarde wijzigingen. Wil je deze verlaten?')) return
    setBusy(true); setMessage('')
    try { accept(await api(`/api/admin/news?date=${encodeURIComponent(date)}`)) }
    catch (error) { setMessage((error as Error).message) }
    finally { setBusy(false) }
  }
  async function generate() {
    if (dirty && !window.confirm('Opnieuw genereren vervangt je onbewaarde wijzigingen. Doorgaan?')) return
    setBusy(true); setMessage('Nieuws onderzoeken en artikel schrijven…')
    try {
      const result = await api('/api/admin/news/generate', { date: loadedDate, version: record.article?.editorial_version || 0 })
      if (result.saved) { accept(result); setMessage('Artikel gegenereerd en bewaard in de database.') }
      else { setForm({ body: result.body, facts: result.facts, sources: result.sources }); setDirty(true); setEditing(false); setMessage(result.message) }
    } catch (error) { setMessage((error as Error).message) }
    finally { setBusy(false) }
  }
  async function save() {
    setBusy(true); setMessage('')
    try { accept(await api('/api/admin/news', { action: 'save', date: loadedDate, ...form, version: record.article?.editorial_version || 0 })); setMessage('Opgeslagen in de database.') }
    catch (error) { setMessage((error as Error).message) }
    finally { setBusy(false) }
  }
  return <main className="max-w-3xl mx-auto p-6">
    <div className="flex justify-between gap-4 mb-6"><h1 className="bk-heading">Nieuwsredactie</h1><button onClick={async () => { await fetch('/api/admin/session', { method: 'DELETE' }); router.replace('/admin/login'); router.refresh() }} className="underline">Uitloggen</button></div>
    <div className="flex flex-wrap gap-3 items-end mb-6"><label className="flex flex-col">Geboortedatum<input type="date" disabled={busy} className="bk-input" value={date} onChange={event => setDate(event.target.value)} /></label><button disabled={busy || !date} onClick={load} className="bk-btn-primary">Open datum</button></div>
    <p role="status" className="my-4">{message}</p>
    {record && <section className="bk-card">
      <div className="flex justify-between items-start gap-4 mb-6">
        <div><h2 className="text-2xl font-bold">{new Date(`${loadedDate}T12:00:00`).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}</h2>
          <p className="text-sm text-gray-600 mt-2">{dirty ? 'Deze wijzigingen zijn nog niet opgeslagen.' : form.body ? 'Dit artikel staat in de database.' : 'Er staat nog geen artikel in de database voor deze dag.'}</p></div>
        {form.body && <button disabled={busy} className="underline shrink-0" onClick={() => setEditing(!editing)}>{editing ? 'Bekijk opmaak' : 'Bewerken'}</button>}
      </div>
      {editing ? <label className="block">Artikeltekst<textarea aria-label="Artikeltekst" maxLength={20000} className="bk-input w-full leading-8" ref={element => { if (element) { element.style.height = 'auto'; element.style.height = `${element.scrollHeight}px` } }} value={form.body} onChange={event => { setForm({ ...form, body: event.target.value }); setDirty(true) }} disabled={busy} /></label>
        : <article className="text-lg leading-8 space-y-5">{form.body ? form.body.split(/\n\s*\n/).map((paragraph, index) => <p key={index} className="whitespace-pre-wrap">{paragraph.split(/(\*\*[^*]+\*\*)/g).map((part, i) => part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part)}</p>) : <p>Genereer het nieuws voor deze geboortedag.</p>}</article>}
      <div className="flex flex-wrap gap-3 mt-8">
        {form.body && <button disabled={busy || !dirty} onClick={save} className="bk-btn-primary disabled:opacity-40">Opslaan in database</button>}
        <button disabled={busy} onClick={generate} className="border rounded-xl px-4 py-3 disabled:opacity-40">{form.body ? 'Genereer opnieuw' : 'Genereer artikel'}</button>
      </div>
      {(form.facts || form.sources.length > 0) && <details className="border-t mt-8 pt-4">
        <summary className="cursor-pointer text-sm">Achterliggende informatie</summary>
        <div className="mt-4 text-sm leading-6"><p className="whitespace-pre-wrap">{form.facts}</p>
          {form.sources.length > 0 && <ul className="mt-4 space-y-2">{form.sources.filter(source => /^https?:\/\//.test(source.url)).map((source, index) => <li key={index}><a className="underline break-words" href={source.url} target="_blank" rel="noopener noreferrer">{source.name}</a></li>)}</ul>}
        </div>
      </details>}
    </section>}
  </main>
}
