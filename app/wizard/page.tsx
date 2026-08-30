'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Step1BasisGegevens from '@/components/Step1BasisGegevens'
import Step2ExtraVragen from '@/components/Step2ExtraVragen'
import Step3Fotos from '@/components/Step3Fotos'
import Step4Review from '@/components/Step4Review'
import type { BabykrantData, BasisGegevens, ExtraVragen, GeuploadeFotos } from '@/lib/types'

const stapNamen = ['Basisgegevens', 'Het verhaal', "Foto's", 'Controle']
const stapTijden = ['± 2 minuten', '± 6 minuten', '± 1 minuut', 'Bijna klaar']

export default function WizardPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [data, setData] = useState<BabykrantData>({
    basisGegevens: {
      volledigeNaam: '',
      geboorteDatum: '',
      geboorteTijd: '',
      geboorteplaats: '',
      gewicht: 0,
      lengte: 0,
      ouder1Naam: '',
      ouder2Naam: '',
      alleenstaand: false,
    },
    extraVragen: {
      geboorteLocatie: 'ziekenhuis',
      geboorteLocatieNaam: undefined,
      bevallingVerloop: undefined,
      bevallingAndersOmschrijving: undefined,
      wieWarenErbij: [],
      zwangerschapVerloop: undefined,
      voornaamReden: undefined,
      achternaamReden: undefined,
      heeftBroertjesZusjes: false,
      broertjesZusjes: [],
      reactieBroertjesZusjes: undefined,
      eersteKraamvisite: undefined,
      bijzonderheden: undefined,
    },
    fotos: {
      foto1: null,
      foto2: null,
      foto3: null,
      foto4: null,
    },
    paperId: null,
  })

  const paperPromiseRef = useRef<Promise<string | null> | null>(null)
  const ensurePaper = (): Promise<string | null> => {
    if (data.paperId) return Promise.resolve(data.paperId)
    if (!paperPromiseRef.current) {
      paperPromiseRef.current = (async () => {
        try {
          const response = await fetch('/api/papers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              basisGegevens: data.basisGegevens,
              extraVragen: data.extraVragen,
            }),
          })
          if (!response.ok) return null
          const result = await response.json()
          const id: string | null = result?.id ?? null
          if (id) setData(prev => ({ ...prev, paperId: id }))
          return id
        } catch (err) {
          console.error('[Wizard] Kon concept-krant niet aanmaken:', err)
          return null
        }
      })()
    }
    return paperPromiseRef.current
  }

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
            <div className="w-[30px] h-[30px] rounded-full bg-sage flex items-center justify-center text-cream font-extrabold text-[15px]">b</div>
            <div className="font-bold text-[19px] tracking-tight text-dark">babykrantje<span className="text-terracotta">.nl</span></div>
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

        {/* Step content */}
        {currentStep === 1 && (
          <Step1BasisGegevens
            data={data.basisGegevens}
            updateData={updateBasisGegevens}
            onNext={nextStep}
            onBack={() => router.push('/')}
          />
        )}

        {currentStep === 2 && (
          <Step2ExtraVragen
            data={data.extraVragen}
            updateData={updateExtraVragen}
            onNext={nextStep}
            onBack={prevStep}
          />
        )}

        {currentStep === 3 && (
          <Step3Fotos
            data={data.fotos}
            updateData={updateFotos}
            ensurePaper={ensurePaper}
            onNext={nextStep}
            onBack={prevStep}
          />
        )}

        {currentStep === 4 && (
          <Step4Review
            data={data}
            onBack={prevStep}
          />
        )}
      </div>
    </div>
  )
}
