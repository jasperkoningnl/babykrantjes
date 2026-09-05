import { describe, expect, it } from 'vitest'
import { amsterdamToday, contentWeekStart, isHistoricalDate, parseCalendarDate } from '@/lib/contentDates'
import { getSterrenbeeld, getGeboortebloem } from '@/lib/calculations'

describe('content calendar keys', () => {
  it('keeps calendar calculations on month and zodiac boundaries', () => {
    expect(getGeboortebloem('2026-03-01')).toBe('Narcis')
    expect(getSterrenbeeld('2026-03-21')).toBe('Ram')
    expect(getGeboortebloem('2025-02-29')).toBe('-')
    expect(getSterrenbeeld('bad')).toBe('-')
  })
  it('rejects rollovers, timestamps and malformed dates', () => {
    for (const value of ['', '2025-02-29', '2026-04-31', '2026-1-01', '0000-01-01', '2026-01-01T00:00:00Z']) {
      expect(parseCalendarDate(value)).toBeNull()
    }
    expect(parseCalendarDate('2024-02-29')?.toISOString()).toBe('2024-02-29T00:00:00.000Z')
  })
  it('uses Dutch calendar days at midnight and across DST', () => {
    expect(amsterdamToday(new Date('2026-09-04T22:01:00Z'))).toBe('2026-09-05')
    expect(amsterdamToday(new Date('2026-01-01T22:30:00Z'))).toBe('2026-01-01')
    expect(amsterdamToday(new Date('2026-03-29T22:30:00Z'))).toBe('2026-03-30')
  })
  it('warns strictly after 365 calendar days, including leap years', () => {
    const now = new Date('2026-09-05T12:00:00Z')
    expect(isHistoricalDate('2025-09-05', now)).toBe(false)
    expect(isHistoricalDate('2025-09-04', now)).toBe(true)
    expect(isHistoricalDate('2027-01-01', now)).toBe(false)
    expect(isHistoricalDate('invalid', now)).toBe(false)
    expect(isHistoricalDate('2024-02-29', new Date('2025-02-28T12:00Z'))).toBe(false)
    expect(isHistoricalDate('2024-02-29', new Date('2025-03-01T12:00Z'))).toBe(true)
  })
  it('shares Monday keys across year boundaries and preserves leap day', () => {
    expect(contentWeekStart('2026-01-04')).toBe('2025-12-29')
    expect(contentWeekStart('2026-01-05')).toBe('2026-01-05')
    expect(contentWeekStart('2024-02-29')).toBe('2024-02-26')
    expect(() => contentWeekStart('2025-02-29')).toThrow()
  })
})
