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
import RecoveryEmailForm from '@/components/RecoveryEmailForm'

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

async function collectAllData(data: BabykrantData, birthDate: string, birthPlace: string, fullName: string) {
  const enrichedData: any = { ...data }
  try {
    enrichedData.berekend = {
      sterrenbeeld: getSterrenbeeld(birthDate), chineesJaar: getChineesJaar(birthDate),
      geboortebloem: getGeboortebloem(birthDate), geboortesteen: getGeboortesteen(birthDate), kleur: getKleur(birthDate),
    }
  } catch {}
  if (birthDate && birthPlace) {
    try { enrichedData.weather = await getHistoricalWeather(birthDate, birthPlace) } catch {}
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
  const saveResponse = await fetch('/api/papers', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: enrichedData }),
  })
  if (!saveResponse.ok) throw new Error('De krantgegevens konden niet worden bewaard')

  const res = await fetch('/api/generate-paper', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(125_000),
  })
  const result = await res.json().catch(() => null)
  if (!res.ok || !result?.success || !result.articles) {
    throw new Error(result?.error || 'De artikelen konden niet worden gemaakt')
  }

  const articleSaveResponse = await fetch('/api/papers', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ generatedArticles: result.articles, manualEdits: result.articles }),
  })
  if (!articleSaveResponse.ok) throw new Error('De artikelen konden niet worden bewaard')
}

export default function LoadingScreenPage() {
  const router = useRouter()
  const [data, setData] = useState<BabykrantData | null>(null)
  const [genStap, setGenStap] = useState(0)
  const [klaar, setKlaar] = useState(false)
  const [generationError, setGenerationError] = useState('')
  const [generationAttempt, setGenerationAttempt] = useState(0)
  const [factIndex, setFactIndex] = useState(() => Math.floor(Math.random() * FUN_FACTS.length))
  const hasStarted = useRef(false)

  useEffect(() => {
    fetch('/api/papers', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Geen geldige krantsessie')
        const result = await response.json()
        setData(result.data)
      })
      .catch(() => router.push('/wizard'))
  }, [router])

  useEffect(() => {
    if (!data || hasStarted.current) return
    hasStarted.current = true

    const birthDate = data.basisGegevens.geboorteDatum
    const birthPlace = data.basisGegevens.geboorteplaats
    const fullName = data.basisGegevens.volledigeNaam

    let retryTimer: ReturnType<typeof setTimeout> | undefined
    collectAllData(data, birthDate, birthPlace, fullName)
      .then(() => {
        setGenerationError('')
        setKlaar(true)
      })
      .catch((error) => {
        console.error('[LoadingScreen] Generatie mislukt:', error)
        setGenerationError('Het maken duurt langer dan verwacht. We proberen het automatisch opnieuw.')
        retryTimer = setTimeout(() => {
          hasStarted.current = false
          setGenerationAttempt(attempt => attempt + 1)
        }, Math.min(60_000, 5_000 * 2 ** Math.min(generationAttempt, 3)))
      })

    return () => {
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [data, generationAttempt])

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

  useEffect(() => {
    if (!klaar) return
    const timeout = setTimeout(() => {
      router.push('/generate-articles')
    }, 1500)
    return () => clearTimeout(timeout)
  }, [klaar, router])

  const displayedStep = klaar ? GEN_TAKEN.length : Math.min(genStap, GEN_TAKEN.length - 1)
  const progress = klaar ? 100 : Math.min(92, Math.round((displayedStep / GEN_TAKEN.length) * 100))
  const genKop = klaar ? 'Klaar!' : `${GEN_TAKEN[displayedStep]}…`

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
            const done = i < displayedStep || klaar
            const current = !klaar && i === displayedStep
            const dotColor = done ? '#8FA88A' : current ? '#D9A441' : '#EAE2D5'
            const textColor = i <= displayedStep ? '#23231F' : '#A9A398'

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

        {generationError && !klaar && (
          <p className="font-serif text-[14px] text-subtle mb-6" role="status">
            {generationError}
          </p>
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
        ) : (
          <div className="animate-bk-rise">
            <div className="bg-cream-card border border-dark/10 rounded-card p-6 text-left">
              <div className="font-bold text-[17px] mb-1.5">Je krant wordt nu gemaakt</div>
              <p className="font-serif text-[15px] text-subtle mb-4">
                Vul je mailadres in en krijg een link als de krant af is. Of blijf wachten.
              </p>
              <RecoveryEmailForm initialEmail={data?.contactEmail || ''} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
