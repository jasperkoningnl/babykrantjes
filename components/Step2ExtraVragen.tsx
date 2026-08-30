'use client'

import { useState } from 'react'
import type { ExtraVragen } from '@/lib/types'

interface Props {
  data: ExtraVragen
  updateData: (data: Partial<ExtraVragen>) => void
  onNext: () => void
  onBack: () => void
}

type ChipSet = 'zwangerschap' | 'plek' | 'bevalling' | 'baby'

const CHIP_SETS: Record<ChipSet, string[]> = {
  zwangerschap: ['Voorspoedig', 'Zwaar', 'Spannend', 'Verrassend', 'Lang naar verlangd'],
  plek: ['Thuis', 'Ziekenhuis', 'Geboortecentrum', 'Anders'],
  bevalling: ['Snel', 'Langdurig', 'Spannend', 'Geplande keizersnede', 'Precies zoals bedacht'],
  baby: ['Rustig', 'Luidkeels', 'Hongerig', 'Veel haar', 'Kleine handjes', 'Sprekend papa/mama'],
}

export default function Step2ExtraVragen({ data, updateData, onNext, onBack }: Props) {
  const MULTI_SELECT_SETS: ChipSet[] = ['baby']

  const [chips, setChips] = useState<Record<ChipSet, string[]>>({
    zwangerschap: [],
    plek: data.geboorteLocatie ? [data.geboorteLocatie === 'thuis' ? 'Thuis' : data.geboorteLocatie === 'ziekenhuis' ? 'Ziekenhuis' : data.geboorteLocatie === 'geboortecentrum' ? 'Geboortecentrum' : 'Anders'] : [],
    bevalling: [],
    baby: data.eersteIndruk || [],
  })
  const [eersteIndrukOverig, setEersteIndrukOverig] = useState(data.eersteIndrukOverig || '')

  const toggleChip = (set: ChipSet, label: string) => {
    setChips(prev => {
      const cur = prev[set]
      const isMulti = MULTI_SELECT_SETS.includes(set)
      const next = cur.includes(label)
        ? cur.filter(x => x !== label)
        : isMulti ? [...cur, label] : [label]
      return { ...prev, [set]: next }
    })

    if (set === 'plek') {
      const locMap: Record<string, string> = { 'Thuis': 'thuis', 'Ziekenhuis': 'ziekenhuis', 'Geboortecentrum': 'geboortecentrum', 'Anders': 'anders' }
      updateData({ geboorteLocatie: locMap[label] as any || 'anders' })
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateData({
      zwangerschapVerloop: chips.zwangerschap.join(', ') || undefined,
      bevallingVerloop: chips.bevalling.length > 0 ? chips.bevalling[0].toLowerCase() as any : undefined,
      eersteIndruk: chips.baby.length > 0 ? chips.baby : undefined,
      eersteIndrukOverig: eersteIndrukOverig.trim() || undefined,
    })
    onNext()
  }

  const renderChips = (set: ChipSet) => (
    <div className="flex flex-wrap gap-[9px]">
      {CHIP_SETS[set].map(label => {
        const on = chips[set].includes(label)
        return (
          <button
            key={label}
            type="button"
            onClick={() => toggleChip(set, label)}
            className={`bk-chip ${on ? 'bk-chip-on' : 'bk-chip-off'}`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )

  return (
    <div className="animate-bk-rise">
      <h1 className="bk-heading">Vertel het verhaal</h1>
      <p className="font-serif text-lg text-subtle mb-3">
        Hier komt het openingsartikel vandaan. Alles mag je overslaan — hoe meer je vertelt, hoe persoonlijker de krant.
      </p>
      <div className="text-sm text-muted-light mb-6">Ongeveer 6 minuten</div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]">
        {/* De zwangerschap */}
        <div className="bk-card">
          <div className="flex items-center gap-2.5 mb-[18px]">
            <div className="bk-section-dot bg-sage" />
            <div className="font-bold text-xl tracking-tight">De zwangerschap</div>
          </div>
          <label className="bk-label mb-[9px]">Hoe verliep de zwangerschap?</label>
          {renderChips('zwangerschap')}
          <div className="mt-5">
            <label className="bk-label">Hoe hebben jullie het nieuws verteld?</label>
            <textarea
              value={data.bijzonderheden || ''}
              onChange={(e) => updateData({ bijzonderheden: e.target.value })}
              rows={2}
              placeholder="Bijv. half Nederland doorgereden om het persoonlijk te vertellen"
              className="bk-input font-serif"
            />
          </div>
        </div>

        {/* De bevalling */}
        <div className="bk-card">
          <div className="flex items-center gap-2.5 mb-[18px]">
            <div className="bk-section-dot bg-terracotta" />
            <div className="font-bold text-xl tracking-tight">De bevalling</div>
          </div>
          <label className="bk-label mb-[9px]">Waar is de baby geboren?</label>
          {renderChips('plek')}
          <div className="mt-5">
            <label className="bk-label mb-[9px]">Hoe verliep het?</label>
            {renderChips('bevalling')}
          </div>
          <div className="mt-5">
            <label className="bk-label">Het moment dat jullie nooit vergeten</label>
            <textarea
              value={data.zwangerschapVerloop || ''}
              onChange={(e) => updateData({ zwangerschapVerloop: e.target.value })}
              rows={3}
              placeholder="Bijv. zittend op de baarkruk van oma, om 19.55 uur"
              className="bk-input font-serif"
            />
            <div className="text-[13px] text-muted-light mt-2">Wat je hier schrijft komt letterlijk terug in de kop of de eerste alinea.</div>
          </div>
        </div>

        {/* De baby & de naam */}
        <div className="bk-card">
          <div className="flex items-center gap-2.5 mb-[18px]">
            <div className="bk-section-dot bg-gold" />
            <div className="font-bold text-xl tracking-tight">De baby &amp; de naam</div>
          </div>
          <label className="bk-label">Waarom deze naam?</label>
          <textarea
            value={data.voornaamReden || ''}
            onChange={(e) => updateData({ voornaamReden: e.target.value })}
            rows={2}
            placeholder="Vernoemd naar, betekenis, of gewoon mooi"
            className="bk-input font-serif mb-5"
          />
          <label className="bk-label mb-[9px]">Eerste indruk van dit kindje</label>
          {renderChips('baby')}
          <input
            type="text"
            value={eersteIndrukOverig}
            onChange={(e) => setEersteIndrukOverig(e.target.value)}
            placeholder="Of omschrijf het zelf…"
            className="bk-input mt-3"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-5">
            <div>
              <label className="bk-label">Broertjes of zusjes</label>
              <input
                type="text"
                value={data.eersteKraamvisite ? '' : ''}
                onChange={() => {}}
                placeholder="Bijv. Sem (3)"
                className="bk-input"
              />
            </div>
            <div>
              <label className="bk-label">Eerste kraamvisite</label>
              <input
                type="text"
                value={data.eersteKraamvisite || ''}
                onChange={(e) => updateData({ eersteKraamvisite: e.target.value })}
                placeholder="Opa en oma"
                className="bk-input"
              />
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center mt-6">
          <button type="button" onClick={onBack} className="bk-btn-back">&larr; Terug</button>
          <button type="submit" className="bk-btn-primary">Naar de foto&apos;s &rarr;</button>
        </div>
      </form>
    </div>
  )
}
