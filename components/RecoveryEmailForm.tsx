'use client'

import { useState } from 'react'

interface Props {
  initialEmail?: string
  compact?: boolean
}

export default function RecoveryEmailForm({ initialEmail = '', compact = false }: Props) {
  const [email, setEmail] = useState(initialEmail)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!email || sending) return
    setError('')
    setSending(true)

    try {
      const save = await fetch('/api/papers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactEmail: email }),
      })
      if (!save.ok) throw new Error('E-mailadres kon niet worden bewaard')

      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.accepted) {
        throw new Error(result?.error || 'E-mail kon niet worden verstuurd')
      }
      setSent(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Kon geen verbinding maken')
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className={compact ? 'text-sm text-[#4A6B47]' : 'bg-sage/10 border border-sage/20 rounded-card p-6 text-center'} role="status">
        <strong>Link verstuurd.</strong> Controleer je inbox en eventueel je spammap.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
      <div className="flex flex-col sm:flex-row gap-2.5">
        <input
          type="email"
          placeholder="E-mailadres"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="bk-input flex-1 min-w-0"
          required
        />
        <button type="submit" disabled={sending} className="bk-btn-primary whitespace-nowrap disabled:opacity-60">
          {sending ? 'Versturen…' : 'Mail mij een link'}
        </button>
      </div>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
    </form>
  )
}
