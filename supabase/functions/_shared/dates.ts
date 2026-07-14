// supabase/functions/_shared/dates.ts
// Datum-helpers die alles als kalenderdatum-string (YYYY-MM-DD) behandelen,
// berekend in de tijdzone Europe/Amsterdam. Dat voorkomt de UTC/lokaal-mix
// die in ANALYSE.md als bug-in-spe is aangemerkt.

const AMSTERDAM_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Amsterdam',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Vandaag als YYYY-MM-DD in Europe/Amsterdam */
export function todayISO(): string {
  return AMSTERDAM_FORMATTER.format(new Date())
}

/** N dagen vóór vandaag als YYYY-MM-DD in Europe/Amsterdam */
export function daysAgoISO(days: number): string {
  const now = new Date()
  now.setUTCDate(now.getUTCDate() - days)
  return AMSTERDAM_FORMATTER.format(now)
}

/** Gisteren als YYYY-MM-DD in Europe/Amsterdam */
export function yesterdayISO(): string {
  return daysAgoISO(1)
}

/** Maandag van de week waar de gegeven kalenderdatum in valt (YYYY-MM-DD) */
export function mondayOfWeek(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const dayNum = date.getUTCDay() || 7 // ma=1 ... zo=7
  date.setUTCDate(date.getUTCDate() - (dayNum - 1))
  return date.toISOString().slice(0, 10)
}

/** ISO-weeknummer voor een kalenderdatum */
export function isoWeekNumber(dateISO: string): number {
  const [y, m, d] = dateISO.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

/** ISO-weekjaar voor een kalenderdatum */
export function isoWeekYear(dateISO: string): number {
  const [y, m, d] = dateISO.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  return date.getUTCFullYear()
}
