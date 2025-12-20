// app/generate-articles/page.tsx
// @version 1.0.0
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ARTICLE_SECTIONS, type ArticleSection, type GeneratedArticle, type ArticleGenerationResponse } from '@/lib/articleTypes'
import VersionFooter from '@/components/VersionFooter'

function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem('babykrant_session_id')
  if (!id) {
    id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    localStorage.setItem('babykrant_session_id', id)
  }
  return id
}

export default function GenerateArticlesPage() {
  const [sessionId, setSessionId] = useState('')
  const [testData, setTestData] = useState<any>(null)
  const [articles, setArticles] = useState<Record<ArticleSection, GeneratedArticle | null>>({
    hoofdartikel: null,
    sterrenbeeld: null,
    nieuws: null,
    weer: null,
    cultuur: null,
    naam_betekenis: null,
    beroemde_namen: null,
    geboren_op_dag: null
  })
  const [loading, setLoading] = useState<Record<ArticleSection, boolean>>({
    hoofdartikel: false,
    sterrenbeeld: false,
    nieuws: false,
    weer: false,
    cultuur: false,
    naam_betekenis: false,
    beroemde_namen: false,
    geboren_op_dag: false
  })
  const [usageInfo, setUsageInfo] = useState({ remaining: 50, cost: 0 })

  useEffect(() => {
    setSessionId(getSessionId())
    const stored = localStorage.getItem('babykrant_test_data')
    if (stored) {
      setTestData(JSON.parse(stored))
    }
  }, [])

  const generateArticle = async (section: ArticleSection) => {
    if (!testData) {
      alert('Geen test data gevonden. Ga eerst door de wizard.')
      return
    }

    setLoading(prev => ({ ...prev, [section]: true }))

    try {
      const res = await fetch('/api/generate-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section,
          data: testData,
          sessionId
        })
      })

      const result: ArticleGenerationResponse = await res.json()

      if (result.success && result.text) {
        setArticles(prev => ({
          ...prev,
          [section]: {
            section,
            text: result.text!,
            generatedAt: new Date().toISOString(),
            wordCount: result.wordCount || 0
          }
        }))
        
        if (result.remainingRequests !== undefined) {
          setUsageInfo({
            remaining: result.remainingRequests,
            cost: result.dailyCost || 0
          })
        }
      } else {
        alert(result.error || 'Er ging iets mis')
      }
    } catch (error) {
      console.error('Generate error:', error)
      alert('Fout bij genereren')
    } finally {
      setLoading(prev => ({ ...prev, [section]: false }))
    }
  }

  if (!testData) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-2xl font-bold mb-4">Geen data gevonden</h1>
          <p className="text-gray-600 mb-6">Ga eerst door de wizard om data op te halen.</p>
          <Link href="/wizard" className="text-blue-600 hover:underline">→ Naar wizard</Link>
        </div>
      </div>
    )
  }

  const sortedSections = Object.values(ARTICLE_SECTIONS).sort((a, b) => a.priority - b.priority)

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-pink-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link href="/test-results" className="text-blue-600 hover:underline">← Terug naar resultaten</Link>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">📝 AI Artikelen Genereren</h1>
              <p className="text-gray-600">Genereer en preview artikelen per sectie</p>
            </div>
            
            {/* Usage info */}
            <div className="bg-blue-50 rounded-lg p-4 text-sm">
              <div className="font-semibold text-blue-900">Vandaag gebruikt:</div>
              <div className="text-blue-700">{50 - usageInfo.remaining}/50 requests</div>
              <div className="text-blue-700">€{usageInfo.cost.toFixed(4)}</div>
            </div>
          </div>

          {/* Baby info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-sm">
            <strong className="text-gray-700">Baby:</strong> {testData.basisGegevens.volledigeNaam} 
            <span className="mx-2">|</span>
            <strong className="text-gray-700">Geboren:</strong> {testData.basisGegevens.geboorteDatum}
            <span className="mx-2">|</span>
            <strong className="text-gray-700">Plaats:</strong> {testData.basisGegevens.geboorteplaats}
          </div>

          {/* Secties grid */}
          <div className="space-y-4">
            {sortedSections.map(config => {
              const article = articles[config.id]
              const isLoading = loading[config.id]

              return (
                <div key={config.id} className="border border-gray-200 rounded-lg p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">{config.icon}</span>
                        <h2 className="text-xl font-semibold text-gray-900">{config.title}</h2>
                      </div>
                      <p className="text-sm text-gray-600">{config.description}</p>
                      <p className="text-xs text-gray-500 mt-1">Doel: ~{config.targetWordCount} woorden</p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      {!article && (
                        <button
                          onClick={() => generateArticle(config.id)}
                          disabled={isLoading}
                          className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                            isLoading 
                              ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                              : 'bg-blue-600 hover:bg-blue-700 text-white'
                          }`}
                        >
                          {isLoading ? 'Genereren...' : 'Genereer'}
                        </button>
                      )}
                      
                      {article && (
                        <>
                          <button
                            onClick={() => generateArticle(config.id)}
                            disabled={isLoading}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
                          >
                            ↻ Opnieuw
                          </button>
                          <button
                            onClick={() => setArticles(prev => ({ ...prev, [config.id]: null }))}
                            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-colors"
                          >
                            ✕ Verwijder
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Preview */}
                  {article && (
                    <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-blue-500">
                      <div className="flex justify-between items-center mb-3">
                        <div className="text-xs text-gray-500">
                          {article.wordCount} woorden • Gegenereerd {new Date(article.generatedAt).toLocaleTimeString('nl-NL')}
                        </div>
                      </div>
                      <div className="prose prose-sm max-w-none text-gray-800 whitespace-pre-wrap">
                        {article.text}
                      </div>
                    </div>
                  )}

                  {isLoading && (
                    <div className="bg-blue-50 rounded-lg p-4 text-center">
                      <div className="animate-pulse text-blue-600">⏳ AI is aan het schrijven...</div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Actions */}
          <div className="mt-8 pt-6 border-t flex gap-4">
            <Link href="/test-results" className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-semibold transition-colors">
              ← Terug naar resultaten
            </Link>
            <button
              onClick={() => {
                const count = Object.values(articles).filter(a => a !== null).length
                alert(`${count}/8 artikelen gegenereerd.\n\nVolgende stap: Prompts verbeteren op basis van deze resultaten.`)
              }}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
            >
              ✓ Klaar ({Object.values(articles).filter(a => a !== null).length}/8)
            </button>
          </div>
        </div>
      </div>
      <VersionFooter />
    </div>
  )
}