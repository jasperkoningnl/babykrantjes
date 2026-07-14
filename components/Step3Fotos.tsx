// components/Step3Fotos.tsx
// @version 2.0.0
// UPDATED v2.0.0: Foto's worden direct bij selectie geüpload naar Vercel
// Blob (via /api/photos/upload). De wizard-state bevat alleen nog URLs,
// zodat foto's een refresh en localStorage-roundtrip overleven.

'use client'

import { useState } from 'react'
import type { GeuploadeFotos, UploadedPhoto } from '@/lib/types'

interface Props {
  data: GeuploadeFotos
  updateData: (data: Partial<GeuploadeFotos>) => void
  /** Maakt (één keer) de concept-krant aan en geeft het paper-id terug */
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

      const response = await fetch('/api/photos/upload', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()
      if (!response.ok) {
        setError(fotoKey, result?.error || 'Upload mislukt, probeer het opnieuw.')
        return
      }

      const photo: UploadedPhoto = {
        url: result.url,
        photoId: result.photoId ?? null,
        fileName: file.name,
      }
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
        // De foto is al uit de wizard-state; een mislukte blob-delete is
        // geen blokkade voor de gebruiker.
        console.error('[Step3] Verwijderen uit Blob mislukt:', err)
      }
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onNext()
  }

  const renderFotoUpload = (
    fotoKey: keyof GeuploadeFotos,
    label: string,
    required: boolean = false
  ) => {
    const currentPhoto = data[fotoKey]
    const isUploading = uploading[fotoKey]
    const error = errors[fotoKey]

    return (
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-400 transition-colors">
        <label className="block">
          <div className="text-sm font-medium mb-2">
            {label} {required && <span className="text-red-500">*</span>}
          </div>

          {currentPhoto ? (
            <div className="relative">
              <img
                src={currentPhoto.url}
                alt={label}
                className="w-full h-48 object-cover rounded-lg mb-2"
              />
              <button
                type="button"
                onClick={() => handleRemove(fotoKey)}
                className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
              >
                Verwijder
              </button>
            </div>
          ) : isUploading ? (
            <div className="flex flex-col items-center justify-center h-48 bg-gray-50 rounded-lg">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-2" />
              <span className="text-sm text-gray-500">Uploaden...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 bg-gray-50 rounded-lg cursor-pointer">
              <svg className="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm text-gray-500">Klik om foto te uploaden</span>
              <span className="text-xs text-gray-400 mt-1">JPG, PNG (max 10MB)</span>
            </div>
          )}

          <input
            type="file"
            accept="image/jpeg,image/png,image/jpg,image/webp"
            disabled={isUploading}
            onChange={(e) => {
              const file = e.target.files?.[0] || null
              handleFileSelect(fotoKey, file)
              // Reset zodat dezelfde file opnieuw gekozen kan worden
              e.target.value = ''
            }}
            className="hidden"
          />
        </label>

        {error && (
          <div className="mt-2 text-xs text-red-600">{error}</div>
        )}

        {currentPhoto?.fileName && !error && (
          <div className="mt-2 text-xs text-gray-600">{currentPhoto.fileName}</div>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Foto&apos;s uploaden</h2>
        <p className="text-gray-600 mb-6">
          Upload maximaal 4 foto&apos;s voor het openingsartikel (optioneel voor testfase).
          Deze foto&apos;s komen op de voorpagina van het babykrantje.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {renderFotoUpload('foto1', 'Foto 1')}
        {renderFotoUpload('foto2', 'Foto 2')}
        {renderFotoUpload('foto3', 'Foto 3')}
        {renderFotoUpload('foto4', 'Foto 4')}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>💡 Tip:</strong> Kies duidelijke, scherpe foto&apos;s met goede belichting.
          Close-ups van het gezicht werken het beste voor een babykrantje.
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
