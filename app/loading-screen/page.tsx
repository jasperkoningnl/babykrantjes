'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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

type JobStatus = 'queued' | 'running' | 'completed' | 'failed'

export default function LoadingScreenPage() {
  const router = useRouter()
  const [data, setData] = useState<Record<string, any> | null>(null)
  const [genStap, setGenStap] = useState(0)
  const [klaar, setKlaar] = useState(false)
  const [generationError, setGenerationError] = useState('')
  const [jobStatus, setJobStatus] = useState<JobStatus>('queued')
  const [retrying, setRetrying] = useState(false)
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

    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      try {
        const response = await fetch('/api/paper-jobs', {
          method: hasStarted.current ? 'GET' : 'POST',
          headers: hasStarted.current ? undefined : { 'Content-Type': 'application/json' },
          cache: 'no-store',
        })
        hasStarted.current = true
        const result = await response.json().catch(() => null)
        if (!response.ok || !result?.job) throw new Error(result?.error || 'Jobstatus niet beschikbaar')
        const status = result.job.status as JobStatus
        setJobStatus(status)
        setGenerationError(status === 'failed' ? (result.job.error || 'De generatie is permanent mislukt.') : '')
        if (status === 'completed') setKlaar(true)
        else if (!stopped && status !== 'failed') timer = setTimeout(poll, 2000)
      } catch {
        setGenerationError('De status kan even niet worden opgehaald. We proberen het opnieuw.')
        if (!stopped) timer = setTimeout(poll, 5000)
      }
    }
    void poll()
    return () => { stopped = true; clearTimeout(timer) }
  }, [data])

  const retryGeneration = async () => {
    setRetrying(true)
    setGenerationError('')
    try {
      const response = await fetch('/api/paper-jobs/retry', { method: 'POST' })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error || 'Opnieuw proberen mislukt')
      hasStarted.current = false
      setJobStatus('queued')
      // Reloading restarts the single polling effect without creating a new job.
      window.location.reload()
    } catch (cause) {
      setGenerationError(cause instanceof Error ? cause.message : 'Opnieuw proberen mislukt')
      setRetrying(false)
    }
  }

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
  const genKop = klaar ? 'Klaar!' : jobStatus === 'failed' ? 'Dit lukte niet' : `${GEN_TAKEN[displayedStep]}…`

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
          <div className="mb-6" role={jobStatus === 'failed' ? 'alert' : 'status'}>
            <p className="font-serif text-[14px] text-subtle mb-3">{generationError}</p>
            {jobStatus === 'failed' && (
              <button onClick={retryGeneration} disabled={retrying} className="bk-btn-primary disabled:opacity-60">
                {retrying ? 'Opnieuw inplannen…' : 'Probeer handmatig opnieuw'}
              </button>
            )}
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
        ) : (
          <div className="animate-bk-rise">
            <div className="bg-cream-card border border-dark/10 rounded-card p-6 text-left">
              <div className="font-bold text-[17px] mb-1.5">Je krant wordt nu gemaakt</div>
              <p className="font-serif text-[15px] text-subtle mb-4">
                Bewaar een herstellink per e-mail. Daarmee zie je later dezelfde jobstatus en hetzelfde resultaat.
              </p>
              <RecoveryEmailForm initialEmail={data?.contactEmail || ''} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
