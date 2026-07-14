// tests/parsers.test.ts
// Parser-tests met vaste HTML-fixtures. Breekt een bron zijn HTML-structuur,
// dan faalt hier de bijbehorende test en is direct duidelijk welke parser
// aangepast moet worden. De parsers zijn pure functies (geen netwerk).

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

import { parseGoogleNewsRss } from '../supabase/functions/_shared/parsers/googleNews.ts'
import { parseKijkcijfers, extractPageDate } from '../supabase/functions/_shared/parsers/kijkcijfers.ts'
import { parseTop40 } from '../supabase/functions/_shared/parsers/top40.ts'
import { parseTvGidsPage } from '../supabase/functions/_shared/parsers/tvgids.ts'
import { parseVrtDossiers, parseAlJazeeraTags } from '../supabase/functions/_shared/parsers/dossiers.ts'
import { parseFlixPatrol } from '../supabase/functions/_shared/parsers/flixpatrol.ts'

function fixture(name: string): string {
  return readFileSync(join(__dirname, 'fixtures', name), 'utf-8')
}

describe('parseGoogleNewsRss', () => {
  const items = parseGoogleNewsRss(fixture('google-news.rss.xml'))

  it('parseert alle items', () => {
    expect(items).toHaveLength(3)
  })

  it('stript de " - Bron" suffix van de titel', () => {
    expect(items[0].title).toBe('Kabinet presenteert nieuwe klimaatplannen')
    expect(items[0].sourceName).toBe('NOS')
  })

  it('ondersteunt CDATA-titels', () => {
    expect(items[1].title).toBe('Hittegolf verwacht: KNMI geeft code oranje af')
    expect(items[1].sourceName).toBe('NU.nl')
  })

  it('decodeert HTML-entities in titels', () => {
    expect(items[2].title).toBe('Ajax wint oefenduel met 3-1 & verrast fans')
  })

  it('parseert pubDate naar ISO-timestamp', () => {
    expect(items[0].publishedAt).toBe('2026-07-13T06:12:00.000Z')
  })

  it('geeft lege lijst bij lege input', () => {
    expect(parseGoogleNewsRss('<rss></rss>')).toEqual([])
  })
})

describe('parseKijkcijfers', () => {
  const html = fixture('kijkonderzoek.html')
  const ratings = parseKijkcijfers(html)

  it('parseert de rijen binnen de top 20', () => {
    expect(ratings).toHaveLength(4)
    expect(ratings[0]).toEqual({
      rank: 1,
      programName: 'NOS JOURNAAL 20.00 UUR',
      channel: 'NPO 1',
      viewers: 2567000,
    })
  })

  it('slaat rijen boven de maximale rang over', () => {
    expect(ratings.every((r) => r.rank <= 20)).toBe(true)
  })

  it('haalt de paginadatum uit de header', () => {
    expect(extractPageDate(html)).toBe('2026-07-12')
  })

  it('geeft null bij ontbrekende datum-header', () => {
    expect(extractPageDate('<html></html>')).toBeNull()
  })
})

describe('parseTop40', () => {
  const entries = parseTop40(fixture('top40.html'))

  it('parseert titel en artiest per positie', () => {
    expect(entries).toHaveLength(3)
    expect(entries[0]).toEqual({ rank: 1, title: 'Hallo', artist: 'Antoon' })
  })

  it('decodeert HTML-entities', () => {
    expect(entries[1].title).toBe('Stiekem & Zo')
  })
})

describe('parseTvGidsPage', () => {
  it('parseert JSON-LD programma-items', () => {
    const programs = parseTvGidsPage(fixture('tvgids.html'))
    expect(programs).toHaveLength(4)
    expect(programs[0]).toEqual({
      timeSlot: '20:00',
      name: 'NOS Journaal',
      genre: 'Nieuws',
      description: 'Het laatste nieuws van de dag.',
    })
  })

  it('valt terug op de HTML-lijst zonder JSON-LD', () => {
    const programs = parseTvGidsPage(fixture('tvgids-html-list.html'))
    expect(programs.length).toBeGreaterThanOrEqual(3)
    expect(programs[0].timeSlot).toBe('19:30')
    expect(programs[0].name).toBe('RTL Boulevard')
  })
})

describe('parseVrtDossiers', () => {
  const dossiers = parseVrtDossiers(fixture('vrt-dossiers.html'))

  it('parseert alle unieke dossiers', () => {
    expect(dossiers.map((d) => d.name)).toEqual([
      'Oorlog in Oekraïne',
      'Conflict Israël-Palestijnen',
      'Klimaatverandering',
    ])
  })

  it('maakt relatieve URLs absoluut', () => {
    expect(dossiers[0].sourceUrl).toBe('https://www.vrt.be/vrtnws/nl/dossiers/oorlog-in-oekraine/')
  })

  it('zet de bron op vrt', () => {
    expect(dossiers.every((d) => d.source === 'vrt')).toBe(true)
  })
})

describe('parseAlJazeeraTags', () => {
  const tags = parseAlJazeeraTags(fixture('aljazeera-sitemap.html'))

  it('parseert alleen tag-links, zonder duplicaten', () => {
    expect(tags.map((t) => t.name)).toEqual([
      'Climate Crisis',
      'Russia-Ukraine war',
      'Israel-Palestine conflict',
    ])
  })

  it('zet de bron op aljazeera', () => {
    expect(tags.every((t) => t.source === 'aljazeera')).toBe(true)
  })
})

describe('parseFlixPatrol', () => {
  const entries = parseFlixPatrol(fixture('flixpatrol.html'))

  it('parseert films en series per platform', () => {
    expect(entries).toContainEqual({
      rank: 1,
      title: 'KPop Demon Hunters',
      platform: 'Netflix',
      contentType: 'film',
    })
    expect(entries).toContainEqual({
      rank: 1,
      title: 'Wednesday',
      platform: 'Netflix',
      contentType: 'serie',
    })
  })

  it('vindt meerdere platforms', () => {
    const platforms = new Set(entries.map((e) => e.platform))
    expect(platforms.has('Netflix')).toBe(true)
    expect(platforms.has('HBO Max')).toBe(true)
  })

  it('heeft geen dubbele (platform, rang, type) combinaties', () => {
    const keys = entries.map((e) => `${e.platform}:${e.rank}:${e.contentType}`)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
