// app/generate-articles/page.tsx
// @version 1.1.0 - Developer Mode toegevoegd
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ARTICLE_SECTIONS, type ArticleSection, type GeneratedArticle, type ArticleGenerationResponse } from '@/lib/articleTypes'
import VersionFooter from '@/components/VersionFooter'
import { getSterrenbeeld, getChineesJaar } from '@/lib/calculations'

function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem('babykrant_session_id')
  if (!id) {
    id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    localStorage.setItem('babykrant_session_id', id)
  }
  return id
}

// System prompt - gekopieerd van backend route.ts voor developer mode
const SYSTEM_PROMPT = `Je bent een professionele journalist die babykranten schrijft voor Nederlandse ouders.

TONE-OF-VOICE REGELS:
- Warm maar niet overdreven sentimenteel
- Informatief zonder saai te zijn
- Persoonlijk maar professioneel
- Balans tussen positief en realistisch
- Concrete feiten, geen vage taal
- Nederlandse context en taalgebruik

REDACTIONEEL:
- Kies onderwerpen/personen die herkenbaar zijn voor Nederlands publiek
- Geef korte uitleg waar nodig (wie/wat is dit?) zodat iedereen het begrijpt
- Varieer in onderwerpen, toon en perspectief (niet steeds hetzelfde patroon)
- Gebruik culturele context bij keuzes (wat past bij Nederlandse lezers?)
- Schrijf vloeiende verhalen met logische overgangen tussen zinnen en alinea's

SCHRIJFSTIJL:
- Gebruik derde persoon tenzij anders gevraagd
- Wissel af tussen algemeen en specifiek
- Voeg nuances toe (niet alleen positief)
- Eindig met persoonlijke koppeling waar relevant
- Gebruik correcte Nederlandse spelling en grammatica
- Geen Markdown formatting (geen **, ##, etc.)
- Vermijd geforceerde overgangszinnen zoals "Op internationaal vlak", "In de sportwereld", "Politiek gezien"

VERBODEN:
- Overdreven lyrisch of poëtisch
- Te abstract of filosofisch
- Alleen maar superlatieven
- Amerikaanse "zo bijzonder!" taal
- Saaie opsommingen zonder context
- Te lang doordraven over 1 onderwerp

Je schrijft ALLEEN de gevraagde tekst, zonder preamble, uitleg of meta-commentaar.`

// Build prompt - gekopieerd van backend route.ts voor developer mode
function buildPrompt(section: string, data: any): string {
  const { basisGegevens, extraVragen } = data
  const naam = basisGegevens?.volledigeNaam || 'de baby'
  const roepnaam = naam.split(' ')[0]
  const datum = basisGegevens?.geboorteDatum || ''
  const plaats = basisGegevens?.geboorteplaats || ''

  switch(section) {

    case 'hoofdartikel':
      const tijd = basisGegevens?.geboorteTijd || '00:00'
      const gewicht = basisGegevens?.gewicht || 0
      const lengte = basisGegevens?.lengte || 0
      const ouder1 = basisGegevens?.ouder1Naam || 'de ouders'
      const ouder2 = basisGegevens?.ouder2Naam
      const alleenstaand = basisGegevens?.alleenstaand || false

      const locatie = extraVragen?.geboorteLocatie || 'ziekenhuis'
      const locatieNaam = extraVragen?.geboorteLocatieNaam || ''
      const bevalling = extraVragen?.bevallingVerloop || ''
      const broertjesZusjes = extraVragen?.broertjesZusjes || []
      const voornaamReden = extraVragen?.voornaamReden || ''
      const achternaamReden = extraVragen?.achternaamReden || ''

      const datumObj = new Date(datum)
      const dagNaam = datumObj.toLocaleDateString('nl-NL', { weekday: 'long' })
      const volledigeDatum = datumObj.toLocaleDateString('nl-NL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })

      return `Schrijf een hoofdartikel voor een babykrant over de geboorte van ${naam}.

FEITEN:
- Plaats: ${plaats}${locatieNaam ? ` (${locatieNaam})` : ''}
- Locatie type: ${locatie}
- Datum: ${dagNaam} ${volledigeDatum}
- Tijd: ${tijd} uur
- Ouders: ${alleenstaand ? ouder1 : `${ouder1} en ${ouder2}`}
- Gewicht: ${gewicht} gram
- Lengte: ${lengte} cm
${bevalling ? `- Bevalling: ${bevalling}` : ''}
${broertjesZusjes.length > 0 ? `- Broertjes/zusjes: ${broertjesZusjes.map((s: any) => `${s.naam} (${s.leeftijd || '?'} jaar)`).join(', ')}` : ''}
${voornaamReden ? `- Waarom voornaam: ${voornaamReden}` : ''}
${achternaamReden ? `- Waarom achternaam: ${achternaamReden}` : ''}

STRUCTUUR:
1. Opening in krantstijl: "${plaats.toUpperCase()} - Op ${dagNaam} ${volledigeDatum} werden [ouders] de trotse ouders van ${naam}..."
2. Beschrijf de bevalling en geboorte${bevalling ? ` (${bevalling})` : ''}
3. Eerste momenten (gewicht, lengte, eerste indrukken)
${broertjesZusjes.length > 0 ? '4. Reactie broertjes/zusjes' : ''}
${voornaamReden || achternaamReden ? `${broertjesZusjes.length > 0 ? '5' : '4'}. Verhaal achter de naam` : ''}
${broertjesZusjes.length > 0 || voornaamReden || achternaamReden ? `${5 + (broertjesZusjes.length > 0 ? 1 : 0) + ((voornaamReden || achternaamReden) ? 1 : 0)}. Afsluiting met toekomstblik` : '4. Afsluiting met toekomstblik'}

LENGTE: 200-250 woorden
TONE: Warm, persoonlijk, verhalend zoals in een nieuwsartikel

Schrijf de tekst:`

    case 'sterrenbeeld':
      const geboorteDatum = data.basisGegevens?.geboorteDatum
      const sterrenbeeld = data.berekend?.sterrenbeeld || (geboorteDatum ? getSterrenbeeld(geboorteDatum) : 'onbekend')
      const chineesJaar = data.berekend?.chineesJaar || (geboorteDatum ? getChineesJaar(geboorteDatum) : 'onbekend')

      if (sterrenbeeld === 'onbekend' || chineesJaar === 'onbekend') {
        return 'ERROR: Geboortedatum niet beschikbaar'
      }

      return `Schrijf een tekst over het sterrenbeeld en Chinese teken voor ${naam}.

GEGEVENS:
- Naam: ${roepnaam}
- Sterrenbeeld: ${sterrenbeeld}
- Chinees teken: ${chineesJaar}

STRUCTUUR:
1. Paragraaf 1: Algemene info sterrenbeeld (datums, element waar bekend)
2. Paragraaf 2-3: Karaktereigenschappen sterrenbeeld (balans positief + nuances)
3. Paragraaf 4: Chinees teken eigenschappen
4. Paragraaf 5: Koppeling aan ${roepnaam}

VOORBEELDEN STIJL:
"Mensen geboren tussen 21 april en 21 mei horen bij het sterrenbeeld Stier. De stier is het toonbeeld van doelgerichtheid en heeft een extreme belangstelling en sterke wilskracht. De stier is een liefde. Stabiel, evenwichtig, en graag bezig..."

LENGTE: 150-180 woorden
TONE: Informatief, beschrijvend, gebruik derde persoon ("De stier is...")

Schrijf de tekst:`

    case 'nieuws':
      const dailyNews = data.dailyNews?.events || []
      const waybackNews = data.waybackNews?.headlines || []
      const monthNews = data.monthlyNews?.items || []

      // Geen limiet meer - toon ALLE beschikbare headlines zodat AI een goede selectie kan maken
      const topDaily = dailyNews.map((e: any) => `[${e.category}] ${e.text}`).join('\n')
      const topWayback = waybackNews.map((h: any) => `${h.title}`).join('\n')
      const topMonth = monthNews.map((m: any) => `${m.day}: ${m.text}`).join('\n')

      const datumVolledig = new Date(datum).toLocaleDateString('nl-NL', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })

      // Check of het december is
      const isDecember = new Date(datum).getMonth() === 11

      return `Schrijf een nieuwsoverzicht (120-150 woorden) voor een babykrant over ${datumVolledig}.

STRUCTUUR:
1. Intro: "De geboorte van ${roepnaam} was het grootste nieuws op ${datumVolledig}, maar er gebeurde meer op deze dag."
2. Selecteer 4-5 nieuwsitems:
   - 2 politiek/economie (1 binnenland + 1 buitenland)
   - 1 cultuur/entertainment
   - 1 sport/wetenschap
   - Optioneel: 1 grappig/opmerkelijk nieuwtje

REDACTIONELE AANPAK:
- Herken patronen: Als onderwerp vaak terugkomt → inleidende zin + specifieke ontwikkeling
- Contextualiseer: Leg altijd uit wat dingen zijn (welke film? welk team? wat is het?)
- Interpreteer: Gebruik redactionele kennis om te bepalen wat in de krant hoort
- Balanceer: Mix zwaar nieuws (oorlog, ziekte) met luchtig (cultuur, sport, opmerkelijk)

SELECTIE:
- Prioriteer: Nederlandse headlines + grote internationale gebeurtenissen
- Terugkerend in meerdere bronnen = belangrijk (gebruik maandoverzicht voor context)
- STRIKTE LIMIETEN: MAX 1 sport, MAX 1 cultuur, MAX 2 politiek/economie (1 binnenland + 1 buitenland)
- Vermijd: saai bureaucratisch nieuws
- Zorg voor balans: binnenland én buitenland, zwaar én licht

${isDecember ? `
LET OP - DECEMBER DATA:
- Eind december bevatten bronnen vaak jaaroverzichten en terugblikken op het hele jaar
- Focus op de BOVENSTE 20-30 headlines (nieuws dat laag in de lijst staat is waarschijnlijk een terugblik)
- Herken terugblikken aan signaalwoorden: "het jaar", "jaaroverzicht", "terugblik", "de belangrijkste", gebeurtenissen van maanden geleden
- Skip overzichten en samenvattingen - kies alleen actuele ontwikkelingen van ${datumVolledig} zelf
` : ''}

HEADLINE KWALITEIT:
- Test begrijpelijkheid: Zou iemand over 2-3 jaar nog direct snappen waar dit over gaat?
- Te cryptisch of abstract? Skip het item en kies iets duidelijkers
- Geef altijd genoeg context: volledige namen, functie/rol, wat er precies gebeurde

VOETBAL WEDSTRIJDEN:
- Vaak staan er veel headlines over 1 wedstrijd (live updates tijdens de wedstrijd)
- Gebruik alleen de laatste 2-3 headlines met de definitieve uitslag
- Combineer NOOIT meerdere headlines over dezelfde wedstrijd - dit leidt tot fouten
- Noem alleen spelers die expliciet in de headline staan

SCHRIJFSTIJL:
- Begrijpelijk voor gemiddelde lezer, geef context waar nodig
- Sla categorie-introducties over ("Er waren spanningen..." i.p.v. "In de politiek waren er spanningen...")
- Begin direct met nieuws of gebruik natuurlijke overgangen
- Behandel tragedies respectvol (niet "nieuwtje", wel "incident")
- Zakelijk maar toegankelijk, korte beschrijvingen (1-2 zinnen per item)

BESCHIKBAAR NIEUWS:

Nederlands (NOS/NU.nl) - PRIORITEIT:
${topWayback || 'Geen data'}

Internationaal (Wikipedia):
${topDaily || 'Geen data'}

Maandcontext (alleen voor grote gebeurtenissen):
${topMonth || 'Geen data'}

Schrijf de tekst:`

    case 'weer':
      const weather = data.weather
      if (!weather) {
        return `Schrijf een kort weerbericht voor de geboortedag van ${roepnaam} op ${datum} in ${plaats}. Helaas is er geen data beschikbaar, schrijf een algemene tekst over het seizoen. LENGTE: 60-80 woorden.`
      }

      const datumWeer = new Date(weather.date).toLocaleDateString('nl-NL', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })

      return `Schrijf een weerbericht voor de babykrant.

GEGEVENS:
- Locatie: ${weather.city}
- Datum: ${datumWeer}
- Max temperatuur: ${weather.temperature_max}°C
- Min temperatuur: ${weather.temperature_min}°C
- Neerslag: ${weather.precipitation}mm
- Zonneschijn: ${weather.sunshine_duration} uur

STRUCTUUR:
1. Beschrijf het weer op de geboortedag
2. Context: normaal voor het seizoen?
3. Luchtige observatie ("perfect weer voor..." of "typisch Nederlands weer...")

LENGTE: 60-100 woorden
TONE: Beschrijvend, luchtig, toegankelijk

Schrijf de tekst:`

    case 'cultuur':
      const top40 = data.top40
      const yearChart = data.yearChart
      const tvPrograms = data.tvPrograms?.programs || []
      const wikipediaTV = data.wikipediaTV

      const nummer1 = top40?.numberOne ? `${top40.numberOne.artist} - ${top40.numberOne.title}` : null
      const topYear = yearChart?.entries?.slice(0, 5) || []
      const tvToday = tvPrograms.slice(0, 6).map((p: any) => `${p.title}${p.channel ? ` (${p.channel})` : ''}`).join('\n')
      const tvEvents = wikipediaTV?.events?.slice(0, 3) || []

      return `Schrijf een overzicht van muziek en televisie voor de babykrant.

MUZIEK:
${nummer1 ? `#1 Hit: ${nummer1}` : 'Geen Top 40 data'}
${topYear.length > 0 ? `\nTop hits van het jaar:\n${topYear.map((e: any) => `${e.position}. ${e.artist} - ${e.title}`).join('\n')}` : ''}

TELEVISIE:
${tvToday ? `Op TV die dag:\n${tvToday}` : 'Geen TV data'}
${tvEvents.length > 0 ? `\nTV momenten dat jaar:\n${tvEvents.map((e: any) => e.description).join('\n')}` : ''}

STRUCTUUR:
1. Start met #1 hit (prominent)
2. Noem 2-3 andere populaire hits
3. Highlight 3-4 TV programma's
4. Energieke, informatieve toon

LENGTE: 100-140 woorden
TONE: Energiek, enthousiast maar niet overdreven

Schrijf de tekst:`

    case 'naam_betekenis':
      const nameMeaning = data.nameMeaning
      if (!nameMeaning) {
        return `Schrijf over de betekenis van de naam ${naam}. Helaas is er geen data beschikbaar. Schrijf op basis van algemene kennis over Nederlandse namen. LENGTE: 120-150 woorden, educatief en interessant.`
      }

      return `Schrijf over de betekenis van de naam ${naam}.

GEGEVENS:
- Naam: ${naam}
- Betekenis: ${nameMeaning.meaning || 'onbekend'}
- Oorsprong: ${nameMeaning.origin || 'onbekend'}
- Gender: ${nameMeaning.gender || 'onbekend'}

STRUCTUUR:
1. Etymologie (oorsprong, betekenis)
2. Historische context of figuren met deze naam
3. Populariteit (indien bekend, anders algemeen)
4. Culturele referenties of varianten

VOORBEELDEN STIJL:
"Anne is meestal een meisjesnaam maar komt in Nederland ook als jongennaam voor. Anne als meisjessnaam is afgeleid van de Hebreeuwse naam Hanna wat 'lieflijke, genade, begunstigde' betekent..."

LENGTE: 120-180 woorden
TONE: Educatief, historisch, interessant maar toegankelijk

Schrijf de tekst:`

    case 'beroemde_namen':
      const famousNamesakes = data.famousNamesakes
      if (!famousNamesakes || !famousNamesakes.persons || famousNamesakes.persons.length === 0) {
        return `Schrijf over beroemde mensen die ${roepnaam} heten. Helaas is er geen data beschikbaar. Gebruik algemene kennis. LENGTE: 80-100 woorden, levendig en anekdotisch.`
      }

      const famousPersonsList = famousNamesakes.persons.slice(0, 6).map((p: any) =>
        `${p.name}: ${p.description}`
      ).join('\n')

      return `Schrijf over beroemde mensen die ${roepnaam} heten.

BEKENDE PERSONEN:
${famousPersonsList}

STRUCTUUR:
1. Intro: "Beroemde mensen met de naam ${roepnaam}..."
2. Beschrijf 4-6 personen kort (1 zin per persoon)
3. Mix: Nederlands + internationaal
4. Verschillende domeinen (politiek, kunst, sport, wetenschap)

LENGTE: 80-120 woorden
TONE: Levendig, anekdotisch, korte krachtige beschrijvingen

Schrijf de tekst:`

    case 'geboren_op_dag':
      const bornPersons = data.bornPersons || []
      const datumDag = new Date(datum).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })

      if (bornPersons.length === 0) {
        return `Schrijf over bekende mensen geboren op ${datumDag}. Helaas is er geen data beschikbaar. LENGTE: 80-100 woorden, feitelijk en educatief.`
      }

      const bornPersonsList = bornPersons.map((p: any) =>
        `${p.name} (${p.year}): ${p.description}`
      ).join('\n')

      return `Schrijf over bekende mensen geboren op ${datumDag}.

BESCHIKBARE PERSONEN (selecteer hieruit):
${bornPersonsList}

SELECTIECRITERIA - Kies 3-5 personen die:
- ALLEEN uit bovenstaande lijst komen (GEEN andere personen toevoegen)
- Mix bevatten: minimaal 1 historische figuur (voor 1950) + 1 recente bekende (na 1950)
- Mix bevatten: minimaal 1 Nederlandse + 1 internationale persoon
- "Grote namen" zijn: algemeen bekend OF zeer bekend in hun vakgebied
- Verschillende domeinen vertegenwoordigen (politiek, kunst, sport, wetenschap, etc.)
- Interessante verhalen/achievements hebben

STRUCTUUR:
1. Intro: "Ook geboren op ${datumDag}" (GEEN trivia-stijl zoals "wist je dat...")
2. Beschrijf elke persoon in 1-2 zinnen:
   - Naam (geboortejaar-sterfjaar indien van toepassing)
   - Beroep/bekendheid
   - Belangrijkste achievement of bekendheid
3. Volgorde: wissel af tussen NL/internationaal, oud/recent, verschillende domeinen

VOORBEELDEN STIJL:
"Ook geboren op 19 mei: Wouter Bos (1963), Nederlands politicus en voormalig minister van Financiën. Thomas Vinterberg (1969), Deens filmregisseur bekend van Festen en The Hunt. Malcolm X (1925-1965), Amerikaans mensenrechtenactivist en prominent figuur in de burgerrechtenbeweging."

TONE:
- Feitelijk en educatief (NIET trivia-achtig)
- Toegankelijk maar respectvol
- Korte, krachtige beschrijvingen
- Geen overdreven superlatieven

STRIKT VERBODEN:
- Personen toevoegen die NIET in de lijst staan
- Speculatie over waarom ze beroemd zijn
- Controversiële details (focus op achievements)

LENGTE: 80-120 woorden

Schrijf de tekst:`

    default:
      return `Schrijf een tekst voor sectie "${section}" van een babykrant voor ${naam}. LENGTE: 100-150 woorden.`
  }
}

export default function GenerateArticlesPage() {
  const [sessionId, setSessionId] = useState('')
  const [testData, setTestData] = useState<any>(null)
  const [devMode, setDevMode] = useState(false)
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
        <div className="mb-6 flex justify-between items-center">
          <Link href="/wizard" className="text-blue-600 hover:underline">← Terug naar wizard</Link>
          {devMode && (
            <Link href="/test-results" className="text-purple-600 hover:underline text-sm">
              🔧 Dev: Test Results →
            </Link>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">📝 AI Artikelen Genereren</h1>
              <p className="text-gray-600">Genereer en preview artikelen per sectie</p>
            </div>

            <div className="flex gap-4">
              {/* Developer mode toggle */}
              <button
                onClick={() => setDevMode(!devMode)}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors text-sm ${
                  devMode
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {devMode ? '🔧 Dev Mode: AAN' : '🔧 Dev Mode'}
              </button>

              {/* Usage info */}
              <div className="bg-blue-50 rounded-lg p-4 text-sm">
                <div className="font-semibold text-blue-900">Vandaag gebruikt:</div>
                <div className="text-blue-700">{50 - usageInfo.remaining}/50 requests</div>
                <div className="text-blue-700">€{usageInfo.cost.toFixed(4)}</div>
              </div>
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

          {/* Developer Mode: System Prompt */}
          {devMode && (
            <div className="bg-purple-50 rounded-lg p-6 mb-6 border-2 border-purple-200">
              <h3 className="text-lg font-semibold text-purple-900 mb-3">🔧 System Prompt (voor alle secties)</h3>
              <div className="text-xs text-purple-600 mb-2">
                Deze system prompt wordt bij ELKE API call meegegeven aan Claude 3.5 Haiku:
              </div>
              <pre className="text-xs bg-white p-4 rounded border border-purple-200 overflow-auto whitespace-pre-wrap font-mono text-gray-800">
                {SYSTEM_PROMPT}
              </pre>
            </div>
          )}

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

                  {/* Developer Mode: Show Prompt */}
                  {devMode && (
                    <details className="mb-4 cursor-pointer">
                      <summary className="font-medium text-purple-600 text-sm mb-2 hover:text-purple-700">
                        🔧 Toon actieve prompt (klik om te openen)
                      </summary>
                      <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                        <div className="text-xs text-purple-600 font-semibold mb-2">
                          Deze prompt wordt gestuurd naar Claude 3.5 Haiku:
                        </div>
                        <pre className="text-xs bg-white p-3 rounded border border-purple-200 overflow-auto max-h-96 whitespace-pre-wrap font-mono">
                          {buildPrompt(config.id, testData)}
                        </pre>
                      </div>
                    </details>
                  )}

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