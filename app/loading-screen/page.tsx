'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { BabykrantData } from '@/lib/types'
import { getSterrenbeeld, getChineesJaar, getGeboortebloem, getGeboortesteen, getKleur } from '@/lib/calculations'
import { getHistoricalWeather, type WeatherData } from '@/lib/weatherAPI'
import { getBornOnThisDay, type BornPerson } from '@/lib/bornOnThisDayAPI'
import { getNameMeaning, type NameMeaningData } from '@/lib/nameMeaningAPI'
import { getFamousNamesakes, type FamousNamesakesData } from '@/lib/famousNamesakesAPI'

const GEN_TAKEN = [
  'Geboortegegevens controleren',
  'Nieuws van die dag ophalen',
  'KNMI-weerbericht opzoeken',
  'Top 40, films en series verzamelen',
  'Naambetekenis en naamgenoten zoeken',
  'Horoscoop en Chinees teken bepalen',
  'Acht artikelen schrijven',
]

export default function LoadingScreenPage() {
  const router = useRouter()
  const [data, setData] = useState<BabykrantData | null>(null)
  const [genStap, setGenStap] = useState(0)
  const hasStarted = useRef(false)

  useEffect(() => {
    const stored = localStorage.getItem('babykrant_test_data')
    if (stored) {
      setData(JSON.parse(stored))
    } else {
      router.push('/wizard')
    }
  }, [router])

  useEffect(() => {
    if (!data || hasStarted.current) return
    hasStarted.current = true

    const birthDate = data.basisGegevens.geboorteDatum
    const birthPlace = data.basisGegevens.geboorteplaats
    const fullName = data.basisGegevens.volledigeNaam

    collectAllData(data, birthDate, birthPlace, fullName)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  useEffect(() => {
    if (!data) return
    const timer = setInterval(() => {
      setGenStap(prev => {
        if (prev >= GEN_TAKEN.length) {
          clearInterval(timer)
          return prev
        }
        return prev + 1
      })
    }, 950)
    return () => clearInterval(timer)
  }, [data])

  const collectAllData = async (
    data: BabykrantData,
    birthDate: string,
    birthPlace: string,
    fullName: string
  ) => {
    const enrichedData: any = { ...data }

    try {
      enrichedData.berekend = {
        sterrenbeeld: getSterrenbeeld(birthDate),
        chineesJaar: getChineesJaar(birthDate),
        geboortebloem: getGeboortebloem(birthDate),
        geboortesteen: getGeboortesteen(birthDate),
        kleur: getKleur(birthDate),
      }
    } catch {}

    if (birthDate && birthPlace) {
      try {
        enrichedData.weather = await getHistoricalWeather(birthDate, birthPlace)
      } catch {}
    }

    if (fullName) {
      try { enrichedData.nameMeaning = await getNameMeaning(fullName) } catch {}
      try { enrichedData.famousNamesakes = await getFamousNamesakes(fullName) } catch {}
    }

    if (birthDate) {
      try {
        const bornPersons = await getBornOnThisDay(birthDate)
        enrichedData.bornPersons = bornPersons.length > 0 ? bornPersons : undefined
      } catch {}
    }

    localStorage.setItem('babykrant_test_data', JSON.stringify(enrichedData))

    setTimeout(() => {
      router.push('/generate-articles')
    }, 1000)
  }

  const progress = Math.round((genStap / GEN_TAKEN.length) * 100)
  const genKop = genStap >= GEN_TAKEN.length ? 'Klaar!' : `${GEN_TAKEN[genStap] || GEN_TAKEN[0]}…`

  return (
    <div className="min-h-screen bg-cream text-dark font-sans">
      <div className="max-w-[620px] mx-auto px-7 py-[90px] text-center">
        <div className="font-serif italic text-[19px] text-muted mb-2.5">De redactie is aan het werk</div>
        <h1 className="text-[44px] leading-[1.02] tracking-[-0.03em] font-extrabold mb-8">{genKop}</h1>

        {/* Progress bar */}
        <div className="h-1.5 rounded-pill bg-track overflow-hidden mb-8">
          <div
            className="h-full bg-sage transition-all duration-400 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Task list */}
        <div className="text-left flex flex-col gap-3">
          {GEN_TAKEN.map((label, i) => {
            const done = i < genStap
            const current = i === genStap
            const dotColor = done ? '#8FA88A' : current ? '#D9A441' : '#EAE2D5'
            const textColor = i <= genStap ? '#23231F' : '#A9A398'

            return (
              <div key={i} className="flex items-center gap-3 text-base" style={{ color: textColor }}>
                <div
                  className="w-[22px] h-[22px] rounded-full flex-shrink-0 flex items-center justify-center text-xs text-cream"
                  style={{ background: dotColor }}
                >
                  {done ? '✓' : ''}
                </div>
                <span>{label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
