'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { BabykrantData } from '@/lib/types'
import { getSterrenbeeld, getChineesJaar, getGeboortebloem, getGeboortesteen, getKleur } from '@/lib/calculations'

export default function TestResultsPage() {
  const [data, setData] = useState<BabykrantData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('babykrant_test_data')
    if (stored) {
      setData(JSON.parse(stored))
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
            <h2 className="text-xl font-semibold mb-4">⏳ API Data (Fase 1C)</h2>
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-medium text-gray-600">Weerbericht op {data.basisGegevens.geboorteDatum}:</span>
                <p className="text-gray-500 italic">Nog niet geïmplementeerd</p>
              </div>
              
              <div>
                <span className="font-medium text-gray-600">Top films in {new Date(data.basisGegevens.geboorteDatum).getFullYear()}:</span>
                <p className="text-gray-500 italic">Nog niet geïmplementeerd</p>
              </div>
              
              <div>
                <span className="font-medium text-gray-600">Belangrijke gebeurtenissen:</span>
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