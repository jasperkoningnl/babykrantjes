'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { renewAdminSession } from '@/lib/adminSessionClient'

export default function AdminSessionResume() {
  const router = useRouter()
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    renewAdminSession().then(response => {
      if (!active) return
      if (response.ok) router.refresh()
      else if (response.status === 401) router.replace('/admin/login')
      else setFailed(true)
    }).catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [router, attempt])
  return <main className="max-w-lg mx-auto p-8"><p role="status">{failed ? 'Verbinding maken is niet gelukt.' : 'De redactie openen…'}</p>
    {failed && <button className="bk-btn-primary mt-4" onClick={() => { setFailed(false); setAttempt(n => n + 1) }}>Probeer opnieuw</button>}
  </main>
}
