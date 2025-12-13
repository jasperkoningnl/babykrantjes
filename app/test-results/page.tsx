// app/test-results/page.tsx
// @version 2.3.0
// UPDATE v2.0.0: Toegevoegd Dutch News (Volkskrant headlines)
// UPDATE v2.1.0: Vervangen Volkskrant met Wayback Machine (NU.nl via Internet Archive)
// UPDATE v2.2.0: Wayback cache hit indicator toegevoegd
// UPDATE v2.3.0: Multi-source support - toon welke bronnen gebruikt zijn (NU.nl, NOS.nl)
'use client'

const PAGE_VERSION = '2.3.0'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { BabykrantData } from '@/lib/types'
import { getSterrenbeeld, getChineesJaar, getGeboortebloem, getGeboortesteen, getKleur } from '@/lib/calculations'
import { getSterrenbeeldBeschrijving, getChineesTekenBeschrijving } from '@/lib/horoscoopData'
import { getHistoricalWeather, formatWeatherReport, type WeatherData } from '@/lib/weatherAPI'
import { getBornOnThisDay, type BornPerson } from '@/lib/bornOnThisDayAPI'
import { getNameMeaning, type NameMeaningData } from '@/lib/nameMeaningAPI'
import { getFamousNamesakes, type FamousNamesakesData } from '@/lib/famousNamesakesAPI'
import { getMoviesAroundDate, getTopMoviesOfYear, getSeriesOfYear, getPosterUrl, formatGenres, type TMDBMoviesResult } from '@/lib/tmdbAPI'
import { getTop40ByDate, type Top40Result } from '@/lib/top40API'
import { getYearOverview, type DutchChartsYearResult } from '@/lib/dutchChartsAPI'
import { getTVProgramsOnDate, filterInterestingPrograms, type TVOnDateResult } from '@/lib/tvOnDateAPI'
import { getWikipediaTVByYear, type WikipediaTVResult } from '@/lib/wikipediaTVAPI'
import { getDailyNews, getMonthlyNews, getWaybackNews, groupNewsByCategory, formatWaybackTimestamp, type DailyNewsResult, type MonthNewsResult, type WaybackNewsResult, type NewsEvent } from '@/lib/newsAPI'

export default function TestResultsPage() {
  const [data, setData] = useState<BabykrantData | null>(null)
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [bornPersons, setBornPersons] = useState<BornPerson[]>([])
  const [nameMeaning, setNameMeaning] = useState<NameMeaningData | null>(null)
  const [famousNamesakes, setFamousNamesakes] = useState<FamousNamesakesData | null>(null)
  const [movies, setMovies] = useState<TMDBMoviesResult | null>(null)
  const [topMovies, setTopMovies] = useState<TMDBMoviesResult | null>(null)
  const [series, setSeries] = useState<TMDBMoviesResult | null>(null)
  const [top40, setTop40] = useState<Top40Result | null>(null)
  const [yearChart, setYearChart] = useState<DutchChartsYearResult | null>(null)
  const [tvPrograms, setTvPrograms] = useState<TVOnDateResult | null>(null)
  const [wikipediaTV, setWikipediaTV] = useState<WikipediaTVResult | null>(null)
  const [dailyNews, setDailyNews] = useState<DailyNewsResult | null>(null)
  const [monthlyNews, setMonthlyNews] = useState<MonthNewsResult | null>(null)
  const [waybackNews, setWaybackNews] = useState<WaybackNewsResult | null>(null)
  
  const [loading, setLoading] = useState(true)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [bornLoading, setBornLoading] = useState(false)
  const [nameMeaningLoading, setNameMeaningLoading] = useState(false)
  const [namesakesLoading, setNamesakesLoading] = useState(false)
  const [moviesLoading, setMoviesLoading] = useState(false)
  const [seriesLoading, setSeriesLoading] = useState(false)
  const [top40Loading, setTop40Loading] = useState(false)
  const [yearChartLoading, setYearChartLoading] = useState(false)
  const [tvLoading, setTvLoading] = useState(false)
  const [wikipediaTVLoading, setWikipediaTVLoading] = useState(false)
  const [dailyNewsLoading, setDailyNewsLoading] = useState(false)
  const [monthlyNewsLoading, setMonthlyNewsLoading] = useState(false)
  const [waybackNewsLoading, setWaybackNewsLoading] = useState(false)

  useEffect(() => {
    console.log(`[Babykrant] test-results page v${PAGE_VERSION}`)
    
    const stored = localStorage.getItem('babykrant_test_data')
    if (stored) {
      const parsedData = JSON.parse(stored)
      setData(parsedData)
      
      const birthDate = parsedData.basisGegevens.geboorteDatum
      const birthYear = birthDate ? new Date(birthDate).getFullYear() : null
      
      // Weerbericht ophalen
      if (birthDate && parsedData.basisGegevens.geboorteplaats) {
        setWeatherLoading(true)
        getHistoricalWeather(birthDate, parsedData.basisGegevens.geboorteplaats)
          .then(weatherData => {
            setWeather(weatherData)
            setWeatherLoading(false)
          })
      }
      
      // Geboren op deze dag ophalen
      if (birthDate) {
        setBornLoading(true)
        getBornOnThisDay(birthDate).then(persons => {
          setBornPersons(persons)
          setBornLoading(false)
        })
      }
      
      // Naambetekenis ophalen
      if (parsedData.basisGegevens.volledigeNaam) {
        setNameMeaningLoading(true)
        getNameMeaning(parsedData.basisGegevens.volledigeNaam).then(result => {
          setNameMeaning(result)
          setNameMeaningLoading(false)
        })
        
        // Bekende naamdragers ophalen
        setNamesakesLoading(true)
        getFamousNamesakes(parsedData.basisGegevens.volledigeNaam).then(result => {
          setFamousNamesakes(result)
          setNamesakesLoading(false)
        })
      }

      // === CULTUUR DATA ===
      
      // Films rond geboortedatum
      if (birthDate) {
        setMoviesLoading(true)
        getMoviesAroundDate(birthDate, 30).then(result => {
          setMovies(result)
          setMoviesLoading(false)
        })
      }

      // Top films van het jaar
      if (birthYear) {
        getTopMoviesOfYear(birthYear, 5).then(result => {
          setTopMovies(result)
        })
      }
      
      // #1 hit op geboortedatum
      if (birthDate) {
        setTop40Loading(true)
        getTop40ByDate(birthDate).then(result => {
          setTop40(result)
          setTop40Loading(false)
        })
      }
      
      // Populaire artiesten van het jaar
      if (birthYear) {
        setYearChartLoading(true)
        getYearOverview(birthYear, 10).then(result => {
          setYearChart(result)
          setYearChartLoading(false)
        })
      }
      
      // TV programma's op geboortedatum
      if (birthDate) {
        setTvLoading(true)
        getTVProgramsOnDate(birthDate).then(result => {
          console.log(`[Babykrant] TV API response:`, result?.totalFound, 'programs, apiVersion:', result?.apiVersion)
          setTvPrograms(result)
          setTvLoading(false)
        })
      }
      
      // Populaire series van het jaar
      if (birthYear) {
        setSeriesLoading(true)
        getSeriesOfYear(birthYear, 10).then(result => {
          console.log(`[Babykrant] Series API response:`, result?.movies?.length, 'series')
          setSeries(result)
          setSeriesLoading(false)
        })
      }
      
      // Wikipedia TV context (events, lopende shows)
      if (birthYear) {
        setWikipediaTVLoading(true)
        getWikipediaTVByYear(birthYear).then(result => {
          console.log(`[Babykrant] Wikipedia TV response:`, result?.events?.length, 'events, apiVersion:', result?.apiVersion)
          setWikipediaTV(result)
          setWikipediaTVLoading(false)
        })
      }

      // === NIEUWS DATA ===
      
      // Dagelijks internationaal nieuws
      if (birthDate) {
        setDailyNewsLoading(true)
        getDailyNews(birthDate).then(result => {
          console.log(`[Babykrant] Daily news response:`, result?.totalEvents, 'events, apiVersion:', result?.apiVersion)
          setDailyNews(result)
          setDailyNewsLoading(false)
        })
      }

      // Maandoverzicht NL
      if (birthDate) {
        setMonthlyNewsLoading(true)
        getMonthlyNews(birthDate).then(result => {
          console.log(`[Babykrant] Monthly news response:`, result?.totalItems, 'items, apiVersion:', result?.apiVersion)
          setMonthlyNews(result)
          setMonthlyNewsLoading(false)
        })
      }

      // Nederlandse headlines via Wayback Machine (NU.nl)
      // Beschikbaar vanaf ~2005
      if (birthDate) {
        const birthDateObj = new Date(birthDate)
        const earliestDate = new Date('2005-01-01')
        if (birthDateObj >= earliestDate) {
          setWaybackNewsLoading(true)
          getWaybackNews(birthDate).then(result => {
            console.log(`[Babykrant] Wayback news response:`, result?.totalHeadlines, 'headlines, cacheHit:', result?.cacheHit, 'apiVersion:', result?.apiVersion)
            setWaybackNews(result)
            setWaybackNewsLoading(false)
          })
        }
      }
    }
    setLoading(false)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Laden...</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg mb-4">Geen data gevonden</p>
          <Link href="/wizard" className="text-blue-600">Terug naar wizard</Link>
        </div>
      </div>
    )
  }

  // Berekende gegevens
  const sterrenbeeld = getSterrenbeeld(data.basisGegevens.geboorteDatum)
  const chineesJaar = getChineesJaar(data.basisGegevens.geboorteDatum)
  const birthYear = new Date(data.basisGegevens.geboorteDatum).getFullYear()
  
  const berekend = {
    sterrenbeeld,
    chineesJaar,
    geboortebloem: getGeboortebloem(data.basisGegevens.geboorteDatum),
    geboortesteen: getGeboortesteen(data.basisGegevens.geboorteDatum),
    kleur: getKleur(data.basisGegevens.geboorteDatum),
  }

  // Beschrijvingen ophalen
  const sterrenbeeldInfo = getSterrenbeeldBeschrijving(sterrenbeeld)
  const chineesTekenInfo = getChineesTekenBeschrijving(chineesJaar)

  // Bepaal de voornaam voor de headers
  const firstName = nameMeaning?.firstName || famousNamesakes?.firstName || '...'

  // Groepeer nieuws per categorie voor weergave (Map -> Object conversie)
  const groupedNewsMap = dailyNews?.events ? groupNewsByCategory(dailyNews.events) : new Map()
  const groupedNews: Record<string, NewsEvent[]> = Object.fromEntries(groupedNewsMap)

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-pink-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link href="/wizard" className="text-blue-600">← Terug naar wizard</Link>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">Testresultaten</h1>
            <p className="text-gray-600">Bekijk de berekende gegevens en opgehaalde informatie</p>
          </div>

          {/* Berekende gegevens */}
          <div className="bg-blue-50 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">✅ Berekende Gegevens</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-600">Sterrenbeeld:</span>
                <p className="text-lg text-blue-700 font-semibold">{berekend.sterrenbeeld}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Chinees jaar:</span>
                <p className="text-lg text-blue-700 font-semibold">{berekend.chineesJaar}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Geboortebloem:</span>
                <p className="text-lg text-blue-700 font-semibold">{berekend.geboortebloem}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Geboortesteen:</span>
                <p className="text-lg text-blue-700 font-semibold">{berekend.geboortesteen}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Kleur:</span>
                <p className="text-lg text-blue-700 font-semibold">{berekend.kleur}</p>
              </div>
            </div>
          </div>

          {/* Sterrenbeeld beschrijving */}
          {sterrenbeeldInfo && (
            <div className="bg-indigo-50 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">
                ♈ Sterrenbeeld {sterrenbeeldInfo.naam}
              </h2>
              <div className="mb-3 text-sm text-indigo-600">
                <span className="font-medium">{sterrenbeeldInfo.datumStart} - {sterrenbeeldInfo.datumEind}</span>
                <span className="mx-2">|</span>
                <span>Element: {sterrenbeeldInfo.element}</span>
                <span className="mx-2">|</span>
                <span>Planeet: {sterrenbeeldInfo.planeet}</span>
              </div>
              <div className="text-gray-700 whitespace-pre-line leading-relaxed">
                {sterrenbeeldInfo.beschrijving}
              </div>
            </div>
          )}

          {/* Chinees teken beschrijving */}
          {chineesTekenInfo && (
            <div className="bg-red-50 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">
                🐉 Chinees teken: {chineesTekenInfo.naam}
              </h2>
              <div className="mb-3 text-sm text-red-600">
                <span className="font-medium">Jaren: </span>
                {chineesTekenInfo.jaren.join(', ')}
              </div>
              <div className="text-gray-700 whitespace-pre-line leading-relaxed">
                {chineesTekenInfo.beschrijving}
              </div>
              <p className="text-xs text-red-400 mt-3 italic">
                Let op: Chinese Nieuwjaar valt tussen 21 jan - 20 feb. 
                Mensen geboren in jan/feb moeten checken welk jaar ze precies zijn.
              </p>
            </div>
          )}

          {/* ============================================== */}
          {/* NIEUWS SECTIE */}
          {/* ============================================== */}

          {/* Internationaal nieuws op geboortedag */}
          <div className="bg-sky-50 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">📰 Nieuws op de geboortedag (Internationaal)</h2>
            
            {dailyNewsLoading && (
              <p className="text-gray-500 italic">Internationaal nieuws wordt opgehaald...</p>
            )}
            
            {!dailyNewsLoading && dailyNews && dailyNews.events.length > 0 && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 mb-3">
                  Wat er gebeurde op {new Date(data.basisGegevens.geboorteDatum).toLocaleDateString('nl-NL', { 
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
                  })}:
                </p>
                
                {/* Gegroepeerd per categorie */}
                {Object.entries(groupedNews).slice(0, 6).map(([category, events]) => (
                  <div key={category} className="bg-white p-3 rounded border border-sky-200">
                    <h4 className="font-medium text-sky-800 mb-2">{category}</h4>
                    <ul className="space-y-1">
                      {events.slice(0, 3).map((event, idx) => (
                        <li key={idx} className="text-sm text-gray-700 pl-3 border-l-2 border-sky-200">
                          {event.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                
                <p className="text-xs text-gray-500 mt-3">
                  <a href={dailyNews.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:underline">
                    Bron: {dailyNews.source} →
                  </a>
                  {' '}• {dailyNews.totalEvents} nieuwsberichten gevonden
                </p>
              </div>
            )}
            
            {!dailyNewsLoading && dailyNews?.error && (
              <p className="text-amber-600 italic">{dailyNews.error}</p>
            )}
            
            {!dailyNewsLoading && !dailyNews?.error && dailyNews?.events.length === 0 && (
              <p className="text-gray-500 italic">Geen internationaal nieuws gevonden voor deze datum</p>
            )}
          </div>

          {/* Nederlands maandoverzicht */}
          <div className="bg-orange-50 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">🇳🇱 Nieuws & Context ({monthlyNews?.monthName} {monthlyNews?.year})</h2>
            
            {monthlyNewsLoading && (
              <p className="text-gray-500 italic">Maandoverzicht wordt opgehaald...</p>
            )}
            
            {!monthlyNewsLoading && monthlyNews && monthlyNews.items.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 mb-3">
                  Wat er die maand gebeurde in Nederland en de wereld:
                </p>
                
                <div className="space-y-2">
                  {monthlyNews.items.slice(0, 10).map((item, idx) => (
                    <div key={idx} className="bg-white p-3 rounded border border-orange-200">
                      <span className="text-xs font-medium text-orange-600 mr-2">{item.day} {monthlyNews.monthName}:</span>
                      <span className="text-sm text-gray-700">{item.text}</span>
                    </div>
                  ))}
                </div>
                
                {monthlyNews.items.length > 10 && (
                  <p className="text-xs text-orange-600">
                    + {monthlyNews.items.length - 10} meer items...
                  </p>
                )}
                
                <p className="text-xs text-gray-500 mt-3">
                  <a href={monthlyNews.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline">
                    Bron: {monthlyNews.source} →
                  </a>
                  {' '}• {monthlyNews.totalItems} items gevonden
                </p>
              </div>
            )}
            
            {!monthlyNewsLoading && monthlyNews?.error && (
              <p className="text-amber-600 italic">{monthlyNews.error}</p>
            )}
            
            {!monthlyNewsLoading && !monthlyNews?.error && monthlyNews?.items.length === 0 && (
              <p className="text-gray-500 italic">Geen maandoverzicht gevonden</p>
            )}
          </div>

          {/* Nederlandse nieuwsheadlines (Wayback Machine / NU.nl) */}
          <div className="bg-red-50 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">
              📰 Nederlandse Headlines
              {waybackNews?.cacheHit && (
                <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-normal">⚡ Cached</span>
              )}
            </h2>
            
            {waybackNewsLoading && (
              <p className="text-gray-500 italic">Nederlandse headlines worden opgehaald...</p>
            )}
            
            {!waybackNewsLoading && waybackNews && waybackNews.headlines.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 mb-3">
                  Nieuws op {new Date(waybackNews.date).toLocaleDateString('nl-NL', { 
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
                  })}
                  {waybackNews.sources && waybackNews.sources.length > 0 && (
                    <span className="ml-2 text-xs font-medium text-red-600">
                      ({waybackNews.sources.join(', ')})
                    </span>
                  )}:
                </p>
                
                <div className="space-y-2">
                  {waybackNews.headlines.slice(0, 10).map((headline, idx) => (
                    <div key={idx} className="bg-white p-3 rounded border border-red-200">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-1">
                          {headline.category && (
                            <span className="text-xs font-medium text-red-600">{headline.category}</span>
                          )}
                          {headline.source && (
                            <span className="text-xs text-gray-500 italic">via {headline.source}</span>
                          )}
                        </div>
                        {headline.url ? (
                          <a 
                            href={headline.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-gray-900 hover:text-red-700 hover:underline"
                          >
                            {headline.title}
                          </a>
                        ) : (
                          <span className="text-sm text-gray-900">{headline.title}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                {waybackNews.headlines.length > 10 && (
                  <p className="text-xs text-red-600">
                    + {waybackNews.headlines.length - 10} meer headlines...
                  </p>
                )}
                
                <p className="text-xs text-gray-500 mt-3">
                  <a href={waybackNews.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline">
                    Bron: Internet Archive →
                  </a>
                  {' '}• {waybackNews.totalHeadlines} headlines gevonden
                  {waybackNews.sources && waybackNews.sources.length > 0 && (
                    <span className="ml-2">• Bronnen: {waybackNews.sources.join(', ')}</span>
                  )}
                  {waybackNews.snapshotTimestamp && (
                    <span className="ml-2">• Snapshot: {formatWaybackTimestamp(waybackNews.snapshotTimestamp)}</span>
                  )}
                  {waybackNews.cacheHit && (
                    <span className="ml-2 text-green-600">• Cache hit ⚡</span>
                  )}
                </p>
              </div>
            )}
            
            {!waybackNewsLoading && waybackNews?.error && (
              <p className="text-amber-600 italic">{waybackNews.error}</p>
            )}
            
            {!waybackNewsLoading && !waybackNews?.error && waybackNews?.headlines.length === 0 && (
              <p className="text-gray-500 italic">Geen Nederlandse headlines gevonden</p>
            )}
            
            {!waybackNewsLoading && !waybackNews && (
              <p className="text-gray-500 italic text-sm">
                Nederlandse headlines zijn beschikbaar vanaf 2005 (via Internet Archive)
              </p>
            )}
          </div>

          {/* ============================================== */}
          {/* CULTUUR & CONTEXT SECTIES */}
          {/* ============================================== */}

          {/* Weer */}
          {data && data.basisGegevens.geboorteDatum && data.basisGegevens.geboorteplaats && (
            <div className="bg-blue-50 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">☀️ Weer op de Geboortedag</h2>
              
              {weatherLoading && (
                <p className="text-gray-500 italic">Weergegevens worden opgehaald...</p>
              )}
              
              {!weatherLoading && weather && !weather.error && (
                <div className="space-y-2">
                  <p className="text-sm">
                    {formatWeatherReport(weather, data.basisGegevens.geboorteplaats)}
                  </p>
                </div>
              )}
              
              {!weatherLoading && weather?.error && (
                <p className="text-amber-600 italic">{weather.error}</p>
              )}
            </div>
          )}

          {/* Geboren op deze dag */}
          {data && data.basisGegevens.geboorteDatum && (
            <div className="bg-purple-50 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">🎂 Ook Geboren op Deze Dag</h2>
              
              {bornLoading && (
                <p className="text-gray-500 italic">Bekende personen worden opgehaald...</p>
              )}
              
              {!bornLoading && bornPersons.length > 0 && (
                <div className="space-y-3">
                  {bornPersons.slice(0, 5).map((person, idx) => (
                    <div key={idx} className="bg-white p-3 rounded border border-purple-200">
                      <h3 className="font-medium text-gray-900">{person.name}</h3>
                      {person.description && (
                        <p className="text-sm text-gray-600 mt-1">{person.description}</p>
                      )}
                    </div>
                  ))}
                  {bornPersons.length > 5 && (
                    <p className="text-xs text-purple-600">+ {bornPersons.length - 5} anderen...</p>
                  )}
                </div>
              )}
              
              {!bornLoading && bornPersons.length === 0 && (
                <p className="text-gray-500 italic">Geen bekende personen gevonden voor deze datum</p>
              )}
            </div>
          )}

          {/* Naambetekenis */}
          {data && data.basisGegevens.volledigeNaam && (
            <div className="bg-green-50 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">📖 Naambetekenis</h2>
              
              {nameMeaningLoading && (
                <p className="text-gray-500 italic">Naambetekenis wordt opgehaald...</p>
              )}
              
              {!nameMeaningLoading && nameMeaning && !nameMeaning.error && nameMeaning.meanings.length > 0 && (
                <div className="space-y-3">
                  {nameMeaning.meanings.map((meaning, idx) => (
                    <div key={idx} className="bg-white p-3 rounded border border-green-200">
                      <h3 className="font-medium text-green-800">{meaning.name}</h3>
                      <p className="text-sm text-gray-700 mt-1">{meaning.meaning}</p>
                      {meaning.origin && (
                        <p className="text-xs text-gray-500 mt-1">Oorsprong: {meaning.origin}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {!nameMeaningLoading && nameMeaning?.error && (
                <p className="text-amber-600 italic">{nameMeaning.error}</p>
              )}
            </div>
          )}

          {/* Bekende naamgenoten */}
          {data && data.basisGegevens.volledigeNaam && (
            <div className="bg-yellow-50 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">⭐ Bekende Naamgenoten</h2>
              
              {namesakesLoading && (
                <p className="text-gray-500 italic">Bekende naamgenoten worden opgehaald...</p>
              )}
              
              {!namesakesLoading && famousNamesakes && !famousNamesakes.error && famousNamesakes.namesakes.length > 0 && (
                <div className="space-y-3">
                  {famousNamesakes.namesakes.slice(0, 5).map((namesake, idx) => (
                    <div key={idx} className="bg-white p-3 rounded border border-yellow-200">
                      <h3 className="font-medium text-gray-900">{namesake.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{namesake.description}</p>
                    </div>
                  ))}
                </div>
              )}
              
              {!namesakesLoading && famousNamesakes?.error && (
                <p className="text-amber-600 italic">{famousNamesakes.error}</p>
              )}
            </div>
          )}

          {/* Films rond geboortedatum */}
          {data && data.basisGegevens.geboorteDatum && (
            <div className="bg-indigo-50 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">🎬 Films in de Bioscoop</h2>
              
              {moviesLoading && (
                <p className="text-gray-500 italic">Films worden opgehaald...</p>
              )}
              
              {!moviesLoading && movies && !movies.error && movies.movies.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    Films die rond {new Date(data.basisGegevens.geboorteDatum).toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })} uitkwamen:
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {movies.movies.slice(0, 4).map((movie, idx) => (
                      <div key={idx} className="bg-white p-3 rounded border border-indigo-200">
                        {movie.poster_path && (
                          <img 
                            src={getPosterUrl(movie.poster_path, 'w185')} 
                            alt={movie.title}
                            className="w-full rounded mb-2"
                          />
                        )}
                        <h3 className="font-medium text-sm text-gray-900">{movie.title}</h3>
                        {movie.genres && movie.genres.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">{formatGenres(movie.genres)}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {!moviesLoading && movies?.error && (
                <p className="text-amber-600 italic">{movies.error}</p>
              )}
            </div>
          )}

          {/* Top films van het jaar */}
          {data && data.basisGegevens.geboorteDatum && topMovies && topMovies.movies.length > 0 && (
            <div className="bg-pink-50 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">🏆 Top Films van {new Date(data.basisGegevens.geboorteDatum).getFullYear()}</h2>
              
              <div className="space-y-2">
                {topMovies.movies.slice(0, 5).map((movie, idx) => (
                  <div key={idx} className="bg-white p-3 rounded border border-pink-200">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-pink-600">#{idx + 1}</span>
                      <div>
                        <h3 className="font-medium text-gray-900">{movie.title}</h3>
                        {movie.genres && movie.genres.length > 0 && (
                          <p className="text-xs text-gray-500">{formatGenres(movie.genres)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Muziek - Top 40 */}
          {data && data.basisGegevens.geboorteDatum && (
            <div className="bg-cyan-50 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">🎵 #1 Hit in de Top 40</h2>
              
              {top40Loading && (
                <p className="text-gray-500 italic">Top 40 wordt opgehaald...</p>
              )}
              
              {!top40Loading && top40 && !top40.error && top40.song && (
                <div className="bg-white p-4 rounded border border-cyan-200">
                  <h3 className="font-bold text-lg text-cyan-800">{top40.song.title}</h3>
                  <p className="text-gray-700 mt-1">{top40.song.artist}</p>
                  {top40.song.weeks && (
                    <p className="text-sm text-gray-500 mt-2">{top40.song.weeks} weken op #1</p>
                  )}
                </div>
              )}
              
              {!top40Loading && top40?.error && (
                <p className="text-amber-600 italic">{top40.error}</p>
              )}
            </div>
          )}

          {/* Populaire artiesten van het jaar */}
          {data && data.basisGegevens.geboorteDatum && (
            <div className="bg-teal-50 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">🎤 Populaire Artiesten van {new Date(data.basisGegevens.geboorteDatum).getFullYear()}</h2>
              
              {yearChartLoading && (
                <p className="text-gray-500 italic">Jaaroverzicht wordt opgehaald...</p>
              )}
              
              {!yearChartLoading && yearChart && !yearChart.error && yearChart.artists.length > 0 && (
                <div className="space-y-2">
                  {yearChart.artists.slice(0, 10).map((artist, idx) => (
                    <div key={idx} className="bg-white p-3 rounded border border-teal-200 flex items-center gap-3">
                      <span className="text-lg font-bold text-teal-600">#{idx + 1}</span>
                      <div>
                        <h3 className="font-medium text-gray-900">{artist.name}</h3>
                        <p className="text-xs text-gray-500">{artist.hits} hit(s)</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {!yearChartLoading && yearChart?.error && (
                <p className="text-amber-600 italic">{yearChart.error}</p>
              )}
            </div>
          )}

          {/* TV Programma's */}
          {data && data.basisGegevens.geboorteDatum && (
            <div className="bg-violet-50 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">📺 TV op {new Date(data.basisGegevens.geboorteDatum).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}</h2>
              
              {tvLoading && (
                <p className="text-gray-500 italic">TV-programma's worden opgehaald...</p>
              )}
              
              {!tvLoading && tvPrograms && !tvPrograms.error && tvPrograms.programs.length > 0 && (
                <div className="space-y-2">
                  {filterInterestingPrograms(tvPrograms.programs).slice(0, 10).map((program, idx) => (
                    <div key={idx} className="bg-white p-3 rounded border border-violet-200">
                      <div className="flex items-start gap-3">
                        {program.time && (
                          <span className="text-sm font-mono text-violet-600 whitespace-nowrap">{program.time}</span>
                        )}
                        <div>
                          <h3 className="font-medium text-gray-900">{program.title}</h3>
                          {program.channel && (
                            <p className="text-xs text-gray-500">{program.channel}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-gray-500 mt-3">
                    {tvPrograms.totalFound} programma's gevonden • API v{tvPrograms.apiVersion}
                  </p>
                </div>
              )}
              
              {!tvLoading && tvPrograms?.error && (
                <p className="text-amber-600 italic">{tvPrograms.error}</p>
              )}
            </div>
          )}

          {/* Populaire series */}
          {data && data.basisGegevens.geboorteDatum && series && series.movies.length > 0 && (
            <div className="bg-fuchsia-50 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">📺 Populaire Series van {new Date(data.basisGegevens.geboorteDatum).getFullYear()}</h2>
              
              <div className="grid grid-cols-2 gap-3">
                {series.movies.slice(0, 6).map((show, idx) => (
                  <div key={idx} className="bg-white p-3 rounded border border-fuchsia-200">
                    {show.poster_path && (
                      <img 
                        src={getPosterUrl(show.poster_path, 'w185')} 
                        alt={show.title}
                        className="w-full rounded mb-2"
                      />
                    )}
                    <h3 className="font-medium text-sm text-gray-900">{show.title}</h3>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Wikipedia TV Context */}
          {data && data.basisGegevens.geboorteDatum && wikipediaTV && wikipediaTV.events.length > 0 && (
            <div className="bg-slate-50 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">📡 TV Context {new Date(data.basisGegevens.geboorteDatum).getFullYear()}</h2>
              
              <div className="space-y-3">
                <h3 className="font-medium text-slate-700">Belangrijke TV-gebeurtenissen:</h3>
                {wikipediaTV.events.slice(0, 5).map((event, idx) => (
                  <div key={idx} className="bg-white p-3 rounded border border-slate-200">
                    <p className="text-sm text-gray-700">{event.text}</p>
                  </div>
                ))}
                
                <p className="text-xs text-gray-500 mt-3">
                  {wikipediaTV.events.length} gebeurtenissen • API v{wikipediaTV.apiVersion}
                </p>
              </div>
            </div>
          )}

          {/* Debug Info Sectie */}
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">🔍 Debug Info</h2>
            
            <div className="space-y-4 font-mono text-xs">
              <div>
                <h3 className="font-bold mb-2">Basis Gegevens:</h3>
                <pre className="bg-white p-3 rounded overflow-x-auto">
                  {JSON.stringify(data?.basisGegevens, null, 2)}
                </pre>
              </div>
              
              {weather && (
                <div>
                  <h3 className="font-bold mb-2">Weer API Response:</h3>
                  <pre className="bg-white p-3 rounded overflow-x-auto">
                    {JSON.stringify(weather, null, 2)}
                  </pre>
                </div>
              )}
              
              {dailyNews && (
                <div>
                  <h3 className="font-bold mb-2">Daily News API Response:</h3>
                  <pre className="bg-white p-3 rounded overflow-x-auto">
                    {JSON.stringify({ 
                      totalEvents: dailyNews.totalEvents, 
                      source: dailyNews.source,
                      apiVersion: dailyNews.apiVersion,
                      debug: dailyNews.debug 
                    }, null, 2)}
                  </pre>
                </div>
              )}
              
              {monthlyNews && (
                <div>
                  <h3 className="font-bold mb-2">Monthly News API Response:</h3>
                  <pre className="bg-white p-3 rounded overflow-x-auto">
                    {JSON.stringify({
                      totalItems: monthlyNews.totalItems,
                      source: monthlyNews.source,
                      apiVersion: monthlyNews.apiVersion,
                      debug: monthlyNews.debug
                    }, null, 2)}
                  </pre>
                </div>
              )}
              
              {waybackNews && (
                <div>
                  <h3 className="font-bold mb-2">Wayback News API Response:</h3>
                  <pre className="bg-white p-3 rounded overflow-x-auto">
                    {JSON.stringify({
                      totalHeadlines: waybackNews.totalHeadlines,
                      sources: waybackNews.sources,
                      cacheHit: waybackNews.cacheHit,
                      snapshotTimestamp: waybackNews.snapshotTimestamp,
                      apiVersion: waybackNews.apiVersion
                    }, null, 2)}
                  </pre>
                </div>
              )}
              
              {tvPrograms && (
                <div>
                  <h3 className="font-bold mb-2">TV Programs API Response:</h3>
                  <pre className="bg-white p-3 rounded overflow-x-auto">
                    {JSON.stringify({
                      totalFound: tvPrograms.totalFound,
                      apiVersion: tvPrograms.apiVersion
                    }, null, 2)}
                  </pre>
                </div>
              )}
              
              {wikipediaTV && (
                <div>
                  <h3 className="font-bold mb-2">Wikipedia TV API Response:</h3>
                  <pre className="bg-white p-3 rounded overflow-x-auto">
                    {JSON.stringify({
                      totalEvents: wikipediaTV.events.length,
                      apiVersion: wikipediaTV.apiVersion
                    }, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
          
          {/* Versie footer */}
          <div className="mt-8 pt-4 border-t border-gray-200 text-xs text-gray-400 text-right">
            test-results v{PAGE_VERSION}
          </div>
        </div>
      </div>
    </div>
  )
}