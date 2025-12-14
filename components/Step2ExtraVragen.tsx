// components/Step2ExtraVragen.tsx
// @version 3.0.0
// VOLLEDIG HERZIEN: 10 gestructureerde vragen in 5 secties voor rijk hoofdartikel
// Sectie 1: Bevalling (waar, hoe, wie) - geboorteLocatie MOVED hier van Step1
// Sectie 2: Zwangerschap  
// Sectie 3: Naam (voornaam + achternaam)
// Sectie 4: Familie (broertjes/zusjes, reactie, eerste kraamvisite)
// Sectie 5: Bijzonderheden

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

  // Local state voor "wie waren erbij" checkboxes
  const wieErbijOpties = ['Partner', 'Opa/oma', 'Doula', 'Vriendin', 'Niemand anders']

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

  const toggleWieErbij = (optie: string) => {
    const current = data.wieWarenErbij || []
    if (current.includes(optie)) {
      updateData({ wieWarenErbij: current.filter(o => o !== optie) })
    } else {
      updateData({ wieWarenErbij: [...current, optie] })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Verhaal van de geboorte</h2>
        <p className="text-gray-600 mb-6">
          Deze informatie gebruiken we om het openingsartikel te schrijven. 
          Alles is optioneel, maar hoe meer je invult, hoe persoonlijker het verhaal wordt.
        </p>
      </div>

      {/* ====================================================================== */}
      {/* SECTIE 1: DE BEVALLING */}
      {/* ====================================================================== */}

      <div className="bg-orange-50 border-l-4 border-orange-400 p-4 rounded">
        <h3 className="font-semibold text-orange-900 mb-4">🏥 De Bevalling</h3>
        
        {/* Waar geboren - MOVED van Step 1 */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2 text-orange-900">
            Waar werd de baby geboren?
          </label>
          <div className="space-y-2">
            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="thuis"
                  checked={data.geboorteLocatie === 'thuis'}
                  onChange={(e) => updateData({ 
                    geboorteLocatie: e.target.value as 'thuis' | 'ziekenhuis' | 'geboortecentrum' | 'anders',
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
                    geboorteLocatie: e.target.value as 'thuis' | 'ziekenhuis' | 'geboortecentrum' | 'anders'
                  })}
                  className="mr-2"
                />
                Ziekenhuis
              </label>
              
              <label className="flex items-center">
                <input
                  type="radio"
                  value="geboortecentrum"
                  checked={data.geboorteLocatie === 'geboortecentrum'}
                  onChange={(e) => updateData({ 
                    geboorteLocatie: e.target.value as 'thuis' | 'ziekenhuis' | 'geboortecentrum' | 'anders',
                    geboorteLocatieNaam: undefined
                  })}
                  className="mr-2"
                />
                Geboortecentrum
              </label>
              
              <label className="flex items-center">
                <input
                  type="radio"
                  value="anders"
                  checked={data.geboorteLocatie === 'anders'}
                  onChange={(e) => updateData({ 
                    geboorteLocatie: e.target.value as 'thuis' | 'ziekenhuis' | 'geboortecentrum' | 'anders'
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder={data.geboorteLocatie === 'ziekenhuis' ? 'Naam ziekenhuis (bijv. Isala Ziekenhuis)' : 'Bijv. onderweg, bij vrienden...'}
              />
            )}
          </div>
        </div>

        {/* Hoe was bevalling - DROPDOWN */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2 text-orange-900">
            Hoe verliep de bevalling?
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

        {/* Wie waren erbij - CHECKBOXES */}
        <div>
          <label className="block text-sm font-medium mb-2 text-orange-900">
            Wie waren er bij de bevalling? (optioneel)
          </label>
          <div className="space-y-2">
            {wieErbijOpties.map((optie) => (
              <label key={optie} className="flex items-center">
                <input
                  type="checkbox"
                  checked={(data.wieWarenErbij || []).includes(optie)}
                  onChange={() => toggleWieErbij(optie)}
                  className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                />
                <span className="ml-2 text-sm text-gray-700">{optie}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* ====================================================================== */}
      {/* SECTIE 2: DE ZWANGERSCHAP */}
      {/* ====================================================================== */}

      <div className="bg-purple-50 border-l-4 border-purple-400 p-4 rounded">
        <h3 className="font-semibold text-purple-900 mb-4">🤰 De Zwangerschap</h3>
        
        {/* Hoe verliep zwangerschap - VRIJ TEKSTVELD */}
        <div>
          <label className="block text-sm font-medium mb-2 text-purple-900">
            Hoe verliep de zwangerschap? (optioneel)
          </label>
          <textarea
            value={data.zwangerschapVerloop || ''}
            onChange={(e) => updateData({ zwangerschapVerloop: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="Bijv. voorspoedig, laatste maand veel pijn, spannend begin..."
            rows={3}
            maxLength={200}
          />
          <p className="text-xs text-purple-600 mt-1">
            Max 200 karakters
          </p>
        </div>
      </div>

      {/* ====================================================================== */}
      {/* SECTIE 3: DE NAAM */}
      {/* ====================================================================== */}

      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
        <h3 className="font-semibold text-blue-900 mb-4">💭 De Naam</h3>
        
        {/* Waarom voornaam */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2 text-blue-900">
            Waarom hebben jullie voor deze voornaam gekozen? (optioneel)
          </label>
          <textarea
            value={data.voornaamReden || ''}
            onChange={(e) => updateData({ voornaamReden: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Bijv. al lang geclaimd, betekenis, familienaam, gewoon mooi..."
            rows={3}
            maxLength={300}
          />
          <p className="text-xs text-blue-600 mt-1">
            Max 300 karakters
          </p>
        </div>

        {/* Waarom achternaam */}
        <div>
          <label className="block text-sm font-medium mb-2 text-blue-900">
            Waarom deze achternaam? (optioneel)
          </label>
          <textarea
            value={data.achternaamReden || ''}
            onChange={(e) => updateData({ achternaamReden: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Bijv. familienaam behouden, combinatie van beide ouders, traditie..."
            rows={3}
            maxLength={300}
          />
          <p className="text-xs text-blue-600 mt-1">
            Max 300 karakters
          </p>
        </div>
      </div>

      {/* ====================================================================== */}
      {/* SECTIE 4: FAMILIE & EERSTE DAGEN */}
      {/* ====================================================================== */}

      <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded">
        <h3 className="font-semibold text-green-900 mb-4">👶 Familie & Eerste Dagen</h3>
        
        {/* Broertjes/zusjes - TOGGLE + ARRAY */}
        <div className="mb-4">
          <div className="flex items-center mb-3">
            <input
              type="checkbox"
              id="heeftBroertjesZusjes"
              checked={data.heeftBroertjesZusjes}
              onChange={(e) => {
                const hasKids = e.target.checked
                updateData({ 
                  heeftBroertjesZusjes: hasKids,
                  broertjesZusjes: hasKids ? data.broertjesZusjes : [],
                  reactieBroertjesZusjes: hasKids ? data.reactieBroertjesZusjes : undefined
                })
              }}
              className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
            />
            <label htmlFor="heeftBroertjesZusjes" className="ml-2 text-sm font-medium text-green-900">
              Dit kindje heeft broertjes en/of zusjes
            </label>
          </div>

          {/* Conditie: toon input als toggle aan staat */}
          {data.heeftBroertjesZusjes && (
            <div className="bg-white p-4 rounded-lg border border-green-200 space-y-3">
              <p className="text-sm text-green-800 font-medium">
                Voeg broertjes en zusjes toe:
              </p>
              
              {/* Lijst van toegevoegde broertjes/zusjes */}
              {data.broertjesZusjes.length > 0 && (
                <div className="space-y-2">
                  {data.broertjesZusjes.map((sibling, index) => (
                    <div key={index} className="flex items-center justify-between bg-green-50 p-2 rounded">
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
                  className="px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Naam"
                />
                <input
                  type="number"
                  value={newSiblingAge}
                  onChange={(e) => setNewSiblingAge(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Leeftijd (optioneel)"
                  min="0"
                  max="100"
                />
                <button
                  type="button"
                  onClick={handleAddSibling}
                  className="bg-green-500 hover:bg-green-600 text-white font-medium px-4 py-2 rounded transition-colors"
                >
                  + Toevoegen
                </button>
              </div>

              {/* Reactie broertjes/zusjes */}
              {data.broertjesZusjes.length > 0 && (
                <div className="pt-3 border-t border-green-200">
                  <label className="block text-sm font-medium mb-2 text-green-800">
                    Hoe reageerden ze? (optioneel)
                  </label>
                  <input
                    type="text"
                    value={data.reactieBroertjesZusjes || ''}
                    onChange={(e) => updateData({ reactieBroertjesZusjes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Bijv. heel enthousiast, wilde meteen vasthouden..."
                    maxLength={150}
                  />
                  <p className="text-xs text-green-600 mt-1">
                    Max 150 karakters
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Eerste kraamvisite */}
        <div>
          <label className="block text-sm font-medium mb-2 text-green-900">
            Wie kwam als eerste op kraamvisite? (optioneel)
          </label>
          <input
            type="text"
            value={data.eersteKraamvisite || ''}
            onChange={(e) => updateData({ eersteKraamvisite: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder="Bijv. opa en oma, tante Mariska, de buren..."
            maxLength={100}
          />
          <p className="text-xs text-green-600 mt-1">
            Max 100 karakters
          </p>
        </div>
      </div>

      {/* ====================================================================== */}
      {/* SECTIE 5: BIJZONDERHEDEN */}
      {/* ====================================================================== */}

      <div className="bg-gray-50 border-l-4 border-gray-400 p-4 rounded">
        <h3 className="font-semibold text-gray-900 mb-4">✨ Bijzonderheden</h3>
        
        {/* Bijzonderheden */}
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700">
            Bijzonderheden of andere leuke details? (optioneel)
          </label>
          <textarea
            value={data.bijzonderheden || ''}
            onChange={(e) => updateData({ bijzonderheden: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
            placeholder="Bijv. precies op uitgerekende datum geboren, met vliesje, bijzondere omstandigheden..."
            rows={4}
            maxLength={300}
          />
          <p className="text-xs text-gray-500 mt-1">
            Max 300 karakters
          </p>
        </div>
      </div>

      {/* Info box over AI */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>💡 Hoe werkt dit?</strong> De AI gebruikt deze informatie om een persoonlijk 
          openingsartikel te schrijven in de stijl van echte babykranten. Hoe meer details je geeft, 
          hoe rijker het verhaal wordt. Alle velden zijn optioneel - de AI improviseert netjes waar nodig.
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