'use client'
import { useState } from 'react'

export default function AdminLogin() {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  return <main className="max-w-lg mx-auto p-8">
    <h1 className="bk-heading">Redactie</h1>
    <p className="bk-subtext">Vraag een eenmalige inloglink aan. Open hem in deze browser.</p>
    <form onSubmit={async event => {
      event.preventDefault(); setBusy(true); setMessage('')
      const email = new FormData(event.currentTarget).get('email')
      try {
        const response = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
        const result = await response.json()
        setMessage(result.message || result.error || 'Probeer het opnieuw')
      } catch { setMessage('Inloggen is tijdelijk niet beschikbaar') }
      finally { setBusy(false) }
    }} className="bk-card flex flex-col gap-4">
      <label htmlFor="email" className="bk-label">E-mailadres</label>
      <input id="email" name="email" type="email" required maxLength={254} className="bk-input" autoComplete="email" />
      <button disabled={busy} className="bk-btn-primary">{busy ? 'Even wachten…' : 'Stuur inloglink'}</button>
      <p role="status">{message}</p>
    </form>
  </main>
}
