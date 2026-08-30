'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ARTICLE_SECTIONS, type ArticleSection, type GeneratedArticle, type ArticleGenerationResponse } from '@/lib/articleTypes'

const ARTIKEL_TABS: { id: ArticleSection; label: string; titel: string }[] = [
  { id: 'hoofdartikel', label: 'Openingsartikel', titel: 'Openingsartikel — het geboorteverhaal' },
  { id: 'naam_betekenis', label: 'Naambetekenis', titel: 'De betekenis van de naam' },
  { id: 'beroemde_namen', label: 'Naamgenoten', titel: 'Beroemde naamgenoten' },
  { id: 'geboren_op_dag', label: 'Geboren op', titel: 'Ook geboren op deze dag' },
  { id: 'sterrenbeeld', label: 'Horoscoop', titel: 'Sterrenbeeld & Chinees teken' },
  { id: 'nieuws', label: 'Nieuws', titel: 'Het nieuws van die dag' },
  { id: 'weer', label: 'Weer', titel: 'Het weer' },
  { id: 'cultuur', label: 'Cultuur', titel: 'Muziek, films & series' },
]

const LIMIETEN: Record<string, number> = {
  hoofdartikel: 470, naam_betekenis: 260, beroemde_namen: 210,
  geboren_op_dag: 250, sterrenbeeld: 330, nieuws: 240, weer: 230, cultuur: 230,
}

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
  const router = useRouter()
  const [sessionId, setSessionId] = useState('')
  const [testData, setTestData] = useState<any>(null)
  const [paneel, setPaneel] = useState<'teksten' | 'fotos'>('teksten')
  const [actief, setActief] = useState<ArticleSection>('hoofdartikel')
  const [regens, setRegens] = useState(0)
  const [bewaard, setBewaard] = useState<string | null>(null)
  const [articles, setArticles] = useState<Record<ArticleSection, GeneratedArticle | null>>({
    hoofdartikel: null, sterrenbeeld: null, nieuws: null, weer: null,
    cultuur: null, naam_betekenis: null, beroemde_namen: null, geboren_op_dag: null,
  })
  const [loading, setLoading] = useState<Record<ArticleSection, boolean>>({
    hoofdartikel: false, sterrenbeeld: false, nieuws: false, weer: false,
    cultuur: false, naam_betekenis: false, beroemde_namen: false, geboren_op_dag: false,
  })
  const [generatingAll, setGeneratingAll] = useState(false)

  useEffect(() => {
    setSessionId(getSessionId())
    const stored = localStorage.getItem('babykrant_test_data')
    if (stored) setTestData(JSON.parse(stored))
  }, [])

  // Auto-save
  useEffect(() => {
    const timer = setTimeout(() => {
      const nu = new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
      setBewaard(nu)
    }, 700)
    return () => clearTimeout(timer)
  }, [articles])

  const generateArticle = async (section: ArticleSection) => {
    if (!testData) return
    setLoading(prev => ({ ...prev, [section]: true }))
    try {
      const res = await fetch('/api/generate-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section, data: testData, sessionId }),
      })
      const result: ArticleGenerationResponse = await res.json()
      if (result.success && result.text) {
        setArticles(prev => ({
          ...prev,
          [section]: { section, text: result.text!, generatedAt: new Date().toISOString(), wordCount: result.wordCount || 0 },
        }))
        setRegens(prev => prev + 1)
      }
    } catch (error) {
      console.error('Generate error:', error)
    } finally {
      setLoading(prev => ({ ...prev, [section]: false }))
    }
  }

  const generateAll = async () => {
    if (!testData) return
    setGeneratingAll(true)
    try {
      const res = await fetch('/api/generate-paper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: testData, paperId: testData.paperId ?? null, sessionId }),
      })
      const result = await res.json()
      if (result.success && result.articles) {
        const generatedAt = new Date().toISOString()
        setArticles(prev => {
          const next = { ...prev }
          for (const [section, text] of Object.entries(result.articles)) {
            next[section as ArticleSection] = {
              section: section as ArticleSection,
              text: String(text),
              generatedAt,
              wordCount: result.wordCounts?.[section] || 0,
            }
          }
          return next
        })
      }
    } catch (error) {
      console.error('Generate all error:', error)
    } finally {
      setGeneratingAll(false)
    }
  }

  const updateArticleText = (text: string) => {
    setArticles(prev => {
      const existing = prev[actief]
      return {
        ...prev,
        [actief]: existing
          ? { ...existing, text }
          : { section: actief, text, generatedAt: new Date().toISOString(), wordCount: 0 },
      }
    })
  }

  if (!testData) {
    return (
      <div className="min-h-screen bg-cream text-dark font-sans flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Geen data gevonden</h1>
          <p className="text-muted mb-6">Ga eerst door de wizard om data op te halen.</p>
          <Link href="/wizard" className="text-terracotta font-semibold">→ Naar wizard</Link>
        </div>
      </div>
    )
  }

  const actiefTab = ARTIKEL_TABS.find(t => t.id === actief) || ARTIKEL_TABS[0]
  const actieveTekst = articles[actief]?.text || ''
  const limiet = LIMIETEN[actief] || 400
  const teVeel = actieveTekst.length > limiet
  const gratis = Math.max(0, 5 - regens)

  return (
    <div className="min-h-screen bg-cream text-dark font-sans">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-cream/[.92] backdrop-blur-sm border-b border-dark/10">
        <div className="max-w-[1320px] mx-auto px-7 py-3.5 flex items-center justify-between gap-6">
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <div className="w-[30px] h-[30px] rounded-full bg-sage flex items-center justify-center text-cream font-extrabold text-[15px]">b</div>
            <div className="font-bold text-[19px] tracking-tight text-dark">babykrantje<span className="text-terracotta">.nl</span></div>
          </Link>
        </div>
      </div>

      <div className="max-w-[1320px] mx-auto px-7 py-7 grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-8 items-start">
        {/* Left: Newspaper preview */}
        <div>
          <div className="flex items-baseline justify-between mb-3.5">
            <h1 className="text-[32px] tracking-[-0.03em] font-extrabold">Je krant is klaar</h1>
            <div className="flex items-center gap-3.5 text-[13.5px] text-muted">
              <span>Voorbeeld met watermerk — de PDF is schoon</span>
              <span className="inline-flex items-center gap-1.5 bg-sage-light text-[#4A6B47] px-2.5 py-1 rounded-pill text-[13px]">
                {bewaard ? `✓ Bewaard om ${bewaard}` : '✓ Automatisch bewaard'}
              </span>
            </div>
          </div>

          {/* Newspaper placeholder / generate button */}
          <div className="w-full min-h-[600px] bg-white shadow-[0_30px_60px_-30px_rgba(35,35,31,.5)] flex flex-col items-center justify-center select-none relative">
            {generatingAll ? (
              <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-2 border-sage border-t-transparent rounded-full animate-spin" />
                <p className="text-muted font-serif italic">Artikelen worden geschreven...</p>
              </div>
            ) : Object.values(articles).some(a => a !== null) ? (
              <div className="p-8 w-full">
                <div className="text-center mb-6">
                  <h2 className="text-[28px] font-extrabold tracking-tight mb-1">De {testData.basisGegevens.volledigeNaam?.split(' ')[0]}krant</h2>
                  <p className="font-serif text-sm text-muted">{testData.basisGegevens.geboorteplaats} — {testData.basisGegevens.geboorteDatum}</p>
                </div>
                <div className="space-y-4 max-w-[600px] mx-auto">
                  {ARTIKEL_TABS.map(tab => {
                    const art = articles[tab.id]
                    if (!art) return null
                    return (
                      <div key={tab.id} className="border-b border-dark/[.08] pb-4 last:border-b-0">
                        <h3 className="font-bold text-sm mb-1">{tab.titel}</h3>
                        <p className="font-serif text-[14px] leading-relaxed text-subtle line-clamp-3">{art.text}</p>
                      </div>
                    )
                  })}
                </div>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-[80px] font-extrabold text-dark/[.06] rotate-[-30deg] select-none">WATERMERK</div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <p className="font-serif italic text-lg text-muted">Genereer eerst de artikelen</p>
                <button
                  onClick={generateAll}
                  className="bk-btn-primary"
                >
                  Genereer alle 8 artikelen
                </button>
              </div>
            )}
          </div>
          <div className="text-[13px] text-muted-light mt-2.5">
            Deze weergave is beveiligd: rechtsklikken en downloaden zijn uitgeschakeld.
          </div>
        </div>

        {/* Right: Side panel */}
        <div className="lg:sticky lg:top-[88px] flex flex-col gap-4">
          {/* Panel tabs */}
          <div className="flex gap-2">
            {(['teksten', 'fotos'] as const).map(tab => {
              const on = paneel === tab
              return (
                <button
                  key={tab}
                  onClick={() => setPaneel(tab)}
                  className="flex-1 border cursor-pointer text-[15px] font-semibold py-2.5 rounded-xl"
                  style={{
                    background: on ? '#23231F' : '#FFFDF9',
                    color: on ? '#FBF7F1' : '#23231F',
                    borderColor: on ? '#23231F' : 'rgba(35,35,31,.15)',
                  }}
                >
                  {tab === 'teksten' ? 'Teksten' : "Foto's"}
                </button>
              )
            })}
          </div>

          {/* Teksten panel */}
          {paneel === 'teksten' && (
            <>
              <div className="bg-cream-card border border-dark/[.12] rounded-card p-5">
                <div className="font-bold text-[17px] mb-1">Teksten aanpassen</div>
                <div className="font-serif text-[15px] text-subtle mb-3.5">
                  Kies een artikel. Zelf typen is gratis, opnieuw laten schrijven kost &euro; 0,50.
                </div>
                <div className="flex flex-wrap gap-[7px]">
                  {ARTIKEL_TABS.map(tab => {
                    const on = actief === tab.id
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActief(tab.id)}
                        className="bk-chip"
                        style={{
                          background: on ? '#23231F' : '#fff',
                          color: on ? '#FBF7F1' : '#23231F',
                          borderColor: on ? '#23231F' : 'rgba(35,35,31,.2)',
                        }}
                      >
                        {tab.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="bg-cream-card border border-dark/[.12] rounded-card p-5">
                <div className="font-bold text-[17px] mb-2.5">{actiefTab.titel}</div>
                <textarea
                  value={actieveTekst}
                  onChange={(e) => updateArticleText(e.target.value)}
                  rows={11}
                  className="bk-input font-serif text-[15px] leading-relaxed"
                  style={{ borderColor: teVeel ? '#B5563A' : 'rgba(35,35,31,.2)' }}
                />
                <div className="text-[13px] mt-[7px]" style={{ color: teVeel ? '#B5563A' : '#8A857B' }}>
                  {teVeel
                    ? `${actieveTekst.length - limiet} tekens te veel — dit valt buiten het kader`
                    : `${limiet - actieveTekst.length} tekens ruimte over in dit kader`
                  }
                </div>
                <div className="flex justify-between items-center mt-3 gap-2.5">
                  <button
                    onClick={() => generateArticle(actief)}
                    disabled={loading[actief]}
                    className="border border-dark/25 bg-white text-sm font-semibold px-4 py-2.5 rounded-pill"
                  >
                    {loading[actief] ? '⏳ Bezig...' : '↻ Opnieuw laten schrijven · € 0,50'}
                  </button>
                  <div className="text-[13px] text-muted-light text-right">
                    {gratis > 0 ? `${gratis} gratis herschrijvingen over` : 'Wordt bij je bestelling opgeteld'}
                  </div>
                </div>
                <div className="text-[13px] text-muted-light mt-2.5 border-t border-dark/[.08] pt-2.5">
                  Wijzigingen worden automatisch bewaard.
                </div>
              </div>
            </>
          )}

          {/* Foto's panel */}
          {paneel === 'fotos' && (
            <div className="bg-cream-card border border-dark/[.12] rounded-card p-5">
              <div className="font-bold text-[17px] mb-1">Foto&apos;s</div>
              <div className="font-serif text-[15px] text-subtle mb-4">
                Vier eigen foto&apos;s, plus de foto&apos;s bij het nieuws, de naamgenoot en de muziek.
                Die laatste drie mag je vervangen door iets eigens.
              </div>
              <div className="flex flex-col gap-3">
                {[
                  { naam: 'Hoofdfoto', hint: 'Groot, boven het openingsartikel' },
                  { naam: 'Foto 2', hint: 'Fotostrip onder het artikel' },
                  { naam: 'Foto 3', hint: 'Fotostrip onder het artikel' },
                  { naam: 'Foto 4', hint: 'Fotostrip onder het artikel' },
                  { naam: 'Foto bij het nieuws', hint: 'Wij kiezen er standaard een uit het archief' },
                  { naam: 'Foto van de naamgenoot', hint: 'Vervangbaar door een eigen foto' },
                  { naam: 'Foto bij muziek & films', hint: 'Artiest, albumhoes of filmposter' },
                ].map((sl, i) => (
                  <div key={i} className="flex gap-3 items-start pb-3 border-b border-dark/[.08] last:border-b-0">
                    <div className="w-16 h-12 flex-shrink-0 rounded-lg flex items-center justify-center text-[11px] text-muted bg-[#F5F1E9] border border-dashed border-dark/25 cursor-pointer">
                      +
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline gap-2">
                        <div className="font-semibold text-[14.5px]">{sl.naam}</div>
                        <button className="text-terracotta text-[13.5px] font-semibold bg-transparent border-none p-0 cursor-pointer">Foto kiezen</button>
                      </div>
                      <div className="text-[12.5px] text-muted-light">{sl.hint}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bestellen CTA */}
          <div className="bg-dark text-cream rounded-card p-5">
            <div className="font-bold text-[19px] mb-1.5">Tevreden?</div>
            <div className="font-serif text-[15.5px] leading-relaxed opacity-85 mb-4">
              Haal het watermerk weg en download de drukklare PDF, of laat hem printen en inlijsten.
            </div>
            <Link
              href="/checkout"
              className="block w-full bg-terracotta text-cream font-semibold text-base py-3.5 rounded-pill text-center no-underline"
            >
              Bestellen →
            </Link>
          </div>
          <button
            onClick={() => router.push('/wizard')}
            className="bg-transparent border-none text-sm text-muted cursor-pointer text-left p-0"
          >
            ← Gegevens aanpassen
          </button>
        </div>
      </div>
    </div>
  )
}
