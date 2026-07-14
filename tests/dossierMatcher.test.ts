// tests/dossierMatcher.test.ts
// Tests voor de dossier-matching: gecureerde dossiers (lib/dossierMatcher)
// en gescrapete dossiers (lib/newsContext.matchDossiersToHeadlines).

import { describe, it, expect } from 'vitest'
import { matchDossiers, isDossierActiveOn } from '../lib/dossierMatcher'
import { matchDossiersToHeadlines, type ActiveDossier } from '../lib/newsContext'

describe('matchDossiers (gecureerd, data/dossiers.json)', () => {
  it('matcht een kop diakriet-ongevoelig op een actief dossier', () => {
    const matches = matchDossiers(['Zware gevechten rond Aleppo duren voort'], '2015-06-01')
    expect(matches.some((m) => m.dossier.id === 'syrische-burgeroorlog')).toBe(true)
  })

  it('matcht niet buiten de actieve periode', () => {
    const matches = matchDossiers(['Kredietcrisis raakt banken hard'], '2020-01-01')
    expect(matches.some((m) => m.dossier.id === 'kredietcrisis')).toBe(false)
  })

  it('matcht alleen op woordgrens', () => {
    // "coronation" mag niet matchen op alias "corona"
    const matches = matchDossiers(['The coronation of the king'], '2021-01-01')
    expect(matches).toHaveLength(0)
  })
})

describe('isDossierActiveOn', () => {
  const dossier = {
    id: 'test',
    naam: 'Test',
    start: '2020-01-01',
    eind: '2020-12-31',
    aliassen: ['test'],
    context: '',
  }

  it('binnen de periode', () => {
    expect(isDossierActiveOn(dossier, '2020-06-15')).toBe(true)
  })

  it('buiten de periode', () => {
    expect(isDossierActiveOn(dossier, '2021-01-01')).toBe(false)
    expect(isDossierActiveOn(dossier, '2019-12-31')).toBe(false)
  })

  it('lopend dossier (eind null)', () => {
    expect(isDossierActiveOn({ ...dossier, eind: null }, '2030-01-01')).toBe(true)
  })
})

describe('matchDossiersToHeadlines (gescrapet, news_dossiers)', () => {
  const dossiers: ActiveDossier[] = [
    { name: 'Oekraïne', source: 'vrt', category: 'conflict', firstSeenAt: '2024-01-01', lastSeenAt: '2026-07-01' },
    { name: 'Klimaatverandering', source: 'vrt', category: 'climate', firstSeenAt: '2024-01-01', lastSeenAt: '2026-07-01' },
    { name: 'AI', source: 'aljazeera', category: null, firstSeenAt: '2024-01-01', lastSeenAt: '2026-07-01' },
  ]

  it('matcht dossiernaam diakriet-ongevoelig in een kop', () => {
    const matched = matchDossiersToHeadlines(dossiers, ['Nieuwe wapenleveringen aan Oekraine aangekondigd'])
    expect(matched.map((d) => d.name)).toEqual(['Oekraïne'])
  })

  it('slaat te korte dossiernamen over (valse matches)', () => {
    const matched = matchDossiersToHeadlines(dossiers, ['AI verovert de wereld'])
    expect(matched).toHaveLength(0)
  })

  it('geeft lege lijst zonder koppen', () => {
    expect(matchDossiersToHeadlines(dossiers, [])).toEqual([])
  })
})
