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
    if (!dateString) return '—'
    const date = new Date(dateString)
    return date.toLocaleDateString('nl-NL', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    })
  }

  const formatOuders = () => {
    const { ouder1Naam, ouder2Naam, alleenstaand } = data.basisGegevens
    if (alleenstaand || !ouder2Naam) return ouder1Naam || '—'
    return `${ouder1Naam} & ${ouder2Naam}`
  }

  const samenvatting = [
    { k: 'Naam', v: data.basisGegevens.volledigeNaam || '—' },
    { k: 'Geboren', v: formatDate(data.basisGegevens.geboorteDatum) + (data.basisGegevens.geboorteTijd ? `, ${data.basisGegevens.geboorteTijd} uur` : '') },
    { k: 'Plaats', v: data.basisGegevens.geboorteplaats || '—' },
    { k: 'Maten', v: `${data.basisGegevens.gewicht || '—'} gram · ${data.basisGegevens.lengte || '—'} cm` },
    { k: 'Ouders', v: formatOuders() },
    { k: 'Het verhaal', v: data.extraVragen.zwangerschapVerloop || 'Nog niet ingevuld' },
    { k: "Foto's", v: `${[data.fotos.foto1, data.fotos.foto2, data.fotos.foto3, data.fotos.foto4].filter(Boolean).length} van 4 toegevoegd` },
  ]

  const bronnen = ['NOS-archief', 'KNMI', 'Top 40', 'TMDB films & series', 'TV-gids', 'Meertens naamdatabank', 'Wikipedia']

  return (
    <div className="animate-bk-rise">
      <h1 className="bk-heading">Klopt dit?</h1>
      <p className="bk-subtext">Daarna schrijven we de acht artikelen. Aanpassen kan altijd nog.</p>

      {/* Summary card */}
      <div className="bg-cream-card border border-dark/10 rounded-card px-7 py-2 mb-[18px]">
        {samenvatting.map((r, i) => (
          <div key={i} className="flex justify-between gap-5 py-3.5 border-b border-dark/[.08] last:border-b-0">
            <div className="text-sm text-muted min-w-[170px]">{r.k}</div>
            <div className="font-serif text-base text-right">{r.v}</div>
          </div>
        ))}
      </div>

      {/* Sources */}
      <div className="bk-card">
        <div className="font-bold text-[17px] mb-3">Wij zoeken er zelf bij</div>
        <div className="flex flex-wrap gap-2">
          {bronnen.map((b) => (
            <div key={b} className="bg-cream-dark rounded-pill px-3.5 py-[7px] text-sm">{b}</div>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center mt-6">
        <button type="button" onClick={onBack} className="bk-btn-back">&larr; Terug</button>
        <button type="button" onClick={handleGenerate} className="bk-btn-dark">Maak mijn krant</button>
      </div>
    </div>
  )
}
