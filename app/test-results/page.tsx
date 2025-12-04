// app/test-results/page.tsx
// @version 1.3.1
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { BabykrantData } from '@/lib/types'
import { getSterrenbeeld, getChineesJaar, getGeboortebloem, getGeboortesteen, getKleur } from '@/lib/calculations'
import { getHistoricalWeather, formatWeatherReport, type WeatherData } from '@/lib/weatherAPI'
import { getBornOnThisDay, type BornPerson } from '@/lib/bornOnThisDayAPI'
import { getNameMeaning, type NameMeaningData } from '@/lib/nameMeaningAPI'
import { getFamousNamesakes, type FamousNamesakesData, type FamousPerson } from '@/lib/famousNamesakesAPI'

export default function TestResultsPage() {
  const [data, setData] = useState<BabykrantData | null>(null)
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [bornPersons, setBornPersons] = useState<BornPerson[]>([])
  const [nameMeaning, setNameMeaning] = useState<NameMeaningData | null>(null)
  const [famousNamesakes, setFamousNamesakes] = useState<FamousNamesakesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [bornLoading, setBornLoading] = useState(false)
  const [nameMeaningLoading, setNameMeaningLoading] = useState(false)
  const [namesakesLoading, setNamesakesLoading] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('babykrant_test_data')
    if (stored) {
      const parsedData = JSON.parse(stored)
      setData(parsedData)
      
      // Weerbericht ophalen
      if (parsedData.basisGegevens.geboorteDatum && parsedData.basisGegevens.geboorteplaats) {
        setWeatherLoading(true)
        getHistoricalWeather(
          parsedData.basisGegevens.geboorteDatum,
          parsedData.basisGegevens.geboorteplaats
        ).then(weatherData => {
          setWeather(weatherData)
          setWeatherLoading(false)
        })
      }
      
      // Geboren op deze dag ophalen
      if (parsedData.basisGegevens.geboorteDatum) {
        setBornLoading(true)
        getBornOnThisDay(parsedData.basisGegevens.geboorteDatum).then(persons => {
          setBornPersons(persons)
          setBornLoading(false)
        })
      }
      
      // Naambetekenis ophalen (nieuwe API)
      if (parsedData.basisGegevens.volledigeNaam) {
        setNameMeaningLoading(true)
        getNameMeaning(parsedData.basisGegevens.volledigeNaam).then(result => {
          setNameMeaning(result)
          setNameMeaningLoading(false)
        })
        
        // Bekende naamdragers ophalen (aparte API)
        setNamesakesLoading(true)
        getFamousNamesakes(parsedData.basisGegevens.volledigeNaam).then(result => {
          setFamousNamesakes(result)
          setNamesakesLoading(false)
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

  const berekend = {
    sterrenbeeld: getSterrenbeeld(data.basisGegevens.geboorteDatum),
    chineesJaar: getChineesJaar(data.basisGegevens.geboorteDatum),
    geboortebloem: getGeboortebloem(data.basisGegevens.geboorteDatum),
    geboortesteen: getGeboortesteen(data.basisGegevens.geboorteDatum),
    kleur: getKleur(data.basisGegevens.geboorteDatum),
  }

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
                
                {/* Bron */}
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
                            <a 
                              href={person.wikipediaUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="font-semibold text-pink-700 hover:underline"
                            >
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
                
                {/* Bronnen */}
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
                      weekday: 'long',
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
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
                    day: 'numeric',
                    month: 'long'
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

          {/* Overige data placeholder */}
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">⏳ Overige Data (Nog te implementeren)</h2>
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-medium text-gray-600">Top films in {new Date(data.basisGegevens.geboorteDatum).getFullYear()}:</span>
                <p className="text-gray-500 italic">Nog niet geïmplementeerd</p>
              </div>
              
              <div>
                <span className="font-medium text-gray-600">Belangrijke gebeurtenissen op deze dag:</span>
                <p className="text-gray-500 italic">Nog niet geïmplementeerd</p>
              </div>
            </div>
          </div>

          {/* Debug: ingevoerde data */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">📋 Ingevoerde Data</h2>
            <details className="cursor-pointer">
              <summary className="font-medium text-blue-600 mb-2">▶ Toon JSON data</summary>
              <pre className="bg-white p-4 rounded border overflow-auto text-xs">
                {JSON.stringify(data, null, 2)}
              </pre>
            </details>
            
            <details className="cursor-pointer mt-4">
              <summary className="font-medium text-purple-600 mb-2">▶ Toon naam API response</summary>
              <pre className="bg-white p-4 rounded border overflow-auto text-xs">
                {JSON.stringify({ nameMeaning, famousNamesakes }, null, 2)}
              </pre>
            </details>
          </div>

          <div className="mt-6 flex gap-4">
            <Link 
              href="/wizard"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold"
            >
              Nieuwe babykrant maken
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}