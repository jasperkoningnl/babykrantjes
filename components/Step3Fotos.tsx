'use client'

import { useState } from 'react'
import type { GeuploadeFotos, UploadedPhoto } from '@/lib/types'

interface Props {
  data: GeuploadeFotos
  updateData: (data: Partial<GeuploadeFotos>) => void
  ensurePaper: () => Promise<string | null>
  onNext: () => void
  onBack: () => void
}

const FOTO_POSITIONS: Record<keyof GeuploadeFotos, number> = {
  foto1: 1,
  foto2: 2,
  foto3: 3,
  foto4: 4,
}

export default function Step3Fotos({ data, updateData, ensurePaper, onNext, onBack }: Props) {
  const [uploading, setUploading] = useState<{ [key: string]: boolean }>({})
  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  const setError = (fotoKey: string, message: string | null) => {
    setErrors(prev => {
      const next = { ...prev }
      if (message) next[fotoKey] = message
      else delete next[fotoKey]
      return next
    })
  }

  const handleFileSelect = async (fotoKey: keyof GeuploadeFotos, file: File | null) => {
    setError(fotoKey, null)
    if (!file) {
      await handleRemove(fotoKey)
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(fotoKey, 'Bestand is te groot. Maximaal 10MB toegestaan.')
      return
    }
    setUploading(prev => ({ ...prev, [fotoKey]: true }))
    try {
      const paperId = await ensurePaper()
      const formData = new FormData()
      formData.append('file', file)
      formData.append('position', String(FOTO_POSITIONS[fotoKey]))
      if (paperId) formData.append('paperId', paperId)
      const response = await fetch('/api/photos/upload', { method: 'POST', body: formData })
      const result = await response.json()
      if (!response.ok) {
        setError(fotoKey, result?.error || 'Upload mislukt, probeer het opnieuw.')
        return
      }
      const photo: UploadedPhoto = { url: result.url, photoId: result.photoId ?? null, fileName: file.name }
      updateData({ [fotoKey]: photo })
    } catch (err) {
      console.error('[Step3] Upload fout:', err)
      setError(fotoKey, 'Upload mislukt, probeer het opnieuw.')
    } finally {
      setUploading(prev => ({ ...prev, [fotoKey]: false }))
    }
  }

  const handleRemove = async (fotoKey: keyof GeuploadeFotos) => {
    const current = data[fotoKey]
    updateData({ [fotoKey]: null })
    setError(fotoKey, null)
    if (current?.url) {
      try {
        await fetch('/api/photos/upload', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: current.url, photoId: current.photoId }),
        })
      } catch (err) {
        console.error('[Step3] Verwijderen uit Blob mislukt:', err)
      }
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onNext()
  }

  const renderSlot = (fotoKey: keyof GeuploadeFotos, isMain: boolean) => {
    const currentPhoto = data[fotoKey]
    const isUploading = uploading[fotoKey]
    const error = errors[fotoKey]
    const label = isMain ? 'Hoofdfoto' : `Foto ${FOTO_POSITIONS[fotoKey]}`

    return (
      <label
        key={fotoKey}
        className={`cursor-pointer border-2 border-dashed border-dark/25 rounded-[14px] bg-cream-card flex flex-col items-center justify-center gap-2 hover:border-sage hover:bg-[#F7F3EA] transition-colors overflow-hidden ${isMain ? 'h-[300px]' : ''}`}
      >
        {currentPhoto ? (
          <div className="relative w-full h-full">
            <img src={currentPhoto.url} alt={label} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); handleRemove(fotoKey) }}
              className="absolute top-2 right-2 bg-dark/70 text-cream text-xs px-2 py-1 rounded-pill"
            >
              Verwijder
            </button>
          </div>
        ) : isUploading ? (
          <div className="flex flex-col items-center gap-2 py-8">
            <div className="w-8 h-8 border-2 border-sage border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted">Uploaden...</span>
          </div>
        ) : (
          <>
            <div className="font-bold text-lg">{currentPhoto ? `✓ ${label}` : `+ ${label}`}</div>
            <div className="font-serif text-[15px] text-muted">
              {isMain ? 'Hoofdfoto — sleep hierheen of klik' : 'Klik om te uploaden'}
            </div>
          </>
        )}
        <input
          type="file"
          accept="image/jpeg,image/png,image/jpg,image/webp"
          disabled={isUploading}
          onChange={(e) => {
            const file = e.target.files?.[0] || null
            handleFileSelect(fotoKey, file)
            e.target.value = ''
          }}
          className="hidden"
        />
        {error && <div className="text-xs text-terracotta px-4 pb-2">{error}</div>}
      </label>
    )
  }

  return (
    <div className="animate-bk-rise">
      <h1 className="bk-heading">Vier foto&apos;s</h1>
      <p className="bk-subtext">Eén grote voor op de voorpagina, drie kleintjes voor de fotostrip. Liggend werkt het mooist.</p>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-[1.4fr_1fr] gap-4">
          {renderSlot('foto1', true)}
          <div className="grid grid-rows-3 gap-4">
            {renderSlot('foto2', false)}
            {renderSlot('foto3', false)}
            {renderSlot('foto4', false)}
          </div>
        </div>

        <div className="bg-peach rounded-xl p-4 mt-[18px] font-serif text-[15.5px] leading-relaxed">
          Geen foto bij de hand? Geen probleem — je kunt ze later toevoegen. De krant is ook zonder foto&apos;s compleet.
        </div>

        <div className="flex justify-between items-center mt-6">
          <button type="button" onClick={onBack} className="bk-btn-back">&larr; Terug</button>
          <button type="submit" className="bk-btn-primary">Controleren &rarr;</button>
        </div>
      </form>
    </div>
  )
}
