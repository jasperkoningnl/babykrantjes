// app/api/generate-article/route.ts
// @version 2.1.0 - Claude Haiku 3.5 integratie met alle 8 secties + inline sterrenbeeld fallback

import { NextRequest, NextResponse } from 'next/server'
import type { ArticleGenerationRequest, ArticleGenerationResponse, UsageStats } from '@/lib/articleTypes'
import { USAGE_LIMITS, CLAUDE_PRICING } from '@/lib/articleTypes'
import { getSterrenbeeld, getChineesJaar } from '@/lib/calculations'

const dailyUsage = new Map<string, UsageStats>()

function isNewDay(lastDate: string): boolean {
  return new Date(lastDate).toDateString() !== new Date().toDateString()
}

function getUsageStats(sessionId: string): UsageStats {
  const existing = dailyUsage.get(sessionId)
  if (!existing || isNewDay(existing.lastRequestAt)) {
    const newStats: UsageStats = {
      requestsToday: 0,
      costToday: 0,
      lastRequestAt: new Date().toISOString()
    }
    dailyUsage.set(sessionId, newStats)
    return newStats
  }
  return existing
}

function updateUsageStats(sessionId: string, cost: number) {
  const stats = getUsageStats(sessionId)
  stats.requestsToday += 1
  stats.costToday += cost
  stats.lastRequestAt = new Date().toISOString()
  dailyUsage.set(sessionId, stats)
}

function calculateCost(inputTokens: number, outputTokens: number): number {
  return ((inputTokens / 1_000_000) * CLAUDE_PRICING.inputCostPer1MTokens) +
         ((outputTokens / 1_000_000) * CLAUDE_PRICING.outputCostPer1MTokens)
}

// SYSTEM PROMPT - Algemeen voor alle secties
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

VERBODEN:
- Overdreven lyrisch of poëtisch
- Te abstract of filosofisch
- Alleen maar superlatieven
- Amerikaanse "zo bijzonder!" taal
- Saaie opsommingen zonder context
- Te lang doordraven over 1 onderwerp

Je schrijft ALLEEN de gevraagde tekst, zonder preamble, uitleg of meta-commentaar.`

// PROMPTS PER SECTIE
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
      // Fallback: calculate inline if not available in enriched data
      const geboorteDatum = data.basisGegevens?.geboorteDatum
      const sterrenbeeld = data.berekend?.sterrenbeeld || (geboorteDatum ? getSterrenbeeld(geboorteDatum) : 'onbekend')
      const chineesJaar = data.berekend?.chineesJaar || (geboorteDatum ? getChineesJaar(geboorteDatum) : 'onbekend')

      // If still unknown, return error
      if (sterrenbeeld === 'onbekend' || chineesJaar === 'onbekend') {
        throw new Error('Geboortedatum niet beschikbaar - kan sterrenbeeld niet berekenen')
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

      return `Schrijf een nieuwsoverzicht (120-150 woorden) voor een babykrant over ${datumVolledig}.

STRUCTUUR:
1. Intro: "De geboorte van ${roepnaam} was het grootste nieuws op ${datumVolledig}, maar er gebeurde meer op deze dag."
2. Selecteer 3-5 nieuwsitems (Nederlands nieuws prioriteit)
3. Mix: 1-2 politiek/economie + 1 cultuur/entertainment + max 1 sport/wetenschap

REDACTIONELE AANPAK:
- Herken patronen: Als een onderwerp vaak terugkomt in verschillende bronnen → schrijf inleidende zin over dat onderwerp + specifieke ontwikkeling van die dag
- Snap culturele momenten: Prijsuitreikingen, schandalen, primeurs zijn interessant nieuws
- Contextualiseer: Leg altijd uit wat dingen zijn (welke film? welk team? welke prijs? wat is het?)
- Kies slim: Kies echte gebeurtenissen boven quotes/meningen. Feiten voor opinies.

SELECTIE:
- VERPLICHT: minimaal 1 cultuur/entertainment item (Oscar, BN'er, film, muziek)
- Prioriteer: Nederlandse headlines + grote internationale gebeurtenissen
- Als onderwerp meerdere bronnen → belangrijk, kies beste ontwikkeling van die dag
- Max 1 sportitem (tenzij écht groot nieuws zoals WK finale)
- Vermijd: administratief nieuws, coaches die praten, buitenlandse bureaucratie

SCHRIJFSTIJL:
- Begrijpelijk voor gemiddelde lezer, geef context waar nodig
- Logische overgangen, groepeer gerelateerde items
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

// CLAUDE API CALL
async function callClaude(prompt: string, systemPrompt: string): Promise<{ text: string, tokensUsed: { input: number, output: number } }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('API key missing')

  const response = await fetch(
    'https://api.anthropic.com/v1/messages',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: prompt
        }],
        temperature: 0.7
      })
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[Claude] API error response:', errorText)
    console.error('[Claude] Status:', response.status)
    console.error('[Claude] Headers:', Object.fromEntries(response.headers.entries()))
    throw new Error(`Claude API error: ${response.status} - ${errorText}`)
  }

  const result = await response.json()

  const text = result.content?.[0]?.text || ''
  const usage = result.usage || {}

  return {
    text,
    tokensUsed: {
      input: usage.input_tokens || 0,
      output: usage.output_tokens || 0
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: ArticleGenerationRequest = await request.json()
    const { section, data, sessionId } = body

    if (!section || !data || !sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Missende velden'
      } as ArticleGenerationResponse, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'API niet geconfigureerd'
      } as ArticleGenerationResponse, { status: 500 })
    }

    const usage = getUsageStats(sessionId)

    if (usage.requestsToday >= USAGE_LIMITS.maxRequestsPerDay) {
      return NextResponse.json({
        success: false,
        error: `Limiet bereikt (${USAGE_LIMITS.maxRequestsPerDay}/dag)`,
        remainingRequests: 0,
        dailyCost: usage.costToday
      } as ArticleGenerationResponse, { status: 429 })
    }

    if (usage.costToday >= USAGE_LIMITS.maxCostPerDay) {
      return NextResponse.json({
        success: false,
        error: `Budget limiet bereikt ($${USAGE_LIMITS.maxCostPerDay})`,
        remainingRequests: USAGE_LIMITS.maxRequestsPerDay - usage.requestsToday,
        dailyCost: usage.costToday
      } as ArticleGenerationResponse, { status: 429 })
    }

    console.log(`[API] Generating ${section} (session: ${sessionId})`)

    // Build prompt
    const userPrompt = buildPrompt(section, data)

    // Call Claude
    const claudeResult = await callClaude(userPrompt, SYSTEM_PROMPT)

    const totalTokens = claudeResult.tokensUsed.input + claudeResult.tokensUsed.output
    const cost = calculateCost(claudeResult.tokensUsed.input, claudeResult.tokensUsed.output)

    updateUsageStats(sessionId, cost)
    const updatedUsage = getUsageStats(sessionId)

    console.log(`[API] Success - ${totalTokens} tokens, $${cost.toFixed(4)}`)

    return NextResponse.json({
      success: true,
      section,
      text: claudeResult.text.trim(),
      wordCount: claudeResult.text.trim().split(/\s+/).length,
      tokensUsed: totalTokens,
      cost,
      remainingRequests: USAGE_LIMITS.maxRequestsPerDay - updatedUsage.requestsToday,
      dailyCost: updatedUsage.costToday
    } as ArticleGenerationResponse)

  } catch (error) {
    console.error('[API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Er ging iets mis'
    } as ArticleGenerationResponse, { status: 500 })
  }
}