// components/Step2ExtraVragen.tsx
// @version 2.0.0
// VOLLEDIG HERZIEN: Gestructureerde vragen voor AI tekstgeneratie
// Breaking change: oude vrije tekstvelden vervangen door dropdowns en specifieke inputs

'use client'

import { useState } from 'react'
import type { ExtraVragen, BroertjeZusje } from '@/lib/types'

interface Props {
  data: ExtraVragen
  updateData: (data: Partial<ExtraVragen>) => void
  onNext: () => void
  onBack: () => void
}

export default function Step2ExtraVragen({ data, updateData, onNext, onBack }: Props) {
  // Local state voor broertjes/zusjes inputs
  const [newSiblingName, setNewSiblingName] = useState('')
  const [newSiblingAge, setNewSiblingAge] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validatie voor RELEASE (nu uitgeschakeld voor testing)
    // if (!data.bevallingVerloop) {
    //   alert('Selecteer hoe de bevalling verliep')
    //   return
    // }
    
    // Validatie: als "anders" is geselecteerd, moet omschrijving ingevuld zijn
    if (data.bevallingVerloop === 'anders' && (!data.bevallingAndersOmschrijving || data.bevallingAndersOmschrijving.trim() === '')) {
      alert('Geef een korte omschrijving van hoe de bevalling verliep')
      return
    }
    
    // Validatie: als heeftBroertjesZusjes = true, moet er minimaal 1 broertje/zusje zijn
    if (data.heeftBroertjesZusjes && data.broertjesZusjes.length === 0) {
      alert('Voeg minimaal één broertje of zusje toe, of zet de toggle uit')
      return
    }
    
    onNext()
  }

  const handleAddSibling = () => {
    if (!newSiblingName.trim()) {
      alert('Vul een naam in')
      return
    }
    
    const newSibling: BroertjeZusje = {
      naam: newSiblingName.trim(),
      leeftijd: newSiblingAge ? parseInt(newSiblingAge) : undefined
    }
    
    updateData({
      broertjesZusjes: [...data.broertjesZusjes, newSibling]
    })
    
    // Reset inputs
    setNewSiblingName('')
    setNewSiblingAge('')
  }

  const handleRemoveSibling = (index: number) => {
    const updated = [...data.broertjesZusjes]
    updated.splice(index, 1)
    updateData({ broertjesZusjes: updated })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Verhaal van de geboorte</h2>
        <p className="text-gray-600 mb-6">
          Deze informatie gebruiken we om het openingsartikel te schrijven. 
          Velden zijn optioneel voor testen, maar hoe meer je invult, hoe persoonlijker het verhaal wordt.
        </p>
      </div>

      {/* ====================================================================== */}
      {/* TIER 2: HEEL BELANGRIJK - voor hoofdartikel */}
      {/* ====================================================================== */}

      <div className="bg-orange-50 border-l-4 border-orange-400 p-4 rounded">
        <h3 className="font-semibold text-orange-900 mb-4">📝 Belangrijke informatie voor het verhaal</h3>
        
        {/* Bevalling verloop - DROPDOWN */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2 text-orange-900">
            Hoe was de bevalling?
            {/* RELEASE: voeg hier ' *' toe om verplicht te maken */}
          </label>
          <select
            value={data.bevallingVerloop || ''}
            onChange={(e) => updateData({ 
              bevallingVerloop: e.target.value as ExtraVragen['bevallingVerloop'],
              bevallingAndersOmschrijving: e.target.value === 'anders' ? data.bevallingAndersOmschrijving : undefined
            })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            // required // RELEASE: uncomment voor verplicht veld
          >
            <option value="">-- Selecteer een optie --</option>
            <option value="snel">Snel en voorspoedig</option>
            <option value="langdurig">Langdurig maar goed verlopen</option>
            <option value="spannend">Spannend met complicaties</option>
            <option value="gepland">Gepland (keizersnede)</option>
            <option value="anders">Anders</option>
            <option value="niet-delen">Wil ik niet delen</option>
          </select>
          
          {/* Conditie: toon tekstveld als "anders" geselecteerd */}
          {data.bevallingVerloop === 'anders' && (
            <div className="mt-3">
              <label className="block text-sm font-medium mb-2 text-orange-700">
                Beschrijf kort hoe de bevalling verliep:
              </label>
              <input
                type="text"
                value={data.bevallingAndersOmschrijving || ''}
                onChange={(e) => updateData({ bevallingAndersOmschrijving: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Bijv. thuis bevallen met doula, in auto onderweg..."
                maxLength={150}
                required
              />
              <p className="text-xs text-orange-600 mt-1">
                Max 150 karakters
              </p>
            </div>
          )}
        </div>

        {/* Waarom deze naam */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2 text-orange-900">
            Waarom hebben jullie voor deze naam gekozen? (optioneel)
          </label>
          <input
            type="text"
            value={data.naamReden || ''}
            onChange={(e) => updateData({ naamReden: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="Bijv. familienaam, betekenis, gewoon mooi..."
            maxLength={100}
          />
          <p className="text-xs text-orange-600 mt-1">
            Max 100 karakters • Optioneel
          </p>
        </div>

        {/* Broertjes/zusjes - TOGGLE + ARRAY */}
        <div>
          <div className="flex items-center mb-3">
            <input
              type="checkbox"
              id="heeftBroertjesZusjes"
              checked={data.heeftBroertjesZusjes}
              onChange={(e) => {
                const hasKids = e.target.checked
                updateData({ 
                  heeftBroertjesZusjes: hasKids,
                  broertjesZusjes: hasKids ? data.broertjesZusjes : []
                })
              }}
              className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
            />
            <label htmlFor="heeftBroertjesZusjes" className="ml-2 text-sm font-medium text-orange-900">
              Dit kindje heeft broertjes en/of zusjes
            </label>
          </div>

          {/* Conditie: toon input als toggle aan staat */}
          {data.heeftBroertjesZusjes && (
            <div className="bg-white p-4 rounded-lg border border-orange-200">
              <p className="text-sm text-orange-800 mb-3">
                Voeg broertjes en zusjes toe (naam + optioneel leeftijd):
              </p>
              
              {/* Lijst van toegevoegde broertjes/zusjes */}
              {data.broertjesZusjes.length > 0 && (
                <div className="mb-3 space-y-2">
                  {data.broertjesZusjes.map((sibling, index) => (
                    <div key={index} className="flex items-center justify-between bg-orange-50 p-2 rounded">
                      <span className="text-sm">
                        <strong>{sibling.naam}</strong>
                        {sibling.leeftijd && <span className="text-gray-600"> ({sibling.leeftijd} jaar)</span>}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSibling(index)}
                        className="text-red-500 hover:text-red-700 text-sm font-medium"
                      >
                        Verwijder
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Input voor nieuw broertje/zusje */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={newSiblingName}
                  onChange={(e) => setNewSiblingName(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Naam"
                />
                <input
                  type="number"
                  value={newSiblingAge}
                  onChange={(e) => setNewSiblingAge(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Leeftijd (optioneel)"
                  min="0"
                  max="100"
                />
                <button
                  type="button"
                  onClick={handleAddSibling}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-2 rounded transition-colors"
                >
                  + Toevoegen
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ====================================================================== */}
      {/* TIER 3: LEUK MAAR OPTIONEEL - voor extra kleur */}
      {/* ====================================================================== */}

      <div className="bg-gray-50 border-l-4 border-gray-400 p-4 rounded">
        <h3 className="font-semibold text-gray-900 mb-4">✨ Extra details (optioneel)</h3>
        
        {/* Bijzonderheden */}
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700">
            Bijzonderheden of andere leuke details?
          </label>
          <textarea
            value={data.bijzonderheden || ''}
            onChange={(e) => updateData({ bijzonderheden: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
            placeholder="Bijv. precies op uitgerekende datum geboren, met vliesje, bijzondere omstandigheden..."
            rows={4}
          />
          <p className="text-xs text-gray-500 mt-1">
            Dit kan van alles zijn: grappige momenten, bijzondere omstandigheden, familietradities...
          </p>
        </div>
      </div>

      {/* Info box over AI */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>💡 Hoe werkt dit?</strong> De AI gebruikt deze informatie om een persoonlijk 
          openingsartikel te schrijven in de stijl van echte babykranten. Hoe meer details je geeft, 
          hoe rijker het verhaal wordt. Optionele velden kun je leeg laten - de AI improviseert dan netjes.
        </p>
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
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg transition-colors"
        >
          Volgende stap →
        </button>
      </div>
    </form>
  )
}