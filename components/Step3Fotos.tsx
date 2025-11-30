'use client'

import { useState } from 'react'
import type { GeuploadeFotos } from '@/lib/types'

interface Props {
  data: GeuploadeFotos
  updateData: (data: Partial<GeuploadeFotos>) => void
  onNext: () => void
  onBack: () => void
}

export default function Step3Fotos({ data, updateData, onNext, onBack }: Props) {
  const [previews, setPreviews] = useState<{[key: string]: string}>({})

  const handleFileChange = (fotoKey: keyof GeuploadeFotos, file: File | null) => {
    updateData({ [fotoKey]: file })
    
    // Create preview
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviews(prev => ({ ...prev, [fotoKey]: reader.result as string }))
      }
      reader.readAsDataURL(file)
    } else {
      setPreviews(prev => {
        const newPreviews = { ...prev }
        delete newPreviews[fotoKey]
        return newPreviews
      })
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Voor testfase: geen validatie, alles optioneel
    onNext()
  }

  const renderFotoUpload = (
    fotoKey: keyof GeuploadeFotos, 
    label: string, 
    required: boolean = false
  ) => {
    const currentFile = data[fotoKey]
    const preview = previews[fotoKey]

    return (
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-400 transition-colors">
        <label className="block">
          <div className="text-sm font-medium mb-2">
            {label} {required && <span className="text-red-500">*</span>}
          </div>
          
          {preview ? (
            <div className="relative">
              <img 
                src={preview} 
                alt={label}
                className="w-full h-48 object-cover rounded-lg mb-2"
              />
              <button
                type="button"
                onClick={() => handleFileChange(fotoKey, null)}
                className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
              >
                Verwijder
              </button>
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
            accept="image/jpeg,image/png,image/jpg"
            onChange={(e) => {
              const file = e.target.files?.[0] || null
              if (file && file.size > 10 * 1024 * 1024) {
                alert('Bestand is te groot. Maximaal 10MB toegestaan.')
                return
              }
              handleFileChange(fotoKey, file)
            }}
            className="hidden"
          />
        </label>
        
        {currentFile && (
          <div className="mt-2 text-xs text-gray-600">
            {currentFile.name} ({(currentFile.size / 1024).toFixed(0)} KB)
          </div>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Foto's uploaden</h2>
        <p className="text-gray-600 mb-6">
          Upload maximaal 4 foto's voor het openingsartikel (optioneel voor testfase).
          Deze foto's komen op de voorpagina van het babykrantje.
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
          <strong>💡 Tip:</strong> Kies duidelijke, scherpe foto's met goede belichting. 
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