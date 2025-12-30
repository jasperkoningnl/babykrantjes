// app/loading-screen/page.tsx
// @version 1.0.0
// Laadscherm dat alle data verzamelt en automatisch doorstuurt naar generate-articles
'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { BabykrantData } from '@/lib/types'
import { getSterrenbeeld, getChineesJaar, getGeboortebloem, getGeboortesteen, getKleur } from '@/lib/calculations'
import { getHistoricalWeather, type WeatherData } from '@/lib/weatherAPI'
import { getBornOnThisDay, type BornPerson } from '@/lib/bornOnThisDayAPI'
import { getNameMeaning, type NameMeaningData } from '@/lib/nameMeaningAPI'
import { getFamousNamesakes, type FamousNamesakesData } from '@/lib/famousNamesakesAPI'
import { getMoviesAroundDate, getTopMoviesOfYear, getSeriesOfYear, type TMDBMoviesResult } from '@/lib/tmdbAPI'
import { getTop40ByDate, type Top40Result } from '@/lib/top40API'
import { getYearOverview, type DutchChartsYearResult } from '@/lib/dutchChartsAPI'
import { getTVProgramsOnDate, type TVOnDateResult } from '@/lib/tvOnDateAPI'
import { getWikipediaTVByYear, type WikipediaTVResult } from '@/lib/wikipediaTVAPI'
import { getDailyNews, getMonthlyNews, getWaybackNews, type DailyNewsResult, type MonthNewsResult, type WaybackNewsResult } from '@/lib/newsAPI'

interface LoadingStatus {
  task: string
  status: 'pending' | 'loading' | 'completed' | 'error'
}

export default function LoadingScreenPage() {
  const router = useRouter()
  const [data, setData] = useState<BabykrantData | null>(null)
  const [loadingStatuses, setLoadingStatuses] = useState<LoadingStatus[]>([])
  const hasStarted = useRef(false)

  useEffect(() => {
    const stored = localStorage.getItem('babykrant_test_data')
    if (stored) {
      const parsedData = JSON.parse(stored)
      setData(parsedData)
    } else {
      // Geen data, terug naar wizard
      router.push('/wizard')
    }
  }, [router])

  useEffect(() => {
    if (!data || hasStarted.current) return
    hasStarted.current = true

    const birthDate = data.basisGegevens.geboorteDatum
    const birthYear = birthDate ? new Date(birthDate).getFullYear() : null
    const birthPlace = data.basisGegevens.geboorteplaats
    const fullName = data.basisGegevens.volledigeNaam

    // Initialiseer alle taken
    const tasks: LoadingStatus[] = [
      { task: 'Berekende gegevens', status: 'pending' },
      { task: 'Historisch weerbericht', status: 'pending' },
      { task: 'Beroemdheden geboren op deze dag', status: 'pending' },
      { task: 'Naambetekenis', status: 'pending' },
      { task: 'Beroemde naamgenoten', status: 'pending' },
      { task: 'Films in de bioscoop', status: 'pending' },
      { task: 'Populairste films', status: 'pending' },
      { task: 'TV Series', status: 'pending' },
      { task: 'Top 40 hitlijst', status: 'pending' },
      { task: 'Jaaroverzicht muziek', status: 'pending' },
      { task: 'TV programma\'s', status: 'pending' },
      { task: 'Wikipedia TV data', status: 'pending' },
      { task: 'Dagelijks nieuws', status: 'pending' },
      { task: 'Maandoverzicht', status: 'pending' },
      { task: 'Nederlandse headlines', status: 'pending' },
    ]
    setLoadingStatuses(tasks)

    // Start alle data verzameling
    collectAllData(data, birthDate, birthYear, birthPlace, fullName)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const updateTaskStatus = (taskName: string, status: LoadingStatus['status']) => {
    setLoadingStatuses(prev =>
      prev.map(task => task.task === taskName ? { ...task, status } : task)
    )
  }

  const collectAllData = async (
    data: BabykrantData,
    birthDate: string,
    birthYear: number | null,
    birthPlace: string,
    fullName: string
  ) => {
    const enrichedData: any = { ...data }

    // 1. Berekende gegevens
    updateTaskStatus('Berekende gegevens', 'loading')
    try {
      const sterrenbeeld = getSterrenbeeld(birthDate)
      const chineesJaar = getChineesJaar(birthDate)
      enrichedData.berekend = {
        sterrenbeeld,
        chineesJaar,
        geboortebloem: getGeboortebloem(birthDate),
        geboortesteen: getGeboortesteen(birthDate),
        kleur: getKleur(birthDate),
      }
      updateTaskStatus('Berekende gegevens', 'completed')
    } catch {
      updateTaskStatus('Berekende gegevens', 'error')
    }

    // 2. Weerbericht
    if (birthDate && birthPlace) {
      updateTaskStatus('Historisch weerbericht', 'loading')
      try {
        const weather = await getHistoricalWeather(birthDate, birthPlace)
        enrichedData.weather = weather
        updateTaskStatus('Historisch weerbericht', 'completed')
      } catch {
        updateTaskStatus('Historisch weerbericht', 'error')
      }
    } else {
      updateTaskStatus('Historisch weerbericht', 'error')
    }

    // 3. Geboren op deze dag
    if (birthDate) {
      updateTaskStatus('Beroemdheden geboren op deze dag', 'loading')
      try {
        const bornPersons = await getBornOnThisDay(birthDate)
        enrichedData.bornPersons = bornPersons.length > 0 ? bornPersons : undefined
        updateTaskStatus('Beroemdheden geboren op deze dag', 'completed')
      } catch {
        updateTaskStatus('Beroemdheden geboren op deze dag', 'error')
      }
    } else {
      updateTaskStatus('Beroemdheden geboren op deze dag', 'error')
    }

    // 4. Naambetekenis
    if (fullName) {
      updateTaskStatus('Naambetekenis', 'loading')
      try {
        const nameMeaning = await getNameMeaning(fullName)
        enrichedData.nameMeaning = nameMeaning
        updateTaskStatus('Naambetekenis', 'completed')
      } catch {
        updateTaskStatus('Naambetekenis', 'error')
      }
    } else {
      updateTaskStatus('Naambetekenis', 'error')
    }

    // 5. Beroemde naamgenoten
    if (fullName) {
      updateTaskStatus('Beroemde naamgenoten', 'loading')
      try {
        const famousNamesakes = await getFamousNamesakes(fullName)
        enrichedData.famousNamesakes = famousNamesakes
        updateTaskStatus('Beroemde naamgenoten', 'completed')
      } catch {
        updateTaskStatus('Beroemde naamgenoten', 'error')
      }
    } else {
      updateTaskStatus('Beroemde naamgenoten', 'error')
    }

    // 6. Films in de bioscoop
    if (birthDate) {
      updateTaskStatus('Films in de bioscoop', 'loading')
      try {
        const movies = await getMoviesAroundDate(birthDate, 30)
        enrichedData.movies = movies
        updateTaskStatus('Films in de bioscoop', 'completed')
      } catch {
        updateTaskStatus('Films in de bioscoop', 'error')
      }
    } else {
      updateTaskStatus('Films in de bioscoop', 'error')
    }

    // 7. Populairste films
    if (birthYear) {
      updateTaskStatus('Populairste films', 'loading')
      try {
        const topMovies = await getTopMoviesOfYear(birthYear, 5)
        enrichedData.topMovies = topMovies
        updateTaskStatus('Populairste films', 'completed')
      } catch {
        updateTaskStatus('Populairste films', 'error')
      }
    } else {
      updateTaskStatus('Populairste films', 'error')
    }

    // 8. Series
    if (birthYear) {
      updateTaskStatus('TV Series', 'loading')
      try {
        const series = await getSeriesOfYear(birthYear, 10)
        enrichedData.series = series
        updateTaskStatus('TV Series', 'completed')
      } catch {
        updateTaskStatus('TV Series', 'error')
      }
    } else {
      updateTaskStatus('TV Series', 'error')
    }

    // 9. Top 40
    if (birthDate) {
      updateTaskStatus('Top 40 hitlijst', 'loading')
      try {
        const top40 = await getTop40ByDate(birthDate)
        enrichedData.top40 = top40
        updateTaskStatus('Top 40 hitlijst', 'completed')
      } catch {
        updateTaskStatus('Top 40 hitlijst', 'error')
      }
    } else {
      updateTaskStatus('Top 40 hitlijst', 'error')
    }

    // 10. Jaaroverzicht muziek
    if (birthYear) {
      updateTaskStatus('Jaaroverzicht muziek', 'loading')
      try {
        const yearChart = await getYearOverview(birthYear, 10)
        enrichedData.yearChart = yearChart
        updateTaskStatus('Jaaroverzicht muziek', 'completed')
      } catch {
        updateTaskStatus('Jaaroverzicht muziek', 'error')
      }
    } else {
      updateTaskStatus('Jaaroverzicht muziek', 'error')
    }

    // 11. TV Programma's
    if (birthDate) {
      updateTaskStatus('TV programma\'s', 'loading')
      try {
        const tvPrograms = await getTVProgramsOnDate(birthDate)
        enrichedData.tvPrograms = tvPrograms
        updateTaskStatus('TV programma\'s', 'completed')
      } catch {
        updateTaskStatus('TV programma\'s', 'error')
      }
    } else {
      updateTaskStatus('TV programma\'s', 'error')
    }

    // 12. Wikipedia TV
    if (birthYear) {
      updateTaskStatus('Wikipedia TV data', 'loading')
      try {
        const wikipediaTV = await getWikipediaTVByYear(birthYear)
        enrichedData.wikipediaTV = wikipediaTV
        updateTaskStatus('Wikipedia TV data', 'completed')
      } catch {
        updateTaskStatus('Wikipedia TV data', 'error')
      }
    } else {
      updateTaskStatus('Wikipedia TV data', 'error')
    }

    // 13. Dagelijks nieuws
    if (birthDate) {
      updateTaskStatus('Dagelijks nieuws', 'loading')
      try {
        const dailyNews = await getDailyNews(birthDate)
        enrichedData.dailyNews = dailyNews
        updateTaskStatus('Dagelijks nieuws', 'completed')
      } catch {
        updateTaskStatus('Dagelijks nieuws', 'error')
      }
    } else {
      updateTaskStatus('Dagelijks nieuws', 'error')
    }

    // 14. Maandoverzicht
    if (birthDate) {
      updateTaskStatus('Maandoverzicht', 'loading')
      try {
        const monthlyNews = await getMonthlyNews(birthDate)
        enrichedData.monthlyNews = monthlyNews
        updateTaskStatus('Maandoverzicht', 'completed')
      } catch {
        updateTaskStatus('Maandoverzicht', 'error')
      }
    } else {
      updateTaskStatus('Maandoverzicht', 'error')
    }

    // 15. Nederlandse headlines (alleen voor data vanaf 2005)
    if (birthDate) {
      const birthDateObj = new Date(birthDate)
      const earliestDate = new Date('2005-01-01')
      if (birthDateObj >= earliestDate) {
        updateTaskStatus('Nederlandse headlines', 'loading')
        try {
          const waybackNews = await getWaybackNews(birthDate)
          enrichedData.waybackNews = waybackNews
          updateTaskStatus('Nederlandse headlines', 'completed')
        } catch {
          updateTaskStatus('Nederlandse headlines', 'error')
        }
      } else {
        updateTaskStatus('Nederlandse headlines', 'completed') // Skip voor oude data
      }
    } else {
      updateTaskStatus('Nederlandse headlines', 'error')
    }

    // Sla alle verrijkte data op
    localStorage.setItem('babykrant_test_data', JSON.stringify(enrichedData))
    console.log('[Babykrant] ✅ Alle data verzameld en opgeslagen')

    // Wacht 1 seconde en ga dan naar generate-articles
    setTimeout(() => {
      router.push('/generate-articles')
    }, 1000)
  }

  const completedCount = loadingStatuses.filter(t => t.status === 'completed').length
  const totalCount = loadingStatuses.length
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-pink-50 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-lg shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mb-4"></div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Alle gegevens worden verzameld
            </h1>
            <p className="text-gray-600">Een moment geduld...</p>
          </div>

          {/* Progress bar */}
          <div className="mb-8">
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Voortgang</span>
              <span className="text-sm font-medium text-gray-700">{completedCount}/{totalCount}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Status lijst */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {loadingStatuses.map((task, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <span className="text-sm text-gray-700">{task.task}</span>
                {task.status === 'completed' && (
                  <span className="text-green-600">✓</span>
                )}
                {task.status === 'loading' && (
                  <span className="animate-pulse text-blue-600">●</span>
                )}
                {task.status === 'error' && (
                  <span className="text-red-600">✗</span>
                )}
                {task.status === 'pending' && (
                  <span className="text-gray-400">○</span>
                )}
              </div>
            ))}
          </div>

          {/* Compleet bericht */}
          {completedCount === totalCount && totalCount > 0 && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg text-center">
              <p className="text-green-700 font-semibold">
                ✓ Alle gegevens verzameld! Je wordt doorgestuurd naar artikelen...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
