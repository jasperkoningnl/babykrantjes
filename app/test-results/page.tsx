'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { BabykrantData } from '@/lib/types'
import { getSterrenbeeld, getChineesJaar, getGeboortebloem, getGeboortesteen, getKleur } from '@/lib/calculations'
import { getHistoricalWeather, formatWeatherReport, type WeatherData } from '@/lib/weatherApi'
import { getBornOnThisDay, type BornPerson } from '@/lib/wikipediaAPI'

export default function TestResultsPage() {
  const [data, setData] = useState<BabykrantData | null>(null)
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [bornPersons, setBornPersons] = useState<BornPerson[]>([])
  const [loading, setLoading] = useState(true)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [bornLoading, setBornLoading] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('babykrant_test_data')
    if (stored) {
      const parsedData = JSON.parse(stored)
      setData(parsedData)
      
      // Haal weerbericht op
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
      
      // Haal geboren personen op
      if (parsedData.basisGegevens.geboorteDatum) {
        setBornLoading(true)
        getBornOnThisDay(parsedData.basisGegevens.geboorteDatum).then(persons => {
          setBornPersons(persons)
          setBornLoading(false)
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

          {/* Placeholder voor API data */}
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

          {/* Geboren personen */}
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
                  {bornPersons.slice(0, 8).map((person, idx) => (
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
                
                {bornPersons.length > 8 && (
                  <p className="text-xs text-gray-500 mt-3">
                    En nog {bornPersons.length - 8} andere bekende personen...
                  </p>
                )}
              </div>
            )}
            
            {!bornLoading && bornPersons.length === 0 && (
              <p className="text-gray-500 italic">Geen bekende personen gevonden voor deze datum</p>
            )}
          </div>

          {/* Placeholder voor overige API data */}
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
              <div>
                <span className="font-medium text-gray-600">Top films in {new Date(data.basisGegevens.geboorteDatum).getFullYear()}:</span>
                <p className="text-gray-500 italic">Nog niet geïmplementeerd</p>
              </div>
              
              <div>
                <span className="font-medium text-gray-600">Belangrijke gebeurtenissen op deze dag:</span>
                <p className="text-gray-500 italic">Nog niet geïmplementeerd</p>
              </div>
              
              <div>
                <span className="font-medium text-gray-600">Bekende personen geboren op deze dag:</span>
                <p className="text-gray-500 italic">Nog niet geïmplementeerd</p>
              </div>
            </div>
          </div>

          {/* Ingevoerde data */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">📋 Ingevoerde Data</h2>
            <details className="cursor-pointer">
              <summary className="font-medium text-blue-600 mb-2">Toon JSON data</summary>
              <pre className="bg-white p-4 rounded border overflow-auto text-xs">
                {JSON.stringify(data, null, 2)}
              </pre>
            </details>
          </div>

          {/* Acties */}
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