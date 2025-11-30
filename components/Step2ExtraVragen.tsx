'use client'

import type { ExtraVragen } from '@/lib/types'

interface Props {
  data: ExtraVragen
  updateData: (data: Partial<ExtraVragen>) => void
  onNext: () => void
  onBack: () => void
}

export default function Step2ExtraVragen({ data, updateData, onNext, onBack }: Props) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onNext()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Extra vragen</h2>
        <p className="text-gray-600 mb-6">
          Deze informatie gebruiken we om het openingsartikel te schrijven. 
          Je kunt velden leeg laten als ze niet van toepassing zijn.
        </p>
      </div>

      {/* Vraag 1 */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Waar waren de ouders tijdens de geboorte?
        </label>
        <textarea
          value={data.waarWarenOuders}
          onChange={(e) => updateData({ waarWarenOuders: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Bijv. In het ziekenhuis, of vader was onderweg vanuit kantoor..."
          rows={3}
        />
      </div>

      {/* Vraag 2 */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Hoe ging de bevalling?
        </label>
        <textarea
          value={data.hoeGingBevalling}
          onChange={(e) => updateData({ hoeGingBevalling: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Bijv. Voorspoedig, snel, met complicaties, thuis bevallen..."
          rows={3}
        />
      </div>

      {/* Vraag 3 */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Wie waren er allemaal bij de bevalling?
        </label>
        <textarea
          value={data.wieWarenBij}
          onChange={(e) => updateData({ wieWarenBij: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Bijv. Vader, verloskundige, ziekenhuis personeel, kraamverzorgster..."
          rows={3}
        />
      </div>

      {/* Vraag 4 */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Waar waren de eventuele opa's en oma's tijdens de bevalling?
        </label>
        <textarea
          value={data.waarWarenGrootouders}
          onChange={(e) => updateData({ waarWarenGrootouders: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Bijv. In de wachtkamer, thuis aan het wachten, onderweg vanuit..."
          rows={3}
        />
      </div>

      {/* Vraag 5 */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Wie was als eerste op kraamvisite?
        </label>
        <textarea
          value={data.eersteKraamvisite}
          onChange={(e) => updateData({ eersteKraamvisite: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Bijv. Oma en opa van vaderskant, de zus van moeder..."
          rows={3}
        />
      </div>

      {/* Vraag 6 */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Hoe verliep de zwangerschap?
        </label>
        <textarea
          value={data.zwangerschapVerloop}
          onChange={(e) => updateData({ zwangerschapVerloop: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Bijv. Voorspoedig, met veel ochtendmisselijkheid, tweeling verwacht..."
          rows={3}
        />
      </div>

      {/* Vraag 7 */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Andere details of opmerkelijkheden?
        </label>
        <textarea
          value={data.andereDetails}
          onChange={(e) => updateData({ andereDetails: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Bijv. Bijzondere gebeurtenissen, grappige momenten, familietraditie..."
          rows={4}
        />
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