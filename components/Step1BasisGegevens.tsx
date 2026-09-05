'use client'

import type { BasisGegevens } from '@/lib/types'
import HistoricalDateWarning from './HistoricalDateWarning'

interface Props {
  data: BasisGegevens
  updateData: (data: Partial<BasisGegevens>) => void
  onNext: () => void
  onBack: () => void
}

export default function Step1BasisGegevens({ data, updateData, onNext, onBack }: Props) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!data.volledigeNaam || !data.geboorteDatum || !data.geboorteplaats) {
      alert('Vul minimaal de naam, geboortedatum en geboorteplaats in')
      return
    }
    onNext()
  }

  return (
    <div className="animate-bk-rise">
      <h1 className="bk-heading">Wie is er geboren?</h1>
      <p className="bk-subtext">Met deze gegevens halen we het nieuws, het weer en de muziek van die dag op.</p>

      <form onSubmit={handleSubmit}>
        <div className="bk-card flex flex-col gap-5">
          {/* Naam */}
          <div>
            <label className="bk-label">Volledige naam van de baby</label>
            <input
              type="text"
              value={data.volledigeNaam}
              onChange={(e) => updateData({ volledigeNaam: e.target.value })}
              placeholder="Bijv. Lena Kooistra"
              className="bk-input"
              required
            />
          </div>

          {/* Datum, Tijd, Plaats grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div>
              <label className="bk-label">Geboortedatum</label>
              <input
                type="date"
                value={data.geboorteDatum}
                onChange={(e) => updateData({ geboorteDatum: e.target.value })}
                className="bk-input"
                required
              />
            </div>
            <div>
              <label className="bk-label">Tijdstip</label>
              <input
                type="time"
                value={data.geboorteTijd}
                onChange={(e) => updateData({ geboorteTijd: e.target.value })}
                className="bk-input"
              />
            </div>
            <div>
              <label className="bk-label">Geboorteplaats</label>
              <input
                type="text"
                value={data.geboorteplaats}
                onChange={(e) => updateData({ geboorteplaats: e.target.value })}
                placeholder="Amersfoort"
                className="bk-input"
                required
              />
            </div>
          </div>

          <HistoricalDateWarning date={data.geboorteDatum} />

          {/* Gewicht & Lengte */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="bk-label">Gewicht <span className="font-normal text-muted-light">in gram</span></label>
              <input
                type="number"
                value={data.gewicht || ''}
                onChange={(e) => updateData({ gewicht: parseInt(e.target.value) || 0 })}
                placeholder="3380"
                className="bk-input"
                min="0"
              />
            </div>
            <div>
              <label className="bk-label">Lengte <span className="font-normal text-muted-light">in cm</span></label>
              <input
                type="number"
                value={data.lengte || ''}
                onChange={(e) => updateData({ lengte: parseInt(e.target.value) || 0 })}
                placeholder="50"
                className="bk-input"
                min="0"
              />
            </div>
          </div>

          {/* Separator */}
          <div className="h-px bg-dark/10" />

          {/* Ouders */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="bk-label">Ouder 1</label>
              <input
                type="text"
                value={data.ouder1Naam}
                onChange={(e) => updateData({ ouder1Naam: e.target.value })}
                placeholder="Hilda Kooistra"
                className="bk-input"
              />
            </div>
            <div>
              <label className="bk-label">Ouder 2 <span className="font-normal text-muted-light">optioneel</span></label>
              <input
                type="text"
                value={data.ouder2Naam || ''}
                onChange={(e) => updateData({ ouder2Naam: e.target.value, alleenstaand: false })}
                placeholder="Jasper Koning"
                className="bk-input"
              />
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center mt-6">
          <button type="button" onClick={onBack} className="bk-btn-back">&larr; Terug</button>
          <button type="submit" className="bk-btn-primary">Naar het interview &rarr;</button>
        </div>
      </form>
    </div>
  )
}
