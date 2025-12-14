// components/Step4Review.tsx
// @version 2.0.0
// UPDATED: Aangepast voor nieuwe ExtraVragen structuur en ouder1/ouder2 velden

'use client'

import { useRouter } from 'next/navigation'
import type { BabykrantData } from '@/lib/types'

interface Props {
  data: BabykrantData
  onBack: () => void
}

export default function Step4Review({ data, onBack }: Props) {
  const router = useRouter()
  
  const handleGenerate = () => {
    // Sla data op in localStorage voor testpagina
    localStorage.setItem('babykrant_test_data', JSON.stringify(data))
    
    // Navigeer naar testpagina
    router.push('/test-results')
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('nl-NL', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  }

  const geboorteLocatieText = () => {
    const { geboorteLocatie, geboorteLocatieNaam, geboorteplaats } = data.basisGegevens
    
    let locatie = ''
    if (geboorteLocatie === 'thuis') {
      locatie = 'Thuis'
    } else if (geboorteLocatieNaam) {
      locatie = geboorteLocatieNaam
    } else {
      locatie = geboorteLocatie.charAt(0).toUpperCase() + geboorteLocatie.slice(1)
    }
    
    return `${locatie}, ${geboorteplaats}`
  }

  const formatBevallingVerloop = (verloop?: string) => {
    if (!verloop) return '-'
    
    const labels: Record<string, string> = {
      'snel': 'Snel en voorspoedig',
      'langdurig': 'Langdurig maar goed verlopen',
      'spannend': 'Spannend met complicaties',
      'gepland': 'Gepland (keizersnede)',
      'anders': 'Anders',
      'niet-delen': 'Wil ik niet delen'
    }
    
    return labels[verloop] || verloop
  }

  const formatOuders = () => {
    const { ouder1Naam, ouder2Naam, alleenstaand } = data.basisGegevens
    
    if (alleenstaand || !ouder2Naam) {
      return ouder1Naam || '-'
    }
    
    return `${ouder1Naam} & ${ouder2Naam}`
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Controleer je gegevens</h2>
        <p className="text-gray-600 mb-6">
          Controleer of alle informatie klopt voordat je het babykrantje genereert.
        </p>
      </div>

      {/* Basisgegevens */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <span className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm">1</span>
          Basisgegevens
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-600">Naam:</span>
            <p className="text-gray-900">{data.basisGegevens.volledigeNaam}</p>
          </div>
          
          <div>
            <span className="font-medium text-gray-600">Geboortedatum:</span>
            <p className="text-gray-900">{formatDate(data.basisGegevens.geboorteDatum)}</p>
          </div>
          
          <div>
            <span className="font-medium text-gray-600">Tijdstip:</span>
            <p className="text-gray-900">{data.basisGegevens.geboorteTijd || '-'} uur</p>
          </div>
          
          <div>
            <span className="font-medium text-gray-600">Geboorteplaats:</span>
            <p className="text-gray-900">{geboorteLocatieText()}</p>
          </div>
          
          <div>
            <span className="font-medium text-gray-600">Gewicht:</span>
            <p className="text-gray-900">{data.basisGegevens.gewicht ? `${data.basisGegevens.gewicht} gram` : '-'}</p>
          </div>
          
          <div>
            <span className="font-medium text-gray-600">Lengte:</span>
            <p className="text-gray-900">{data.basisGegevens.lengte ? `${data.basisGegevens.lengte} cm` : '-'}</p>
          </div>
          
          <div>
            <span className="font-medium text-gray-600">
              {data.basisGegevens.alleenstaand ? 'Ouder:' : 'Ouders:'}
            </span>
            <p className="text-gray-900">{formatOuders()}</p>
          </div>
        </div>
      </div>

      {/* Extra vragen - UPDATED v2.0.0 */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <span className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm">2</span>
          Verhaal van de geboorte
        </h3>
        
        <div className="space-y-3 text-sm">
          {/* Bevalling verloop */}
          {data.extraVragen.bevallingVerloop && (
            <div>
              <span className="font-medium text-gray-600">Hoe was de bevalling:</span>
              <p className="text-gray-900 mt-1">
                {formatBevallingVerloop(data.extraVragen.bevallingVerloop)}
                {data.extraVragen.bevallingVerloop === 'anders' && data.extraVragen.bevallingAndersOmschrijving && (
                  <span className="text-gray-700"> - {data.extraVragen.bevallingAndersOmschrijving}</span>
                )}
              </p>
            </div>
          )}
          
          {/* Naam reden */}
          {data.extraVragen.naamReden && (
            <div>
              <span className="font-medium text-gray-600">Waarom deze naam:</span>
              <p className="text-gray-900 mt-1">{data.extraVragen.naamReden}</p>
            </div>
          )}
          
          {/* Broertjes/zusjes */}
          {data.extraVragen.heeftBroertjesZusjes && data.extraVragen.broertjesZusjes.length > 0 && (
            <div>
              <span className="font-medium text-gray-600">Broertjes/zusjes:</span>
              <div className="mt-1 space-y-1">
                {data.extraVragen.broertjesZusjes.map((sibling, idx) => (
                  <p key={idx} className="text-gray-900">
                    • {sibling.naam}
                    {sibling.leeftijd && <span className="text-gray-600"> ({sibling.leeftijd} jaar)</span>}
                  </p>
                ))}
              </div>
            </div>
          )}
          
          {/* Bijzonderheden */}
          {data.extraVragen.bijzonderheden && (
            <div>
              <span className="font-medium text-gray-600">Bijzonderheden:</span>
              <p className="text-gray-900 mt-1">{data.extraVragen.bijzonderheden}</p>
            </div>
          )}
          
          {/* Geen informatie ingevuld */}
          {!data.extraVragen.bevallingVerloop && 
           !data.extraVragen.naamReden && 
           !data.extraVragen.heeftBroertjesZusjes &&
           !data.extraVragen.bijzonderheden && (
            <p className="text-gray-500 italic">Geen extra informatie ingevuld</p>
          )}
        </div>
      </div>

      {/* Foto's */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <span className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm">3</span>
          Geüploade foto's
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[data.fotos.foto1, data.fotos.foto2, data.fotos.foto3, data.fotos.foto4].map((foto, idx) => (
            <div key={idx}>
              {foto ? (
                <div className="text-center">
                  <div className="bg-green-100 border border-green-300 rounded-lg p-4 h-32 flex items-center justify-center">
                    <div>
                      <svg className="w-8 h-8 text-green-600 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <p className="text-xs text-green-700 font-medium">Foto {idx + 1}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mt-1 truncate">{foto.name}</p>
                </div>
              ) : (
                <div className="bg-gray-100 border border-gray-300 rounded-lg p-4 h-32 flex items-center justify-center">
                  <p className="text-xs text-gray-400">Geen foto</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between pt-4">
        <button
          type="button"
          onClick={onBack}
          className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-8 py-3 rounded-lg transition-colors"
        >
          ← Vorige stap
        </button>
        
        <button
          type="button"
          onClick={handleGenerate}
          className="bg-green-600 hover:bg-green-700 text-white font-semibold px-8 py-3 rounded-lg transition-colors"
        >
          Genereer babykrantje ✨
        </button>
      </div>
    </div>
  )
}