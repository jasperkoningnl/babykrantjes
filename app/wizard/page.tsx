'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import Step1BasisGegevens from '@/components/Step1BasisGegevens'
import Step2ExtraVragen from '@/components/Step2ExtraVragen'
import Step3Fotos from '@/components/Step3Fotos'
import Step4Review from '@/components/Step4Review'
import type { BabykrantData, BasisGegevens, ExtraVragen, GeuploadeFotos } from '@/lib/types'

const stapNamen = ['Basisgegevens', 'Het verhaal', "Foto's", 'Controle']
const stapTijden = ['± 2 minuten', '± 6 minuten', '± 1 minuut', 'Bijna klaar']

const EMPTY_DATA: BabykrantData = {
  basisGegevens: {
    volledigeNaam: '', geboorteDatum: '', geboorteTijd: '', geboorteplaats: '',
    gewicht: 0, lengte: 0, ouder1Naam: '', ouder2Naam: '', alleenstaand: false,
  },
  extraVragen: {
    geboorteLocatie: 'ziekenhuis', geboorteLocatieNaam: undefined,
    bevallingVerloop: undefined, bevallingAndersOmschrijving: undefined,
    wieWarenErbij: [], zwangerschapVerloop: undefined, voornaamReden: undefined,
    achternaamReden: undefined, heeftBroertjesZusjes: false, broertjesZusjes: [],
    reactieBroertjesZusjes: undefined, eersteKraamvisite: undefined, bijzonderheden: undefined,
  },
  fotos: { foto1: null, foto2: null, foto3: null, foto4: null },
  paperId: null,
}

export default function WizardPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [data, setData] = useState<BabykrantData>(EMPTY_DATA)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      let response = await fetch('/api/papers', { cache: 'no-store' })
      if (response.status === 401 || response.status === 404) {
        response = await fetch('/api/papers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: EMPTY_DATA }),
        })
      }
      if (!response.ok) return
      const result = await response.json()
      if (active && result.data) {
        setData({ ...EMPTY_DATA, ...result.data, paperId: result.data.paperId || result.id })
        setCurrentStep(Math.min(4, Math.max(1, Number(result.data.wizardStep || 1))))
        setHydrated(true)
      }
    })().catch((error) => console.error('[Wizard] Laden mislukt:', error))
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!hydrated || !data.paperId) return
    const timer = setTimeout(() => {
      fetch('/api/papers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { ...data, wizardStep: currentStep } }),
      }).catch((error) => console.error('[Wizard] Autosave mislukt:', error))
    }, 500)
    return () => clearTimeout(timer)
  }, [data, currentStep, hydrated])

  const ensurePaper = async (): Promise<string | null> => data.paperId || null

  const updateBasisGegevens = (newData: Partial<BasisGegevens>) => {
    setData(prev => ({
      ...prev,
      basisGegevens: { ...prev.basisGegevens, ...newData }
    }))
  }

  const updateExtraVragen = (newData: Partial<ExtraVragen>) => {
    setData(prev => ({
      ...prev,
      extraVragen: { ...prev.extraVragen, ...newData }
    }))
  }

  const updateFotos = (newData: Partial<GeuploadeFotos>) => {
    setData(prev => ({
      ...prev,
      fotos: { ...prev.fotos, ...newData }
    }))
  }

  const nextStep = () => {
    if (currentStep < 4) setCurrentStep(currentStep + 1)
  }

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1)
  }

  return (
    <div className="min-h-screen bg-cream text-dark font-sans">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-cream/[.92] backdrop-blur-sm border-b border-dark/10">
        <div className="max-w-container mx-auto px-7 py-3.5 flex items-center justify-between gap-6">
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <Image src="/favicon.svg" alt="" aria-hidden="true" width={30} height={30} className="rounded-full" />
            <div>
              <div className="font-bold text-[19px] leading-none tracking-tight text-dark">babykrantje<span className="text-terracotta">.nl</span></div>
              <div className="font-serif text-[11px] leading-none text-muted mt-1">Geboren op 1 september 2026</div>
            </div>
          </Link>
        </div>
      </div>

      <div className="max-w-[880px] mx-auto px-7 pt-9 pb-[90px]">
        {/* Progress bar */}
        <div className="flex gap-2 mb-2.5">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="flex-1 h-[5px] rounded-pill"
              style={{ background: n <= currentStep ? '#8FA88A' : '#EAE2D5' }}
            />
          ))}
        </div>
        <div className="flex justify-between text-[13px] text-muted mb-8">
          <span>Stap {currentStep} van 4 — {stapNamen[currentStep - 1]}</span>
          <span>{stapTijden[currentStep - 1]}</span>
        </div>

        {!hydrated && <div className="py-20" aria-hidden="true" />}
        {/* Step content */}
        {hydrated && currentStep === 1 && (
          <Step1BasisGegevens
            data={data.basisGegevens}
            updateData={updateBasisGegevens}
            onNext={nextStep}
            onBack={() => router.push('/')}
          />
        )}

        {hydrated && currentStep === 2 && (
          <Step2ExtraVragen
            data={data.extraVragen}
            updateData={updateExtraVragen}
            onNext={nextStep}
            onBack={prevStep}
          />
        )}

        {hydrated && currentStep === 3 && (
          <Step3Fotos
            data={data.fotos}
            updateData={updateFotos}
            ensurePaper={ensurePaper}
            onNext={nextStep}
            onBack={prevStep}
          />
        )}

        {hydrated && currentStep === 4 && (
          <Step4Review
            data={data}
            onBack={prevStep}
          />
        )}
      </div>
    </div>
  )
}
