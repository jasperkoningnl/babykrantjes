// app/test-results/page.tsx
// @version 1.6.0
// Toegevoegd: Wikipedia TV events (Wie is de Mol winnaar, Eurovision, etc.)
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { BabykrantData } from '@/lib/types'
import { getSterrenbeeld, getChineesJaar, getGeboortebloem, getGeboortesteen, getKleur } from '@/lib/calculations'
import { getSterrenbeeldBeschrijving, getChineesTekenBeschrijving } from '@/lib/horoscoopData'
import { getHistoricalWeather, formatWeatherReport, type WeatherData } from '@/lib/weatherAPI'
import { getBornOnThisDay, type BornPerson } from '@/lib/bornOnThisDayAPI'
import { getNameMeaning, type NameMeaningData } from '@/lib/nameMeaningAPI'
import { getFamousNamesakes, type FamousNamesakesData } from '@/lib/famousNamesakesAPI'
import { getMoviesAroundDate, getTopMoviesOfYear, getPosterUrl, formatGenres, type TMDBMoviesResult } from '@/lib/tmdbAPI'
import { getTop40ByDate, type Top40Result } from '@/lib/top40API'
import { getYearOverview, type DutchChartsYearResult } from '@/lib/dutchChartsAPI'
import { getTVProgramsAroundDate, type NPOResult } from '@/lib/npoBackstageAPI'
import { getTVEventsForYear, type WikipediaTVResult } from '@/lib/wikipediaTVAPI'

export default function TestResultsPage() {
  const [data, setData] = useState<BabykrantData | null>(null)
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [bornPersons, setBornPersons] = useState<BornPerson[]>([])
  const [nameMeaning, setNameMeaning] = useState<NameMeaningData | null>(null)
  const [famousNamesakes, setFamousNamesakes] = useState<FamousNamesakesData | null>(null)
  const [movies, setMovies] = useState<TMDBMoviesResult | null>(null)
  const [topMovies, setTopMovies] = useState<TMDBMoviesResult | null>(null)
  const [top40, setTop40] = useState<Top40Result | null>(null)
  const [yearChart, setYearChart] = useState<DutchChartsYearResult | null>(null)
  const [tvPrograms, setTvPrograms] = useState<NPOResult | null>(null)
  const [wikiTVEvents, setWikiTVEvents] = useState<WikipediaTVResult | null>(null)
  
  const [loading, setLoading] = useState(true)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [bornLoading, setBornLoading] = useState(false)
  const [nameMeaningLoading, setNameMeaningLoading] = useState(false)
  const [namesakesLoading, setNamesakesLoading] = useState(false)
  const [moviesLoading, setMoviesLoading] = useState(false)
  const [top40Loading, setTop40Loading] = useState(false)
  const [yearChartLoading, setYearChartLoading] = useState(false)
  const [tvLoading, setTvLoading] = useState(false)
  const [wikiTVLoading, setWikiTVLoading] = useState(false)

  useEffect(() => {
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

      // === NIEUWE CULTUUR DATA ===
      
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
      
      // TV programma's rond geboortedatum
      if (birthDate) {
        setTvLoading(true)
        getTVProgramsAroundDate(birthDate, 7).then(result => {
          setTvPrograms(result)
          setTvLoading(false)
        })
      }
      
      // Wikipedia TV events van het jaar
      if (birthYear) {
        setWikiTVLoading(true)
        getTVEventsForYear(birthYear).then(result => {
          setWikiTVEvents(result)
          setWikiTVLoading(false)
        })
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

          {/* #1 Hit op geboortedatum */}
          <div className="bg-green-50 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">🎵 #1 Hit op geboortedatum</h2>
            
            {top40Loading && (
              <p className="text-gray-500 italic">Hitlijst wordt opgehaald...</p>
            )}
            
            {!top40Loading && top40?.numberOne && (
              <div className="space-y-3">
                <div className="bg-white p-4 rounded-lg border-2 border-green-300">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-bold text-green-600">#1</span>
                    <div>
                      <p className="text-xl font-semibold text-gray-900">{top40.numberOne.title}</p>
                      <p className="text-lg text-gray-600">{top40.numberOne.artist}</p>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-500">
                  Top 40 week {top40.weekNumber}, {top40.year}
                </p>
                {top40.sourceUrl && (
                  <a href={top40.sourceUrl} target="_blank" rel="noopener noreferrer" 
                     className="text-xs text-green-600 hover:underline">
                    Bron: Top40.nl →
                  </a>
                )}
              </div>
            )}
            
            {!top40Loading && !top40?.numberOne && (
              <p className="text-gray-500 italic">Geen hitlijst gevonden voor deze datum</p>
            )}
          </div>

          {/* Populaire artiesten van het jaar */}
          <div className="bg-emerald-50 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">🎤 Populaire hits in {birthYear}</h2>
            
            {yearChartLoading && (
              <p className="text-gray-500 italic">Jaaroverzicht wordt opgehaald...</p>
            )}
            
            {!yearChartLoading && yearChart && yearChart.entries.length > 0 && (
              <div className="space-y-2">
                {yearChart.entries.slice(0, 5).map((entry, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-white p-2 rounded border">
                    <span className="text-lg font-bold text-emerald-600 w-8">{entry.position}.</span>
                    <div className="flex-1">
                      <span className="font-medium">{entry.artist}</span>
                      <span className="text-gray-500"> - </span>
                      <span className="text-gray-700">{entry.title}</span>
                    </div>
                  </div>
                ))}
                {yearChart.sourceUrl && (
                  <a href={yearChart.sourceUrl} target="_blank" rel="noopener noreferrer" 
                     className="text-xs text-emerald-600 hover:underline block mt-2">
                    Bron: DutchCharts.nl →
                  </a>
                )}
              </div>
            )}
            
            {!yearChartLoading && (!yearChart || yearChart.entries.length === 0) && (
              <p className="text-gray-500 italic">Geen jaaroverzicht gevonden</p>
            )}
          </div>

          {/* Films rond geboortedatum */}
          <div className="bg-amber-50 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">🎬 Films in de bioscoop</h2>
            
            {moviesLoading && (
              <p className="text-gray-500 italic">Films worden opgehaald...</p>
            )}
            
            {!moviesLoading && movies && movies.movies.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 mb-3">
                  Films in Nederland rond {new Date(data.basisGegevens.geboorteDatum).toLocaleDateString('nl-NL')}:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {movies.movies.slice(0, 6).map((movie) => (
                    <div key={movie.id} className="bg-white p-3 rounded border flex gap-3">
                      {movie.posterPath && (
                        <img 
                          src={getPosterUrl(movie.posterPath, 'w92') || ''} 
                          alt={movie.title}
                          className="w-12 h-18 object-cover rounded"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{movie.title}</p>
                        <p className="text-xs text-gray-500">
                          {formatGenres(movie.genreIds).slice(0, 2).join(', ')}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-yellow-500">★</span>
                          <span className="text-sm text-gray-600">{movie.voteAverage.toFixed(1)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Bron: TMDB • Totaal {movies.totalResults} films gevonden
                </p>
              </div>
            )}
            
            {!moviesLoading && (!movies || movies.movies.length === 0) && (
              <p className="text-gray-500 italic">Geen films gevonden voor deze periode</p>
            )}
          </div>

          {/* Top films van het jaar */}
          {topMovies && topMovies.movies.length > 0 && (
            <div className="bg-orange-50 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">🏆 Populairste films van {birthYear}</h2>
              <div className="space-y-2">
                {topMovies.movies.map((movie, idx) => (
                  <div key={movie.id} className="flex items-center gap-3 bg-white p-2 rounded border">
                    <span className="text-lg font-bold text-orange-600 w-8">{idx + 1}.</span>
                    <div className="flex-1">
                      <span className="font-medium">{movie.title}</span>
                      <span className="text-gray-500 text-sm ml-2">★ {movie.voteAverage.toFixed(1)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TV Programma's */}
          <div className="bg-violet-50 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">📺 TV Programma's (NPO)</h2>
            
            {tvLoading && (
              <p className="text-gray-500 italic">TV programma's worden opgehaald...</p>
            )}
            
            {!tvLoading && tvPrograms && tvPrograms.programs.length > 0 && (
              <div className="space-y-2">
                {tvPrograms.programs.slice(0, 5).map((program, idx) => (
                  <div key={idx} className="bg-white p-3 rounded border">
                    <p className="font-semibold text-gray-900">{program.title}</p>
                    {program.channel && (
                      <p className="text-sm text-violet-600">{program.channel}</p>
                    )}
                    {program.description && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{program.description}</p>
                    )}
                  </div>
                ))}
                <p className="text-xs text-gray-500 mt-2">
                  Bron: NPO Backstage • {tvPrograms.totalResults} programma's gevonden
                </p>
              </div>
            )}
            
            {!tvLoading && (!tvPrograms || tvPrograms.programs.length === 0) && (
              <p className="text-gray-500 italic">Geen TV programma's gevonden (NPO data mogelijk niet beschikbaar voor deze periode)</p>
            )}
          </div>

          {/* Wikipedia TV Events */}
          <div className="bg-indigo-50 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">📺 TV Hoogtepunten {birthYear}</h2>
            
            {wikiTVLoading && (
              <p className="text-gray-500 italic">TV events worden opgehaald...</p>
            )}
            
            {!wikiTVLoading && wikiTVEvents && wikiTVEvents.events.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 mb-3">
                  Belangrijke TV-momenten in {birthYear}:
                </p>
                <div className="grid grid-cols-1 gap-3">
                  {wikiTVEvents.events.slice(0, 10).map((event, idx) => (
                    <div key={idx} className="bg-white p-3 rounded border border-indigo-200">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-medium text-indigo-600 bg-indigo-100 px-2 py-1 rounded">
                          {event.date}
                        </span>
                      </div>
                      <p className="text-sm text-gray-800 mt-2">{event.description}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  <a href={wikiTVEvents.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                    Bron: Wikipedia →
                  </a>
                </p>
              </div>
            )}
            
            {!wikiTVLoading && (!wikiTVEvents || wikiTVEvents.events.length === 0) && (
              <p className="text-gray-500 italic">Geen TV events gevonden voor {birthYear}</p>
            )}
          </div>

          {/* Naambetekenis */}
          <div className="bg-purple-50 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">📛 Betekenis naam {firstName}</h2>
            
            {nameMeaningLoading && (
              <p className="text-gray-500 italic">Naambetekenis wordt opgehaald...</p>
            )}
            
            {!nameMeaningLoading && nameMeaning && (
              <div className="space-y-4">
                {nameMeaning.meaning ? (
                  <div>
                    <span className="font-medium text-gray-600">Betekenis:</span>
                    <p className="text-gray-900 mt-1">{nameMeaning.meaning}</p>
                  </div>
                ) : (
                  <p className="text-gray-500 italic">Geen betekenis gevonden</p>
                )}
                
                {nameMeaning.origin && (
                  <div>
                    <span className="font-medium text-gray-600">Oorsprong:</span>
                    <p className="text-gray-900 mt-1">{nameMeaning.origin}</p>
                  </div>
                )}
                
                {nameMeaning.gender && (
                  <div>
                    <span className="font-medium text-gray-600">Geslacht:</span>
                    <p className="text-gray-900 mt-1">{nameMeaning.gender}</p>
                  </div>
                )}
                
                <div className="text-xs text-gray-500 mt-3 pt-3 border-t border-purple-200">
                  <span className="font-medium">Bron: </span>
                  {nameMeaning.source ? (
                    <a href={nameMeaning.source} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">
                      {nameMeaning.source.includes('naamdokter') ? 'Naamdokter.nl' : 
                       nameMeaning.source.includes('betekenisnamen') ? 'Betekenisnamen.nl' : 'Bron'}
                    </a>
                  ) : (
                    <span>Geen bron gevonden</span>
                  )}
                </div>
              </div>
            )}
            
            {!nameMeaningLoading && !nameMeaning && (
              <p className="text-red-500">Naambetekenis kon niet worden opgehaald</p>
            )}
          </div>

          {/* Bekende naamdragers */}
          <div className="bg-pink-50 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">⭐ Bekende mensen die {firstName} heten</h2>
            
            {namesakesLoading && (
              <p className="text-gray-500 italic">Bekende naamdragers worden opgehaald...</p>
            )}
            
            {!namesakesLoading && famousNamesakes && famousNamesakes.persons.length > 0 && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3">
                  {famousNamesakes.persons.map((person, idx) => (
                    <div key={idx} className="bg-white p-3 rounded border border-pink-200">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          {person.wikipediaUrl ? (
                            <a href={person.wikipediaUrl} target="_blank" rel="noopener noreferrer"
                               className="font-semibold text-pink-700 hover:underline">
                              {person.name}
                            </a>
                          ) : (
                            <span className="font-semibold text-gray-900">{person.name}</span>
                          )}
                          <span className="text-xs text-gray-400 ml-2">({person.source.toUpperCase()})</span>
                        </div>
                      </div>
                      {person.description && (
                        <p className="text-sm text-gray-600 mt-1">{person.description}</p>
                      )}
                    </div>
                  ))}
                </div>
                
                <p className="text-xs text-gray-500 mt-3">
                  Totaal {famousNamesakes.persons.length} bekende naamdragers gevonden
                </p>
                
                <div className="text-xs text-gray-500 pt-3 border-t border-pink-200">
                  <span className="font-medium">Bronnen: </span>
                  {famousNamesakes.sources.nl && (
                    <a href={famousNamesakes.sources.nl} target="_blank" rel="noopener noreferrer" className="text-pink-600 hover:underline mr-3">
                      Wikipedia NL
                    </a>
                  )}
                  {famousNamesakes.sources.en && (
                    <a href={famousNamesakes.sources.en} target="_blank" rel="noopener noreferrer" className="text-pink-600 hover:underline">
                      Wikipedia EN
                    </a>
                  )}
                </div>
              </div>
            )}
            
            {!namesakesLoading && famousNamesakes && famousNamesakes.persons.length === 0 && (
              <p className="text-gray-500 italic">Geen bekende naamdragers gevonden</p>
            )}
            
            {!namesakesLoading && !famousNamesakes && (
              <p className="text-gray-500 italic">Kon geen gegevens ophalen</p>
            )}
          </div>

          {/* Weerbericht */}
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">🌤️ Weerbericht</h2>
            
            {weatherLoading && (
              <p className="text-gray-500 italic">Weerbericht wordt opgehaald...</p>
            )}
            
            {!weatherLoading && weather && (
              <div className="space-y-3">
                <div>
                  <span className="font-medium text-gray-600">
                    Weer in {weather.city} op {new Date(weather.date).toLocaleDateString('nl-NL', { 
                      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
                    })}:
                  </span>
                  <p className="text-gray-900 mt-2">{formatWeatherReport(weather)}</p>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
                  <div className="bg-white p-3 rounded border">
                    <div className="text-gray-600 text-xs">Max temperatuur</div>
                    <div className="text-xl font-semibold text-blue-600">{weather.temperature_max}°C</div>
                  </div>
                  <div className="bg-white p-3 rounded border">
                    <div className="text-gray-600 text-xs">Min temperatuur</div>
                    <div className="text-xl font-semibold text-blue-600">{weather.temperature_min}°C</div>
                  </div>
                  <div className="bg-white p-3 rounded border">
                    <div className="text-gray-600 text-xs">Neerslag</div>
                    <div className="text-xl font-semibold text-blue-600">{weather.precipitation}mm</div>
                  </div>
                  <div className="bg-white p-3 rounded border">
                    <div className="text-gray-600 text-xs">Zonneschijn</div>
                    <div className="text-xl font-semibold text-blue-600">{weather.sunshine_duration}u</div>
                  </div>
                </div>
              </div>
            )}
            
            {!weatherLoading && !weather && (
              <p className="text-red-500">Weerbericht kon niet worden opgehaald</p>
            )}
          </div>

          {/* Ook geboren op deze dag */}
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">🎂 Ook geboren op deze dag</h2>
            
            {bornLoading && (
              <p className="text-gray-500 italic">Bekende personen worden opgehaald...</p>
            )}
            
            {!bornLoading && bornPersons.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 mb-3">
                  Ook geboren op {new Date(data.basisGegevens.geboorteDatum).toLocaleDateString('nl-NL', { 
                    day: 'numeric', month: 'long'
                  })}:
                </p>
                
                <div className="grid grid-cols-1 gap-3">
                  {bornPersons.map((person, idx) => (
                    <div key={idx} className="bg-white p-3 rounded border">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-semibold text-gray-900">{person.name}</span>
                          <span className="text-gray-500 ml-2">({person.year})</span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{person.description}</p>
                    </div>
                  ))}
                </div>
                
                <p className="text-xs text-gray-500 mt-3">
                  Totaal {bornPersons.length} bekende personen gevonden
                </p>
              </div>
            )}
            
            {!bornLoading && bornPersons.length === 0 && (
              <p className="text-gray-500 italic">Geen bekende personen gevonden voor deze datum</p>
            )}
          </div>

          {/* Debug: ingevoerde data */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">📋 Debug Data</h2>
            <details className="cursor-pointer">
              <summary className="font-medium text-blue-600 mb-2">▶ Toon ingevoerde data</summary>
              <pre className="bg-white p-4 rounded border overflow-auto text-xs">
                {JSON.stringify(data, null, 2)}
              </pre>
            </details>
            
            <details className="cursor-pointer mt-4">
              <summary className="font-medium text-green-600 mb-2">▶ Toon cultuur data</summary>
              <pre className="bg-white p-4 rounded border overflow-auto text-xs">
                {JSON.stringify({ top40, yearChart, movies: movies?.movies?.slice(0, 3), tvPrograms: tvPrograms?.programs?.slice(0, 3), wikiTVEvents: wikiTVEvents?.events?.slice(0, 5) }, null, 2)}
              </pre>
            </details>
          </div>

          <div className="mt-6 flex gap-4">
            <Link href="/wizard" className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold">
              Nieuwe babykrant maken
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}