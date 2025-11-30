'use client'

import type { BabykrantData } from '@/lib/types'

interface Props {
  data: BabykrantData
  onBack: () => void
}

export default function Step4Review({ data, onBack }: Props) {
  const handleGenerate = () => {
    // Voor nu: toon de data als JSON
    console.log('Babykrant data:', data)
    alert('Data is verzameld! (Check console voor JSON)\n\nVolgende stap: AI artikelen genereren (komt in volgende fase)')
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
    const { geboorteLocatie, geboorteLocatieNaam } = data.basisGegevens
    if (geboorteLocatie === 'thuis') return 'Thuis'
    if (geboorteLocatieNaam) return geboorteLocatieNaam
    return geboorteLocatie.charAt(0).toUpperCase() + geboorteLocatie.slice(1)
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
            <p className="text-gray-900">{data.basisGegevens.geboorteTijd} uur</p>
          </div>
          
          <div>
            <span className="font-medium text-gray-600">Geboorteplaats:</span>
            <p className="text-gray-900">{geboorteLocatieText()}</p>
          </div>
          
          <div>
            <span className="font-medium text-gray-600">Gewicht:</span>
            <p className="text-gray-900">{data.basisGegevens.gewicht} gram</p>
          </div>
          
          <div>
            <span className="font-medium text-gray-600">Lengte:</span>
            <p className="text-gray-900">{data.basisGegevens.lengte} cm</p>
          </div>
          
          {data.basisGegevens.woonplaats && (
            <div>
              <span className="font-medium text-gray-600">Woonplaats:</span>
              <p className="text-gray-900">{data.basisGegevens.woonplaats}</p>
            </div>
          )}
          
          <div>
            <span className="font-medium text-gray-600">Ouders:</span>
            <p className="text-gray-900">
              {data.basisGegevens.naamVader} & {data.basisGegevens.naamMoeder}
            </p>
          </div>
        </div>
      </div>

      {/* Extra vragen */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <span className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm">2</span>
          Extra informatie voor artikel
        </h3>
        
        <div className="space-y-3 text-sm">
          {data.extraVragen.waarWarenOuders && (
            <div>
              <span className="font-medium text-gray-600">Waar waren ouders:</span>
              <p className="text-gray-900 mt-1">{data.extraVragen.waarWarenOuders}</p>
            </div>
          )}
          
          {data.extraVragen.hoeGingBevalling && (
            <div>
              <span className="font-medium text-gray-600">Hoe ging de bevalling:</span>
              <p className="text-gray-900 mt-1">{data.extraVragen.hoeGingBevalling}</p>
            </div>
          )}
          
          {data.extraVragen.wieWarenBij && (
            <div>
              <span className="font-medium text-gray-600">Wie waren bij de bevalling:</span>
              <p className="text-gray-900 mt-1">{data.extraVragen.wieWarenBij}</p>
            </div>
          )}
          
          {data.extraVragen.waarWarenGrootouders && (
            <div>
              <span className="font-medium text-gray-600">Waar waren grootouders:</span>
              <p className="text-gray-900 mt-1">{data.extraVragen.waarWarenGrootouders}</p>
            </div>
          )}
          
          {data.extraVragen.eersteKraamvisite && (
            <div>
              <span className="font-medium text-gray-600">Eerste kraamvisite:</span>
              <p className="text-gray-900 mt-1">{data.extraVragen.eersteKraamvisite}</p>
            </div>
          )}
          
          {data.extraVragen.zwangerschapVerloop && (
            <div>
              <span className="font-medium text-gray-600">Zwangerschapsverloop:</span>
              <p className="text-gray-900 mt-1">{data.extraVragen.zwangerschapVerloop}</p>
            </div>
          )}
          
          {data.extraVragen.andereDetails && (
            <div>
              <span className="font-medium text-gray-600">Andere details:</span>
              <p className="text-gray-900 mt-1">{data.extraVragen.andereDetails}</p>
            </div>
          )}
          
          {!data.extraVragen.waarWarenOuders && !data.extraVragen.hoeGingBevalling && 
           !data.extraVragen.wieWarenBij && !data.extraVragen.waarWarenGrootouders &&
           !data.extraVragen.eersteKraamvisite && !data.extraVragen.zwangerschapVerloop &&
           !data.extraVragen.andereDetails && (
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