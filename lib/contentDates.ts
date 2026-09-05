const DAY_MS = 86_400_000

/** Parse a calendar date without browser/server timezone shifts or date rollover. */
export function parseCalendarDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null
}

export function amsterdamToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const part = (type: string) => parts.find(item => item.type === type)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function isHistoricalDate(value: string, now = new Date()): boolean {
  const date = parseCalendarDate(value)
  const today = parseCalendarDate(amsterdamToday(now))!
  return date !== null && (today.getTime() - date.getTime()) / DAY_MS > 365
}

/** Culture weeks start on Monday, including across month/year boundaries. */
export function contentWeekStart(value: string): string {
  const date = parseCalendarDate(value)
  if (!date) throw new Error('Ongeldige datum')
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7)
  return date.toISOString().slice(0, 10)
}

export const HISTORICAL_DATE_WARNING = 'Let op: Babykrantje.nl is vooral gericht op recente geboortedata. Voor oudere datums zijn minder betrouwbare bronnen beschikbaar. We stellen de artikelen zo zorgvuldig mogelijk samen, maar er kunnen onjuistheden in staan. Controleer de teksten daarom extra goed; je kunt ze zelf aanpassen voordat je bestelt.'
