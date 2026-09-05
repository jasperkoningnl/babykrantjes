'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const blank = { body: '', facts: '', sources: [{ name: '', url: '' }] }
export default function NewsEditor() {
  const router = useRouter()
  const [date, setDate] = useState('')
  const [loadedDate, setLoadedDate] = useState('')
  const [record, setRecord] = useState<any>(null)
  const [form, setForm] = useState(blank)
  const [queue, setQueue] = useState<any>({ news: [], jobs: [] })
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [reason, setReason] = useState('')
  const [reviewed, setReviewed] = useState(false)
  async function api(url: string, body?: unknown) {
    const response = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Verzoek mislukt')
    return data
  }
  useEffect(() => { api('/api/admin/news').then(setQueue).catch(error => setMessage(error.message)) }, [])
  function accept(data: any) {
    setRecord(data); setLoadedDate(data.date); setDate(data.date)
    const revision = data.revisions?.[0]
    setForm({ body: data.draft?.body ?? revision?.body ?? '', facts: data.draft?.facts?.notes ?? revision?.facts_snapshot?.notes ?? '', sources: data.draft?.sources ?? revision?.sources_snapshot ?? [{ name: '', url: '' }] })
    setDirty(false); setReviewed(false)
  }
  async function load(target: string) {
    if (dirty && !window.confirm('Je hebt onbewaarde wijzigingen. Wil je deze verlaten?')) return
    setBusy(true); setMessage('')
    try { accept(await api(`/api/admin/news?date=${encodeURIComponent(target)}`)) }
    catch (error) { setMessage((error as Error).message) }
    finally { setBusy(false) }
  }
  function edit(next: typeof form) { setForm(next); setDirty(true); setReviewed(false) }
  const published = record?.revisions?.find((item: any) => item.id === record.article?.current_revision_id)
  return <main className="max-w-6xl mx-auto p-6">
    <div className="flex justify-between gap-4"><h1 className="bk-heading">Nieuwsredactie</h1><button onClick={async () => { await fetch('/api/admin/session', { method: 'DELETE' }); router.replace('/admin/login'); router.refresh() }} className="underline">Uitloggen</button></div>
    <p className="bk-subtext">Controleer feiten en bronnen. Alleen een bewuste publicatie maakt tekst beschikbaar voor hergebruik.</p>
    <div className="flex gap-3 items-end mb-6"><label className="flex flex-col">Nieuwsdatum<input type="date" className="bk-input" value={date} onChange={event => setDate(event.target.value)} /></label><button disabled={busy || !date} onClick={() => load(date)} className="bk-btn-primary">Open datum</button></div>
    <p role="status" className="my-4">{message}</p>
    <div className="flex flex-wrap gap-2 mb-6">{queue.news.map((item: any) => <button disabled={busy} className="border rounded-xl px-3 py-2" key={item.news_date} onClick={() => load(item.news_date)}>{item.news_date} · {item.articles?.current_revision_id ? 'Gepubliceerd' : 'Te beoordelen'}</button>)}</div>
    {record && <section className="grid md:grid-cols-2 gap-6">
      <fieldset disabled={busy} className="bk-card flex flex-col gap-4"><h2 className="text-xl font-bold">Concept voor {loadedDate}</h2>
        <label>Artikeltekst<textarea rows={12} maxLength={20000} className="bk-input" value={form.body} onChange={event => edit({ ...form, body: event.target.value })} /></label>
        <label>Gecontroleerde feiten<textarea rows={5} maxLength={20000} className="bk-input" value={form.facts} onChange={event => edit({ ...form, facts: event.target.value })} /></label>
        <button disabled={busy || !form.facts.trim()} className="border rounded-xl p-3 disabled:opacity-40" onClick={async () => {
          setBusy(true); setMessage('')
          try {
            const result = await api('/api/admin/news/generate', { date: loadedDate, ...form })
            edit({ ...form, body: result.body }); setMessage('AI-concept klaar. Controleer en bewaar de tekst; hij is nog niet gepubliceerd.')
          } catch (error) { setMessage((error as Error).message) } finally { setBusy(false) }
        }}>Maak AI-concept van mijn feiten</button>
        <p className="text-sm">Alleen je feiten en bronverwijzingen worden gebruikt. Maximaal vijf proefpogingen binnen het afgesproken budget; geen automatische publicatie.</p>
        <h3 className="font-bold">Bronnen</h3>
        {form.sources.map((source: any, index: number) => <div key={index} className="flex flex-col gap-2 border-b pb-3">
          <label>Bronnaam<input className="bk-input" value={source.name} maxLength={200} onChange={event => edit({ ...form, sources: form.sources.map((s: any, i: number) => i === index ? { ...s, name: event.target.value } : s) })} /></label>
          <label>Bronlink<input type="url" className="bk-input" value={source.url} maxLength={2000} onChange={event => edit({ ...form, sources: form.sources.map((s: any, i: number) => i === index ? { ...s, url: event.target.value } : s) })} /></label>
          {/^https?:\/\//.test(source.url) && <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline">Open bron</a>}
          <button disabled={form.sources.length === 1} onClick={() => edit({ ...form, sources: form.sources.filter((_: any, i: number) => i !== index) })} className="text-sm underline">Verwijder bron</button>
        </div>)}
        <button disabled={form.sources.length >= 20} onClick={() => edit({ ...form, sources: [...form.sources, { name: '', url: '' }] })} className="underline">Bron toevoegen</button>
        <button disabled={busy} className="bk-btn-primary" onClick={async () => {
          setBusy(true); setMessage('')
          try { accept(await api('/api/admin/news', { action: 'save', date: loadedDate, ...form, version: record.article?.editorial_version || 0 })); setMessage('Concept bewaard. Nog niet gepubliceerd.') }
          catch (error) { setMessage((error as Error).message) } finally { setBusy(false) }
        }}>Concept bewaren</button>
        <label>Reden voor publicatie<input className="bk-input" maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} /></label>
        <label className="flex gap-3"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} />Ik heb tekst, nieuwsdatum en bronnen gecontroleerd.</label>
        <button disabled={busy || dirty || !record.draft || !reviewed || !reason.trim()} className="bk-btn-primary disabled:opacity-40" onClick={async () => {
          setBusy(true); setMessage('')
          try {
            await api('/api/admin/news', { action: 'publish', articleId: record.article.id, version: record.draft.edit_version, currentRevisionId: record.article.current_revision_id, reason, reviewed })
            accept(await api(`/api/admin/news?date=${loadedDate}`)); setQueue(await api('/api/admin/news')); setMessage('Artikel gepubliceerd. Bestaande kranten behouden hun tekst.')
          } catch (error) { setMessage((error as Error).message) } finally { setBusy(false) }
        }}>Gecontroleerd artikel publiceren</button>
        {dirty && <p>Bewaar eerst je wijzigingen voordat je publiceert.</p>}
      </fieldset>
      <aside className="bk-card"><h2 className="font-bold text-xl mb-4">Huidige publicatie</h2><p className="whitespace-pre-wrap">{published?.body || 'Deze datum heeft nog geen gepubliceerde tekst.'}</p>
        <h3 className="font-bold mt-6">Publicatiegeschiedenis</h3>{record.publications.map((item: any) => <p key={item.created_at} className="my-3">{new Date(item.created_at).toLocaleString('nl-NL')} · {item.reason}</p>)}
      </aside>
    </section>}
    {queue.jobs.length > 0 && <section className="bk-card mt-6"><h2 className="font-bold">Wachtende of mislukte taken</h2>{queue.jobs.map((job: any) => <p key={job.content_key}>{job.content_key} · {job.status === 'failed' ? 'Mislukt' : 'In behandeling'} · {job.attempts} pogingen</p>)}</section>}
  </main>
}
