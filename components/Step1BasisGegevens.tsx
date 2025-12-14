// components/Step1BasisGegevens.tsx
// @version 2.0.0
// UPDATED: Inclusieve ouder-velden (Ouder 1/2 i.p.v. vader/moeder)

'use client'

import type { BasisGegevens } from '@/lib/types'

interface Props {
  data: BasisGegevens
  updateData: (data: Partial<BasisGegevens>) => void
  onNext: () => void
}

export default function Step1BasisGegevens({ data, updateData, onNext }: Props) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validatie - essentiële velden voor testen
    if (!data.volledigeNaam || !data.geboorteDatum || !data.geboorteplaats) {
      alert('Vul minimaal de naam, geboortedatum en geboorteplaats in')
      return
    }
    
    // Check: als alleenstaand = false, moet ouder2Naam ingevuld zijn
    // NOTE: Voor testing is dit uitgeschakeld, maar voor release moet dit weer aan
    // if (!data.alleenstaand && !data.ouder2Naam) {
    //   alert('Vul de naam van de tweede ouder in, of vink "Alleenstaande ouder" aan')
    //   return
    // }
    
    onNext()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Basisgegevens</h2>
        <p className="text-gray-600 mb-6">Vul de basisinformatie over de baby in</p>
      </div>

      {/* Volledige naam */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Volledige naam *
        </label>
        <input
          type="text"
          value={data.volledigeNaam}
          onChange={(e) => updateData({ volledigeNaam: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Bijv. Emma Sophie Jansen"
          required
        />
      </div>

      {/* Geboortedatum en tijd */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Geboortedatum *
          </label>
          <input
            type="date"
            value={data.geboorteDatum}
            onChange={(e) => updateData({ geboorteDatum: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">
            Tijdstip
          </label>
          <input
            type="time"
            value={data.geboorteTijd}
            onChange={(e) => updateData({ geboorteTijd: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Gewicht en lengte */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Gewicht (gram)
          </label>
          <input
            type="number"
            value={data.gewicht || ''}
            onChange={(e) => updateData({ gewicht: parseInt(e.target.value) || 0 })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Bijv. 3450"
            min="0"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">
            Lengte (cm)
          </label>
          <input
            type="number"
            value={data.lengte || ''}
            onChange={(e) => updateData({ lengte: parseInt(e.target.value) || 0 })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Bijv. 51"
            min="0"
          />
        </div>
      </div>

      {/* Geboorteplaats */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Geboorteplaats *
        </label>
        <input
          type="text"
          value={data.geboorteplaats}
          onChange={(e) => updateData({ geboorteplaats: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Bijv. Zwolle, Amsterdam, Utrecht..."
          required
        />
        <p className="text-xs text-gray-500 mt-1">
          We gebruiken dit voor het lokale weerbericht op de geboortedatum
        </p>
      </div>

      {/* Geboortelocatie */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Type geboortelocatie
        </label>
        <div className="space-y-2">
          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="thuis"
                checked={data.geboorteLocatie === 'thuis'}
                onChange={(e) => updateData({ 
                  geboorteLocatie: e.target.value as 'thuis' | 'ziekenhuis' | 'anders',
                  geboorteLocatieNaam: undefined
                })}
                className="mr-2"
              />
              Thuis
            </label>
            
            <label className="flex items-center">
              <input
                type="radio"
                value="ziekenhuis"
                checked={data.geboorteLocatie === 'ziekenhuis'}
                onChange={(e) => updateData({ 
                  geboorteLocatie: e.target.value as 'thuis' | 'ziekenhuis' | 'anders'
                })}
                className="mr-2"
              />
              Ziekenhuis
            </label>
            
            <label className="flex items-center">
              <input
                type="radio"
                value="anders"
                checked={data.geboorteLocatie === 'anders'}
                onChange={(e) => updateData({ 
                  geboorteLocatie: e.target.value as 'thuis' | 'ziekenhuis' | 'anders'
                })}
                className="mr-2"
              />
              Anders
            </label>
          </div>
          
          {(data.geboorteLocatie === 'ziekenhuis' || data.geboorteLocatie === 'anders') && (
            <input
              type="text"
              value={data.geboorteLocatieNaam || ''}
              onChange={(e) => updateData({ geboorteLocatieNaam: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={data.geboorteLocatie === 'ziekenhuis' ? 'Naam ziekenhuis (bijv. Isala Ziekenhuis)' : 'Bijv. geboortecentrum, onderweg...'}
            />
          )}
        </div>
      </div>

      {/* UPDATED v2.0.0: Inclusieve ouder-velden */}
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
        <h3 className="font-semibold text-blue-900 mb-3">👨‍👩‍👧 Oudergegevens</h3>
        
        <div className="space-y-4">
          {/* Ouder 1 */}
          <div>
            <label className="block text-sm font-medium mb-2 text-blue-900">
              Ouder 1 (bijv. moeder) *
            </label>
            <input
              type="text"
              value={data.ouder1Naam}
              onChange={(e) => updateData({ ouder1Naam: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Volledige naam"
            />
            <p className="text-xs text-blue-600 mt-1">
              Vul de naam in zoals je deze in de krant wilt zien
            </p>
          </div>
          
          {/* Alleenstaand checkbox */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="alleenstaand"
              checked={data.alleenstaand}
              onChange={(e) => updateData({ 
                alleenstaand: e.target.checked,
                ouder2Naam: e.target.checked ? undefined : data.ouder2Naam
              })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="alleenstaand" className="ml-2 text-sm font-medium text-blue-900">
              ☐ Alleenstaande ouder (vul alleen Ouder 1 in)
            </label>
          </div>
          
          {/* Ouder 2 - alleen tonen als niet alleenstaand */}
          {!data.alleenstaand && (
            <div>
              <label className="block text-sm font-medium mb-2 text-blue-900">
                Ouder 2 (bijv. vader/partner)
              </label>
              <input
                type="text"
                value={data.ouder2Naam || ''}
                onChange={(e) => updateData({ ouder2Naam: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Volledige naam"
              />
              <p className="text-xs text-blue-600 mt-1">
                Laat leeg als er geen tweede ouder is, of vink hierboven "Alleenstaande ouder" aan
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Submit button */}
      <div className="flex justify-end pt-4">
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg transition-colors"
        >
          Volgende stap →
        </button>
      </div>
    </form>
  )
}