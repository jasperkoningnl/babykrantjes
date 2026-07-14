// app/wizard/page.tsx
// @version 4.0.0
// UPDATED v4.0.0: Foto's gaan direct naar Vercel Blob; wizard maakt bij de
// eerste upload een concept-krant (generated_papers) aan via /api/papers

'use client'

import { useState, useRef } from 'react'
import Step1BasisGegevens from '@/components/Step1BasisGegevens'
import Step2ExtraVragen from '@/components/Step2ExtraVragen'
import Step3Fotos from '@/components/Step3Fotos'
import Step4Review from '@/components/Step4Review'
import VersionFooter from '@/components/VersionFooter'
import type { BabykrantData, BasisGegevens, ExtraVragen, GeuploadeFotos } from '@/lib/types'

export default function WizardPage() {
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
      // SECTIE 1: Bevalling (MOVED van BasisGegevens)
      geboorteLocatie: 'ziekenhuis',
      geboorteLocatieNaam: undefined,
      bevallingVerloop: undefined,
      bevallingAndersOmschrijving: undefined,
      wieWarenErbij: [],
      
      // SECTIE 2: Zwangerschap
      zwangerschapVerloop: undefined,
      
      // SECTIE 3: Naam
      voornaamReden: undefined,
      achternaamReden: undefined,
      
      // SECTIE 4: Familie
      heeftBroertjesZusjes: false,
      broertjesZusjes: [],
      reactieBroertjesZusjes: undefined,
      eersteKraamvisite: undefined,
      
      // SECTIE 5: Bijzonderheden
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

  // Concept-krant aanmaken (één keer), zodat foto-uploads gekoppeld kunnen
  // worden aan generated_papers. De ref voorkomt dubbele aanmaak bij twee
  // snel opeenvolgende uploads.
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
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-pink-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {['Basisgegevens', 'Geboorte verhaal', 'Foto\'s', 'Review'].map((label, idx) => (
              <div 
                key={idx}
                className={`text-sm font-medium ${
                  currentStep === idx + 1 ? 'text-blue-600' : 
                  currentStep > idx + 1 ? 'text-green-600' : 'text-gray-400'
                }`}
              >
                {label}
              </div>
            ))}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / 4) * 100}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          {currentStep === 1 && (
            <Step1BasisGegevens 
              data={data.basisGegevens}
              updateData={updateBasisGegevens}
              onNext={nextStep}
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
      <VersionFooter />
    </div>
  )
}