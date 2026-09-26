// lib/prompts.ts
// @version 1.0.0
// Alle AI-prompts voor de babykrant op één plek (alleen backend).
// De frontend stuurt uitsluitend data; prompts leven hier.
//
// - SYSTEM_PROMPT + buildPrompt(section, data): per-sectie generatie
//   (gebruikt door /api/generate-article, o.a. voor de "opnieuw"-knop)
// - buildFullPaperPrompt(data) + PAPER_SCHEMA: één gestructureerde call die
//   alle AI-secties in één keer genereert (/api/generate-paper)
// Nieuws en cultuur schrijft de redactie vooraf (lib/contentLibrary.ts).

import { getSterrenbeeld, getChineesJaar } from './calculations'
import { ARTICLE_SECTIONS, type ArticleSection } from './articleTypes'

// SYSTEM PROMPT - Algemeen voor alle secties
export const SYSTEM_PROMPT = `Je bent een professionele journalist die babykranten schrijft voor Nederlandse ouders.

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

// PROMPTS PER SECTIE
export function buildPrompt(section: string, data: any): string {
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


// =============================================================================
// Eén gestructureerde call voor de complete babykrant
// =============================================================================

/** Secties die de redactie vooraf schrijft; die gaan nooit naar het schrijfmodel. */
export const LIBRARY_SECTIONS = ['nieuws', 'cultuur'] as const satisfies readonly ArticleSection[]

/** Secties die per krant door het schrijfmodel worden geschreven. */
export const AI_SECTIONS = [
  'hoofdartikel',
  'sterrenbeeld',
  'weer',
  'naam_betekenis',
  'beroemde_namen',
  'geboren_op_dag',
] as const satisfies readonly ArticleSection[]
export type AiSection = typeof AI_SECTIONS[number]

/**
 * JSON-schema dat het model dwingt alle AI-secties als losse tekstvelden
 * terug te geven (strict structured output).
 */
export const PAPER_SCHEMA = {
  name: 'babykrant',
  schema: {
    type: 'object',
    properties: Object.fromEntries(
      AI_SECTIONS.map((section) => [
        section,
        {
          type: 'string',
          description: `${ARTICLE_SECTIONS[section].title} (~${ARTICLE_SECTIONS[section].targetWordCount} woorden)`,
        },
      ])
    ),
    required: [...AI_SECTIONS],
    additionalProperties: false,
  },
}

/**
 * Bouwt één user prompt die alle AI-secties beschrijft. Hergebruikt de
 * per-sectie prompts zodat beide generatiepaden dezelfde instructies delen.
 */
export function buildFullPaperPrompt(data: any): string {
  const naam = data?.basisGegevens?.volledigeNaam || 'de baby'

  const sectionBlocks = AI_SECTIONS.map((section) => {
    const sectionPrompt = buildPrompt(section, data)
      // De losse prompts eindigen op een schrijf-instructie; in de
      // gecombineerde call levert het JSON-veld de tekst per sectie.
      .replace(/\n?Schrijf de tekst:$/, '')
    return `=== SECTIE "${section}" ===\n${sectionPrompt}`
  }).join('\n\n')

  return `Schrijf de volgende secties van de babykrant voor ${naam} in één keer. Het nieuws en de cultuurpagina staan al klaar; die schrijf je niet.

Hieronder staan de instructies en brondata per sectie. Schrijf elke sectie volgens zijn eigen instructies (structuur, lengte, toon) en zorg voor een consistente toon over de hele krant, zonder dezelfde formuleringen of openingszinnen te herhalen tussen secties.

Lever het resultaat aan als JSON, met per sectie de volledige tekst (platte tekst, geen Markdown).

${sectionBlocks}`
}
