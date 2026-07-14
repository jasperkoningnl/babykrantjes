// lib/prompts.ts
// @version 1.0.0
// Alle Claude-prompts voor de babykrant op één plek (alleen backend).
// De frontend stuurt uitsluitend data; prompts leven hier.
//
// - SYSTEM_PROMPT + buildPrompt(section, data): per-sectie generatie
//   (gebruikt door /api/generate-article, o.a. voor de "opnieuw"-knop)
// - buildFullPaperPrompt(data) + PAPER_TOOL: één gestructureerde call die
//   alle acht secties in één keer genereert (/api/generate-paper)

import { getSterrenbeeld, getChineesJaar } from './calculations'
import { matchDossiers, buildDossierPromptBlock } from './dossierMatcher'
import { ARTICLE_SECTIONS, type ArticleSection } from './articleTypes'

/** Het model voor alle artikelgeneratie. */
export const CLAUDE_MODEL = 'claude-haiku-4-5-20251001'

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

    case 'nieuws':
      const dailyNews = data.dailyNews?.events || []
      const waybackNews = data.waybackNews?.headlines || []
      const monthNews = data.monthlyNews?.items || []
      // Server-side verrijkt in POST (uit Supabase): Google News van de dag
      // en dossiers die op de geboortedatum actief waren.
      const googleNews = data.googleNews || []
      const activeDossiers = data.activeDossiers || []

      // Geen limiet meer - toon ALLE beschikbare headlines zodat AI een goede selectie kan maken
      const topDaily = dailyNews.map((e: any) => `[${e.category}] ${e.text}`).join('\n')
      const topWayback = waybackNews.map((h: any) => `${h.title}`).join('\n')
      const topMonth = monthNews.map((m: any) => `${m.day}: ${m.text}`).join('\n')
      const topGoogle = googleNews
        .map((g: any) => `[${g.topicCategory}] ${g.title}${g.sourceName ? ` (${g.sourceName})` : ''}`)
        .join('\n')

      // Dossiercontext, twee lagen:
      // 1. Gecureerde dossiers (data/dossiers.json) met achtergrondtekst,
      //    gematcht tegen de dagkoppen
      // 2. Gescrapete dossiers (news_dossiers via VRT/Al Jazeera) die op de
      //    geboortedatum actief waren
      const dagKoppen: string[] = [
        ...dailyNews.map((e: any) => String(e?.text ?? '')),
        ...waybackNews.map((h: any) => String(h?.title ?? '')),
        ...googleNews.map((g: any) => String(g?.title ?? '')),
      ]
      const curatedMatches = matchDossiers(dagKoppen, datum)
      const dossierBlok = buildDossierPromptBlock(curatedMatches)

      const scrapedDossierLijst = activeDossiers
        .slice(0, 15)
        .map((d: any) => `- ${d.name}${d.category ? ` (${d.category})` : ''}`)
        .join('\n')

      const datumVolledig = new Date(datum).toLocaleDateString('nl-NL', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })

      // Check of het december is
      const isDecember = new Date(datum).getMonth() === 11

      return `Schrijf een nieuwsoverzicht (150-200 woorden totaal) voor een babykrant over ${datumVolledig}, gebaseerd op het beschikbare nieuws hieronder.

OUTPUT: precies twee blokken, elk met dit kopje op een eigen regel:

Het nieuws van de dag
[80-120 woorden over specifieke gebeurtenissen van ${datumVolledig} zelf]

Dit speelde er in de wereld
[50-80 woorden over de 2-3 grootste lopende nieuwsdossiers die op deze datum actief waren]

FEITELIJKE BASIS — STRIKT:
- Gebruik UITSLUITEND gebeurtenissen en dossiers die in de bronnen hieronder staan
- Verzin NOOIT feiten, namen, aantallen of gebeurtenissen die niet in de input staan
- Te weinig bronmateriaal voor een blok? Houd dat blok korter in plaats van aan te vullen met eigen kennis

BLOK 1 — Het nieuws van de dag:
1. Intro: "De geboorte van ${roepnaam} was het grootste nieuws op ${datumVolledig}, maar er gebeurde meer op deze dag." Of een variatie hierop.
2. Selecteer 3-5 nieuwsitems van de dag zelf:
   - Bij voorkeur mix van: politiek/economie, cultuur/entertainment, sport/wetenschap
   - Binnenland én buitenland waar mogelijk
   - Prioriteer: Nederlandse headlines + grote internationale gebeurtenissen
   - Terugkerend in meerdere bronnen = belangrijk (gebruik maandoverzicht voor context)
   - Balanceer: mix zwaar nieuws (oorlog, ziekte) met luchtig (cultuur, sport, opmerkelijk)
   - Vermijd: saai bureaucratisch nieuws

BLOK 2 — Dit speelde er in de wereld:
- Kies de 2-3 grootste lopende dossiers uit de dossier-bronnen hieronder
- Beschrijf per dossier in 1-2 zinnen wat er speelde (alleen op basis van de meegegeven achtergrond en koppen)
- Dit blok gaat over de bredere periode, niet alleen deze ene dag
- Geen dossier-bronnen beschikbaar? Laat dit blok dan weg (schrijf alleen blok 1, inclusief het kopje weglaten)

REDACTIONELE AANPAK:
- Contextualiseer: leg altijd uit wat dingen zijn (welke film? welk team? wat is het?)
- Test begrijpelijkheid: zou iemand over 2-3 jaar nog direct snappen waar dit over gaat?
- Te cryptisch of abstract? Skip het item en kies iets duidelijkers

${isDecember ? `SPECIFIEK VOOR DAGEN IN DECEMBER:
- Deze dagen kunnen terugblikken en jaaroverzicht bevatten
- Selecteer actueel nieuws van de geboortedag
- Denk kritisch na: is dit nieuws van de geboortedag of een terugblik op eerder in het jaar?

` : ''}${dossierBlok}SCHRIJFSTIJL:
- Begrijpelijk voor gemiddelde lezer, geef context waar nodig
- Geen categorie-introducties. Schrijf direct over het nieuws zelf.
- Behandel tragedies respectvol (niet "nieuwtje", wel "incident")
- Zakelijk maar toegankelijk, korte beschrijvingen (1-2 zinnen per item)
- Geen andere kopjes of opmaak dan de twee genoemde kopjes

BESCHIKBAAR NIEUWS VAN DE DAG:

Nederlands (NOS/NU.nl) - PRIORITEIT:
${topWayback || 'Geen data'}

Google News NL:
${topGoogle || 'Geen data'}

Internationaal (Wikipedia):
${topDaily || 'Geen data'}

Maandcontext (alleen voor grote gebeurtenissen):
${topMonth || 'Geen data'}

LOPENDE DOSSIERS ACTIEF OP DEZE DATUM (bron: VRT NWS / Al Jazeera):
${scrapedDossierLijst || 'Geen data'}

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
      const movies = data.movies?.movies || []
      const topMovies = data.topMovies?.movies || []
      const series = data.series?.movies || []

      const nummer1 = top40?.numberOne ? `${top40.numberOne.artist} - ${top40.numberOne.title}` : null
      const topYear = yearChart?.entries?.slice(0, 5) || []
      // Alle prime time programma's (al gefilterd door API op 20:00-22:00 + belangrijkste zenders)
      const tvToday = tvPrograms.map((p: any) => `${p.title}${p.channel ? ` (${p.channel})` : ''}`).join('\n')
      const tvEvents = wikipediaTV?.events?.slice(0, 3) || []

      // Format films rond geboortedatum
      const moviesAround = movies.slice(0, 8).map((m: any) =>
        `${m.title} (${m.releaseDate?.split('-')[0] || '?'})`
      ).join('\n')

      // Format top films van het jaar
      const topMoviesYear = topMovies.slice(0, 5).map((m: any) =>
        `${m.title} (${m.voteAverage?.toFixed(1) || '?'}/10)`
      ).join('\n')

      // Format populaire series
      const popularSeries = series.slice(0, 5).map((s: any) =>
        `${s.title || s.name}`
      ).join('\n')

      return `Schrijf een overzicht van muziek, film en televisie voor de babykrant (100-140 woorden).

STRUCTUUR:
1. Open met de #1 hit (als beschikbaar)
2. Noem andere populaire muzikanten/hits van dat moment
3. Bespreek grote filmreleases in de bioscoop (blockbusters, bekende films)
4. Noem andere populaire films en series rond die periode
5. Sluit af met TV programma's op de geboortedag
6. Vul aan met TV hoogtepunten uit dat jaar (als beschikbaar)

SCHRIJFSTIJL:
- Vlot en journalistiek
- Direct en feitelijk
- Geen overbodige intro- of slotzinnen
- Geen interpretatie of waardeoordelen
- Korte, pakkende beschrijvingen

BESCHIKBARE DATA:

MUZIEK:
${nummer1 ? `#1 Hit: ${nummer1}` : 'Geen Top 40 data'}
${topYear.length > 0 ? `\nTop hits van het jaar:\n${topYear.map((e: any) => `${e.position}. ${e.artist} - ${e.title}`).join('\n')}` : ''}

FILMS IN DE BIOSCOOP (rond geboorteperiode):
${moviesAround || 'Geen filmdata'}

TOP FILMS VAN HET JAAR:
${topMoviesYear || 'Geen filmdata'}

POPULAIRE SERIES:
${popularSeries || 'Geen seriedata'}

TELEVISIE:
${tvToday ? `Op TV die dag:\n${tvToday}` : 'Geen TV data'}
${tvEvents.length > 0 ? `\nTV hoogtepunten dat jaar:\n${tvEvents.map((e: any) => e.description).join('\n')}` : ''}

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

const SECTION_ORDER: ArticleSection[] = [
  'hoofdartikel',
  'sterrenbeeld',
  'nieuws',
  'weer',
  'cultuur',
  'naam_betekenis',
  'beroemde_namen',
  'geboren_op_dag',
]

/**
 * Tool-definitie die Claude dwingt alle acht secties als JSON terug te
 * geven (structured output via forced tool use).
 */
export const PAPER_TOOL = {
  name: 'lever_babykrant',
  description: 'Lever alle acht artikelen van de babykrant aan als losse tekstvelden.',
  input_schema: {
    type: 'object' as const,
    properties: Object.fromEntries(
      SECTION_ORDER.map((section) => [
        section,
        {
          type: 'string',
          description: `${ARTICLE_SECTIONS[section].title} (~${ARTICLE_SECTIONS[section].targetWordCount} woorden)`,
        },
      ])
    ),
    required: SECTION_ORDER,
  },
}

/**
 * Bouwt één user prompt die alle acht secties beschrijft. Hergebruikt de
 * per-sectie prompts zodat beide generatiepaden dezelfde instructies delen.
 */
export function buildFullPaperPrompt(data: any): string {
  const naam = data?.basisGegevens?.volledigeNaam || 'de baby'

  const sectionBlocks = SECTION_ORDER.map((section) => {
    const sectionPrompt = buildPrompt(section, data)
      // De losse prompts eindigen op een schrijf-instructie; in de
      // gecombineerde call levert de tool-call de tekst per veld.
      .replace(/\n?Schrijf de tekst:$/, '')
    return `=== SECTIE "${section}" ===\n${sectionPrompt}`
  }).join('\n\n')

  return `Schrijf de complete babykrant voor ${naam}: alle acht secties in één keer.

Hieronder staan de instructies en brondata per sectie. Schrijf elke sectie volgens zijn eigen instructies (structuur, lengte, toon) en zorg voor een consistente toon over de hele krant, zonder dezelfde formuleringen of openingszinnen te herhalen tussen secties.

Lever het resultaat aan via de tool "lever_babykrant", met per sectie de volledige tekst (platte tekst, geen Markdown).

${sectionBlocks}`
}
