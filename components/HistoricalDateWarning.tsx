'use client'

import { useEffect, useState } from 'react'
import { HISTORICAL_DATE_WARNING, isHistoricalDate } from '@/lib/contentDates'

export default function HistoricalDateWarning({ date }: { date: string }) {
  // Evaluate after hydration so crossing midnight cannot mismatch server HTML.
  const [historical, setHistorical] = useState(false)
  useEffect(() => {
    const refresh = () => setHistorical(isHistoricalDate(date))
    refresh()
    const timer = setInterval(refresh, 60_000)
    return () => clearInterval(timer)
  }, [date])
  return <div role="status" aria-live="polite">
    {historical && <p className="my-4 rounded-xl border border-terracotta/30 bg-cream-card p-4 text-sm text-dark">{HISTORICAL_DATE_WARNING}</p>}
  </div>
}
