// app/loading-screen/page.tsx
// @version 1.2.0
// Laadscherm met gegroepeerde categorieën en leuke feitjes
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
  category: string
  status: 'pending' | 'loading' | 'completed' | 'error'
}

interface CategoryGroup {
  name: string
  tasks: LoadingStatus[]
}

// Leuke feitjes die getoond worden tijdens het laden
const FUN_FACTS = [
  "🌍 Elke seconde worden er wereldwijd ongeveer 4,3 baby's geboren!",
  "👶 De meeste baby's worden geboren op dinsdag, de minste in het weekend.",
  "⏰ De meeste geboortes vinden plaats tussen 8 en 12 uur 's ochtends.",
  "🎂 September is de maand met de meeste geboorten in Nederland.",
  "📊 Gemiddeld weegt een baby bij geboorte 3.400 gram.",
  "🍼 Baby's hebben ongeveer 300 botjes, volwassenen maar 206!",
  "👁️ Pasgeboren baby's kunnen alleen tot 20-30 cm scherp zien.",
  "💤 Newborns slapen gemiddeld 16-17 uur per dag.",
  "🌟 De kans dat je op dezelfde dag jarig bent als iemand anders: 1 op 365!",
  "📅 Elke dag delen ongeveer 20 miljoen mensen hun verjaardag.",
  "🎵 Baby's kunnen al in de baarmoeder muziek horen en herkennen.",
  "👃 Baby's herkennen de geur van hun moeder binnen een paar dagen.",
  "🧠 Een baby's brein verdubbelt in grootte in het eerste jaar!",
  "👣 Voetafdrukken van baby's zijn net zo uniek als vingerafdrukken.",
  "📖 Voorlezen aan baby's helpt hun hersenontwikkeling enorm.",
  "🌈 Baby's kunnen al vanaf 3 maanden kleuren onderscheiden.",
  "🗣️ Baby's beginnen met 'brabbelen' rond 4-6 maanden oud.",
  "💝 De eerste glimlach van een baby verschijnt meestal rond 6 weken.",
  "🎭 Baby's kunnen gezichtsuitdrukkingen imiteren vanaf hun geboorte.",
  "📸 De meeste ouders maken gemiddeld 1.000 foto's in het eerste jaar!",
  "🌙 De meeste baby's krijgen hun eerste tand rond 6 maanden.",
  "👶 In Nederland worden jaarlijks ongeveer 170.000 baby's geboren.",
  "🎪 Baby's hebben meer smaakapillen dan volwassenen.",
  "💓 Het hartje van een baby klopt 2x zo snel als dat van een volwassene.",
  "🎨 Elk kind is uniek - zelfs eeneiige tweelingen hebben verschillende vingerafdrukken!",
]

export default function LoadingScreenPage() {
  const router = useRouter()
  const [data, setData] = useState<BabykrantData | null>(null)
  const [loadingStatuses, setLoadingStatuses] = useState<LoadingStatus[]>([])
  const [currentFact, setCurrentFact] = useState(0)
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

    // Initialiseer alle taken met categorieën
    const tasks: LoadingStatus[] = [
      { task: 'Ingevulde gegevens', category: 'Ingevulde gegevens', status: 'pending' },
      { task: 'Historisch weerbericht', category: 'Weerbericht', status: 'pending' },
      { task: 'Naambetekenis', category: 'Betekenis naam', status: 'pending' },
      { task: 'Beroemde naamgenoten', category: 'Personen', status: 'pending' },
      { task: 'Geboren op deze dag', category: 'Personen', status: 'pending' },
      { task: 'Films in de bioscoop', category: 'Cultuur', status: 'pending' },
      { task: 'Populairste films & series', category: 'Cultuur', status: 'pending' },
      { task: 'TV programma\'s op geboortedag', category: 'Cultuur', status: 'pending' },
      { task: 'TV hoogtepunten van het jaar', category: 'Cultuur', status: 'pending' },
      { task: 'Nr. 1 hit op geboortedag', category: 'Cultuur', status: 'pending' },
      { task: 'Jaaroverzicht muziek', category: 'Cultuur', status: 'pending' },
      { task: 'Internationaal nieuws', category: 'Nieuws', status: 'pending' },
      { task: 'Maandoverzicht nieuws', category: 'Nieuws', status: 'pending' },
      { task: 'Nederlands nieuws', category: 'Nieuws', status: 'pending' },
    ]
    setLoadingStatuses(tasks)

    // Start alle data verzameling
    collectAllData(data, birthDate, birthYear, birthPlace, fullName)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  // Wissel feitjes elke 5 seconden
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFact(prev => (prev + 1) % FUN_FACTS.length)
    }, 5000)

    return () => clearInterval(interval)
  }, [])

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

    // 1. Ingevulde gegevens
    updateTaskStatus('Ingevulde gegevens', 'loading')
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
      updateTaskStatus('Ingevulde gegevens', 'completed')
    } catch {
      updateTaskStatus('Ingevulde gegevens', 'error')
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

    // 3. Naambetekenis
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

    // 4. Beroemde naamgenoten
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

    // 5. Geboren op deze dag
    if (birthDate) {
      updateTaskStatus('Geboren op deze dag', 'loading')
      try {
        const bornPersons = await getBornOnThisDay(birthDate)
        enrichedData.bornPersons = bornPersons.length > 0 ? bornPersons : undefined
        updateTaskStatus('Geboren op deze dag', 'completed')
      } catch {
        updateTaskStatus('Geboren op deze dag', 'error')
      }
    } else {
      updateTaskStatus('Geboren op deze dag', 'error')
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

    // 7. Populairste films & series
    if (birthYear) {
      updateTaskStatus('Populairste films & series', 'loading')
      try {
        const [topMovies, series] = await Promise.all([
          getTopMoviesOfYear(birthYear, 5),
          getSeriesOfYear(birthYear, 10)
        ])
        enrichedData.topMovies = topMovies
        enrichedData.series = series
        updateTaskStatus('Populairste films & series', 'completed')
      } catch {
        updateTaskStatus('Populairste films & series', 'error')
      }
    } else {
      updateTaskStatus('Populairste films & series', 'error')
    }

    // 8. TV programma's op geboortedag
    if (birthDate) {
      updateTaskStatus('TV programma\'s op geboortedag', 'loading')
      try {
        const tvPrograms = await getTVProgramsOnDate(birthDate)
        enrichedData.tvPrograms = tvPrograms
        updateTaskStatus('TV programma\'s op geboortedag', 'completed')
      } catch {
        updateTaskStatus('TV programma\'s op geboortedag', 'error')
      }
    } else {
      updateTaskStatus('TV programma\'s op geboortedag', 'error')
    }

    // 9. TV hoogtepunten van het jaar
    if (birthYear) {
      updateTaskStatus('TV hoogtepunten van het jaar', 'loading')
      try {
        const wikipediaTV = await getWikipediaTVByYear(birthYear)
        enrichedData.wikipediaTV = wikipediaTV
        updateTaskStatus('TV hoogtepunten van het jaar', 'completed')
      } catch {
        updateTaskStatus('TV hoogtepunten van het jaar', 'error')
      }
    } else {
      updateTaskStatus('TV hoogtepunten van het jaar', 'error')
    }

    // 10. Nr. 1 hit op geboortedag
    if (birthDate) {
      updateTaskStatus('Nr. 1 hit op geboortedag', 'loading')
      try {
        const top40 = await getTop40ByDate(birthDate)
        enrichedData.top40 = top40
        updateTaskStatus('Nr. 1 hit op geboortedag', 'completed')
      } catch {
        updateTaskStatus('Nr. 1 hit op geboortedag', 'error')
      }
    } else {
      updateTaskStatus('Nr. 1 hit op geboortedag', 'error')
    }

    // 11. Jaaroverzicht muziek
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

    // 12. Internationaal nieuws
    if (birthDate) {
      updateTaskStatus('Internationaal nieuws', 'loading')
      try {
        const dailyNews = await getDailyNews(birthDate)
        enrichedData.dailyNews = dailyNews
        updateTaskStatus('Internationaal nieuws', 'completed')
      } catch {
        updateTaskStatus('Internationaal nieuws', 'error')
      }
    } else {
      updateTaskStatus('Internationaal nieuws', 'error')
    }

    // 13. Maandoverzicht nieuws
    if (birthDate) {
      updateTaskStatus('Maandoverzicht nieuws', 'loading')
      try {
        const monthlyNews = await getMonthlyNews(birthDate)
        enrichedData.monthlyNews = monthlyNews
        updateTaskStatus('Maandoverzicht nieuws', 'completed')
      } catch {
        updateTaskStatus('Maandoverzicht nieuws', 'error')
      }
    } else {
      updateTaskStatus('Maandoverzicht nieuws', 'error')
    }

    // 14. Nederlands nieuws (alleen voor data vanaf 2005)
    if (birthDate) {
      const birthDateObj = new Date(birthDate)
      const earliestDate = new Date('2005-01-01')
      if (birthDateObj >= earliestDate) {
        updateTaskStatus('Nederlands nieuws', 'loading')
        try {
          const waybackNews = await getWaybackNews(birthDate)
          enrichedData.waybackNews = waybackNews
          updateTaskStatus('Nederlands nieuws', 'completed')
        } catch {
          updateTaskStatus('Nederlands nieuws', 'error')
        }
      } else {
        updateTaskStatus('Nederlands nieuws', 'completed') // Skip voor oude data
      }
    } else {
      updateTaskStatus('Nederlands nieuws', 'error')
    }

    // Sla alle verrijkte data op
    localStorage.setItem('babykrant_test_data', JSON.stringify(enrichedData))
    console.log('[Babykrant] ✅ Alle data verzameld en opgeslagen')

    // Wacht 1 seconde en ga dan naar generate-articles
    setTimeout(() => {
      router.push('/generate-articles')
    }, 1000)
  }

  // Groepeer taken per categorie
  const groupedCategories: CategoryGroup[] = [
    'Ingevulde gegevens',
    'Weerbericht',
    'Betekenis naam',
    'Personen',
    'Cultuur',
    'Nieuws'
  ].map(categoryName => ({
    name: categoryName,
    tasks: loadingStatuses.filter(t => t.category === categoryName)
  }))

  const completedCount = loadingStatuses.filter(t => t.status === 'completed').length
  const totalCount = loadingStatuses.length
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  // Bepaal of een categorie open moet zijn (bevat loading tasks)
  const isCategoryOpen = (category: CategoryGroup) => {
    return category.tasks.some(t => t.status === 'loading')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-pink-50 flex items-center justify-center px-4 py-12">
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
          <div className="mb-6">
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

          {/* Leuk feitje */}
          <div className="mb-8 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
            <div className="flex items-start gap-3">
              <div className="text-2xl">💡</div>
              <div className="flex-1">
                <p className="text-sm font-medium text-purple-900 mb-1">Wist je dat...</p>
                <p className="text-sm text-purple-800 leading-relaxed animate-fade-in">
                  {FUN_FACTS[currentFact]}
                </p>
              </div>
            </div>
          </div>

          {/* Gegroepeerde categorieën */}
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {groupedCategories.map((category, idx) => {
              const isOpen = isCategoryOpen(category)
              const allCompleted = category.tasks.every(t => t.status === 'completed')
              const hasError = category.tasks.some(t => t.status === 'error')

              return (
                <details key={idx} open={isOpen} className="group">
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-center justify-between p-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4 text-gray-500 transition-transform group-open:rotate-90"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="font-medium text-gray-800">{category.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                          {category.tasks.filter(t => t.status === 'completed').length}/{category.tasks.length}
                        </span>
                        {allCompleted && <span className="text-green-600">✓</span>}
                        {!allCompleted && hasError && <span className="text-red-600">✗</span>}
                        {!allCompleted && !hasError && isOpen && <span className="animate-pulse text-blue-600">●</span>}
                      </div>
                    </div>
                  </summary>
                  <div className="mt-2 ml-6 space-y-1">
                    {category.tasks.map((task, taskIdx) => (
                      <div
                        key={taskIdx}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                      >
                        <span className="text-gray-700">{task.task}</span>
                        {task.status === 'completed' && (
                          <span className="text-green-600 text-xs">✓</span>
                        )}
                        {task.status === 'loading' && (
                          <span className="animate-pulse text-blue-600 text-xs">●</span>
                        )}
                        {task.status === 'error' && (
                          <span className="text-red-600 text-xs">✗</span>
                        )}
                        {task.status === 'pending' && (
                          <span className="text-gray-400 text-xs">○</span>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )
            })}
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
