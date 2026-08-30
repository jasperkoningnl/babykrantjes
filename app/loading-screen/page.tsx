'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { BabykrantData } from '@/lib/types'
import { getSterrenbeeld, getChineesJaar, getGeboortebloem, getGeboortesteen, getKleur } from '@/lib/calculations'
import { getHistoricalWeather } from '@/lib/weatherAPI'
import { getBornOnThisDay } from '@/lib/bornOnThisDayAPI'
import { getNameMeaning } from '@/lib/nameMeaningAPI'
import { getFamousNamesakes } from '@/lib/famousNamesakesAPI'

const FUN_FACTS = [
  'Elke seconde worden er wereldwijd ongeveer 4,3 baby’s geboren!',
  'De meeste baby’s worden geboren op dinsdag, de minste in het weekend.',
  'De meeste geboortes vinden plaats tussen 8 en 12 uur ’s ochtends.',
  'September is de maand met de meeste geboorten in Nederland.',
  'Gemiddeld weegt een baby bij geboorte 3.400 gram.',
  'Baby’s hebben ongeveer 300 botjes, volwassenen maar 206!',
  'Pasgeboren baby’s kunnen alleen tot 20-30 cm scherp zien.',
  'Newborns slapen gemiddeld 16-17 uur per dag.',
  'Baby’s kunnen al in de baarmoeder muziek horen en herkennen.',
  'Baby’s herkennen de geur van hun moeder binnen een paar dagen.',
  'Een baby’s brein verdubbelt in grootte in het eerste jaar!',
  'Voetafdrukken van baby’s zijn net zo uniek als vingerafdrukken.',
  'Voorlezen aan baby’s helpt hun hersenontwikkeling enorm.',
  'Baby’s kunnen al vanaf 3 maanden kleuren onderscheiden.',
  'Baby’s beginnen met ‘brabbelen’ rond 4-6 maanden oud.',
  'De eerste glimlach van een baby verschijnt meestal rond 6 weken.',
  'Baby’s kunnen gezichtsuitdrukkingen imiteren vanaf hun geboorte.',
  'De meeste ouders maken gemiddeld 1.000 foto’s in het eerste jaar!',
  'De meeste baby’s krijgen hun eerste tand rond 6 maanden.',
  'In Nederland worden jaarlijks ongeveer 170.000 baby’s geboren.',
  'Baby’s hebben meer smaakpapillen dan volwassenen.',
  'Het hartje van een baby klopt 2x zo snel als dat van een volwassene.',
  'Elk kind is uniek — zelfs eeneiige tweelingen hebben verschillende vingerafdrukken!',
]

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
  const [email, setEmail] = useState('')
  const [emailVerstuurd, setEmailVerstuurd] = useState(false)
  const [klaar, setKlaar] = useState(false)
  const [factIndex, setFactIndex] = useState(() => Math.floor(Math.random() * FUN_FACTS.length))
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

  useEffect(() => {
    if (!data || klaar) return
    const factTimer = setInterval(() => {
      setFactIndex(prev => (prev + 1) % FUN_FACTS.length)
    }, 5000)
    return () => clearInterval(factTimer)
  }, [data, klaar])

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

    // Generate articles
    try {
      const sessionId = localStorage.getItem('babykrant_session_id') || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      localStorage.setItem('babykrant_session_id', sessionId)

      const res = await fetch('/api/generate-paper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: enrichedData, paperId: enrichedData.paperId ?? null, sessionId }),
      })
      const result = await res.json()
      if (result.success && result.articles) {
        enrichedData.generatedArticles = result.articles
        enrichedData.wordCounts = result.wordCounts
        localStorage.setItem('babykrant_test_data', JSON.stringify(enrichedData))
      }
    } catch (error) {
      console.error('Article generation error:', error)
    }

    setKlaar(true)
  }

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setEmailVerstuurd(true)
  }

  useEffect(() => {
    if (!klaar) return
    const timeout = setTimeout(() => {
      router.push('/generate-articles')
    }, 1500)
    return () => clearTimeout(timeout)
  }, [klaar, router])

  const progress = Math.round((genStap / GEN_TAKEN.length) * 100)
  const genKop = genStap >= GEN_TAKEN.length ? 'Klaar!' : `${GEN_TAKEN[genStap] || GEN_TAKEN[0]}…`

  return (
    <div className="min-h-screen bg-cream text-dark font-sans">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-cream/[.92] backdrop-blur-sm border-b border-dark/10">
        <div className="max-w-container mx-auto px-7 py-3.5 flex items-center justify-between gap-6">
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <div className="w-[30px] h-[30px] rounded-full bg-sage flex items-center justify-center text-cream font-extrabold text-[15px]">b</div>
            <div className="font-bold text-[19px] tracking-tight text-dark">babykrantje<span className="text-terracotta">.nl</span></div>
          </Link>
        </div>
      </div>

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
        <div className="text-left flex flex-col gap-3 mb-10">
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

        {/* Fun fact */}
        {!klaar && (
          <div className="bg-cream-card border border-dark/10 rounded-card p-5 mb-10 text-left">
            <div className="font-bold text-[15px] text-sage mb-1.5">Wist je dat…</div>
            <p className="font-serif text-[15px] text-subtle leading-relaxed">{FUN_FACTS[factIndex]}</p>
          </div>
        )}

        {/* Email option / redirect notice */}
        {klaar ? (
          <div className="animate-bk-rise">
            <div className="bg-cream-card border border-dark/10 rounded-card p-6 text-center">
              <div className="font-bold text-xl mb-2">Je krant is klaar!</div>
              <p className="font-serif text-[15.5px] text-subtle mb-5">
                Je wordt doorgestuurd…
              </p>
              <button
                onClick={() => router.push('/generate-articles')}
                className="bk-btn-primary"
              >
                Bekijk mijn krant &rarr;
              </button>
            </div>
          </div>
        ) : !emailVerstuurd ? (
          <div className="animate-bk-rise">
            <div className="bg-cream-card border border-dark/10 rounded-card p-6 text-left">
              <div className="font-bold text-[17px] mb-1.5">Je krant wordt nu gemaakt</div>
              <p className="font-serif text-[15px] text-subtle mb-4">
                Vul je mailadres in en krijg een link als de krant af is. Of blijf wachten.
              </p>
              <form onSubmit={handleEmailSubmit} className="flex gap-2.5">
                <input
                  type="email"
                  placeholder="E-mailadres"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bk-input flex-1"
                />
                <button type="submit" className="bk-btn-primary whitespace-nowrap">
                  Mail mij een link
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="animate-bk-rise">
            <div className="bg-sage/10 border border-sage/20 rounded-card p-6 text-center">
              <div className="font-bold text-[17px] text-[#4A6B47] mb-1">Genoteerd!</div>
              <p className="font-serif text-[15px] text-subtle">
                We sturen een link naar <strong>{email}</strong> zodra je krant klaar is.
                Je kunt dit venster sluiten of blijven wachten.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
