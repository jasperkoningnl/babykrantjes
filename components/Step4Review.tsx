// components/Step4Review.tsx
// @version 3.0.0
// UPDATED: Alle nieuwe ExtraVragen velden + geboorteLocatie verplaatst

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
    localStorage.setItem('babykrant_test_data', JSON.stringify(data))
    router.push('/loading-screen')
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('nl-NL', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    })
  }

  const geboorteLocatieText = () => {
    const { geboorteLocatie, geboorteLocatieNaam } = data.extraVragen
    
    let locatie = ''
    if (geboorteLocatie === 'thuis') {
      locatie = 'Thuis'
    } else if (geboorteLocatie === 'ziekenhuis') {
      locatie = geboorteLocatieNaam || 'Ziekenhuis'
    } else if (geboorteLocatie === 'geboortecentrum') {
      locatie = 'Geboortecentrum'
    } else {
      locatie = geboorteLocatieNaam || 'Anders'
    }
    
    return locatie
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
            <p className="text-gray-900">{data.basisGegevens.geboorteplaats}</p>
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

      {/* Geboorte verhaal */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <span className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm">2</span>
          Verhaal van de geboorte
        </h3>
        
        <div className="space-y-3 text-sm">
          {/* Geboortelocatie */}
          <div>
            <span className="font-medium text-gray-600">Locatie:</span>
            <p className="text-gray-900 mt-1">{geboorteLocatieText()}, {data.basisGegevens.geboorteplaats}</p>
          </div>
          
          {/* Bevalling */}
          {data.extraVragen.bevallingVerloop && (
            <div>
              <span className="font-medium text-gray-600">Bevalling:</span>
              <p className="text-gray-900 mt-1">
                {formatBevallingVerloop(data.extraVragen.bevallingVerloop)}
                {data.extraVragen.bevallingVerloop === 'anders' && data.extraVragen.bevallingAndersOmschrijving && (
                  <span className="text-gray-700"> - {data.extraVragen.bevallingAndersOmschrijving}</span>
                )}
              </p>
            </div>
          )}
          
          {/* Wie erbij */}
          {data.extraVragen.wieWarenErbij && data.extraVragen.wieWarenErbij.length > 0 && (
            <div>
              <span className="font-medium text-gray-600">Wie waren erbij:</span>
              <p className="text-gray-900 mt-1">{data.extraVragen.wieWarenErbij.join(', ')}</p>
            </div>
          )}
          
          {/* Zwangerschap */}
          {data.extraVragen.zwangerschapVerloop && (
            <div>
              <span className="font-medium text-gray-600">Zwangerschap:</span>
              <p className="text-gray-900 mt-1">{data.extraVragen.zwangerschapVerloop}</p>
            </div>
          )}
          
          {/* Voornaam reden */}
          {data.extraVragen.voornaamReden && (
            <div>
              <span className="font-medium text-gray-600">Waarom voornaam:</span>
              <p className="text-gray-900 mt-1">{data.extraVragen.voornaamReden}</p>
            </div>
          )}
          
          {/* Achternaam reden */}
          {data.extraVragen.achternaamReden && (
            <div>
              <span className="font-medium text-gray-600">Waarom achternaam:</span>
              <p className="text-gray-900 mt-1">{data.extraVragen.achternaamReden}</p>
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
              {data.extraVragen.reactieBroertjesZusjes && (
                <p className="text-gray-700 mt-1 italic">Reactie: {data.extraVragen.reactieBroertjesZusjes}</p>
              )}
            </div>
          )}
          
          {/* Eerste kraamvisite */}
          {data.extraVragen.eersteKraamvisite && (
            <div>
              <span className="font-medium text-gray-600">Eerste kraamvisite:</span>
              <p className="text-gray-900 mt-1">{data.extraVragen.eersteKraamvisite}</p>
            </div>
          )}
          
          {/* Bijzonderheden */}
          {data.extraVragen.bijzonderheden && (
            <div>
              <span className="font-medium text-gray-600">Bijzonderheden:</span>
              <p className="text-gray-900 mt-1">{data.extraVragen.bijzonderheden}</p>
            </div>
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
                  <img
                    src={foto.url}
                    alt={`Foto ${idx + 1}`}
                    className="w-full h-32 object-cover rounded-lg border border-green-300"
                  />
                  <p className="text-xs text-gray-600 mt-1 truncate">{foto.fileName || `Foto ${idx + 1}`}</p>
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