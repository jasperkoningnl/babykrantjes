// app/test-results/page.tsx
// @version 3.0.0
// UPDATE v2.0.0: Toegevoegd Dutch News (Volkskrant headlines)
// UPDATE v2.1.0: Vervangen Volkskrant met Wayback Machine (NU.nl via Internet Archive)
// UPDATE v2.2.0: Wayback cache hit indicator toegevoegd
// UPDATE v2.3.0: Multi-source support - toon welke bronnen gebruikt zijn (NU.nl, NOS.nl)
// UPDATE v2.4.0: Wizard data structuur update - Ouder 1/2, gestructureerde ExtraVragen
// UPDATE v3.0.0: ExtraVragen uitbreiding - 10 vragen in 5 secties
'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import VersionFooter from '@/components/VersionFooter'
import { APP_VERSION } from '@/lib/version'
import type { BabykrantData } from '@/lib/types'
import { getSterrenbeeld, getChineesJaar, getGeboortebloem, getGeboortesteen, getKleur } from '@/lib/calculations'
import { getSterrenbeeldBeschrijving, getChineesTekenBeschrijving } from '@/lib/horoscoopData'
import { getHistoricalWeather, formatWeatherReport, type WeatherData } from '@/lib/weatherAPI'
import { getBornOnThisDay, type BornPerson } from '@/lib/bornOnThisDayAPI'
import { getNameMeaning, type NameMeaningData } from '@/lib/nameMeaningAPI'
import { getFamousNamesakes, type FamousNamesakesData } from '@/lib/famousNamesakesAPI'
import { getMoviesAroundDate, getTopMoviesOfYear, getSeriesOfYear, getPosterUrl, formatGenres, type TMDBMoviesResult } from '@/lib/tmdbAPI'
import { getTop40ByDate, type Top40Result } from '@/lib/top40API'
import { getYearOverview, type DutchChartsYearResult } from '@/lib/dutchChartsAPI'
import { getTVProgramsOnDate, filterInterestingPrograms, type TVOnDateResult } from '@/lib/tvOnDateAPI'
import { getWikipediaTVByYear, type WikipediaTVResult } from '@/lib/wikipediaTVAPI'
import { getDailyNews, getMonthlyNews, getWaybackNews, groupNewsByCategory, formatWaybackTimestamp, type DailyNewsResult, type MonthNewsResult, type WaybackNewsResult, type NewsEvent } from '@/lib/newsAPI'

export default function TestResultsPage() {
  const router = useRouter()
  const [data, setData] = useState<BabykrantData | null>(null)
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [bornPersons, setBornPersons] = useState<BornPerson[]>([])
  const [nameMeaning, setNameMeaning] = useState<NameMeaningData | null>(null)
  const [famousNamesakes, setFamousNamesakes] = useState<FamousNamesakesData | null>(null)
  const [movies, setMovies] = useState<TMDBMoviesResult | null>(null)
  const [topMovies, setTopMovies] = useState<TMDBMoviesResult | null>(null)
  const [series, setSeries] = useState<TMDBMoviesResult | null>(null)
  const [top40, setTop40] = useState<Top40Result | null>(null)
  const [yearChart, setYearChart] = useState<DutchChartsYearResult | null>(null)
  const [tvPrograms, setTvPrograms] = useState<TVOnDateResult | null>(null)
  const [wikipediaTV, setWikipediaTV] = useState<WikipediaTVResult | null>(null)
  const [dailyNews, setDailyNews] = useState<DailyNewsResult | null>(null)
  const [monthlyNews, setMonthlyNews] = useState<MonthNewsResult | null>(null)
  const [waybackNews, setWaybackNews] = useState<WaybackNewsResult | null>(null)

  const [loading, setLoading] = useState(true)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [bornLoading, setBornLoading] = useState(false)
  const [nameMeaningLoading, setNameMeaningLoading] = useState(false)
  const [namesakesLoading, setNamesakesLoading] = useState(false)
  const [moviesLoading, setMoviesLoading] = useState(false)
  const [seriesLoading, setSeriesLoading] = useState(false)
  const [top40Loading, setTop40Loading] = useState(false)
  const [yearChartLoading, setYearChartLoading] = useState(false)
  const [tvLoading, setTvLoading] = useState(false)
  const [wikipediaTVLoading, setWikipediaTVLoading] = useState(false)
  const [dailyNewsLoading, setDailyNewsLoading] = useState(false)
  const [monthlyNewsLoading, setMonthlyNewsLoading] = useState(false)
  const [waybackNewsLoading, setWaybackNewsLoading] = useState(false)

  useEffect(() => {
    console.log(`[Babykrant] test-results page ${APP_VERSION}`)
    
    const stored = localStorage.getItem('babykrant_test_data')
    if (stored) {
      const parsedData = JSON.parse(stored)
      setData(parsedData)
      
      const birthDate = parsedData.basisGegevens.geboorteDatum
      const birthYear = birthDate ? new Date(birthDate).getFullYear() : null
      
      if (birthDate && parsedData.basisGegevens.geboorteplaats) {
        setWeatherLoading(true)
        getHistoricalWeather(birthDate, parsedData.basisGegevens.geboorteplaats)
          .then(weatherData => {
            setWeather(weatherData)
            setWeatherLoading(false)
          })
      }
      
      if (birthDate) {
        setBornLoading(true)
        getBornOnThisDay(birthDate).then(persons => {
          setBornPersons(persons)
          setBornLoading(false)
        })
      }
      
      if (parsedData.basisGegevens.volledigeNaam) {
        setNameMeaningLoading(true)
        getNameMeaning(parsedData.basisGegevens.volledigeNaam).then(result => {
          setNameMeaning(result)
          setNameMeaningLoading(false)
        })
        
        setNamesakesLoading(true)
        getFamousNamesakes(parsedData.basisGegevens.volledigeNaam).then(result => {
          setFamousNamesakes(result)
          setNamesakesLoading(false)
        })
      }

      if (birthDate) {
        setMoviesLoading(true)
        getMoviesAroundDate(birthDate, 30).then(result => {
          setMovies(result)
          setMoviesLoading(false)
        })
      }

      if (birthYear) {
        getTopMoviesOfYear(birthYear, 5).then(result => {
          setTopMovies(result)
        })
      }
      
      if (birthDate) {
        setTop40Loading(true)
        getTop40ByDate(birthDate).then(result => {
          setTop40(result)
          setTop40Loading(false)
        })
      }
      
      if (birthYear) {
        setYearChartLoading(true)
        getYearOverview(birthYear, 10).then(result => {
          setYearChart(result)
          setYearChartLoading(false)
        })
      }
      
      if (birthDate) {
        setTvLoading(true)
        getTVProgramsOnDate(birthDate).then(result => {
          console.log(`[Babykrant] TV API response:`, result?.totalFound, 'programs, apiVersion:', result?.apiVersion)
          setTvPrograms(result)
          setTvLoading(false)
        })
      }
      
      if (birthYear) {
        setSeriesLoading(true)
        getSeriesOfYear(birthYear, 10).then(result => {
          console.log(`[Babykrant] Series API response:`, result?.movies?.length, 'series')
          setSeries(result)
          setSeriesLoading(false)
        })
      }
      
      if (birthYear) {
        setWikipediaTVLoading(true)
        getWikipediaTVByYear(birthYear).then(result => {
          console.log(`[Babykrant] Wikipedia TV response:`, result?.events?.length, 'events, apiVersion:', result?.apiVersion)
          setWikipediaTV(result)
          setWikipediaTVLoading(false)
        })
      }

      if (birthDate) {
        setDailyNewsLoading(true)
        getDailyNews(birthDate).then(result => {
          console.log(`[Babykrant] Daily news response:`, result?.totalEvents, 'events, apiVersion:', result?.apiVersion)
          setDailyNews(result)
          setDailyNewsLoading(false)
        })
      }

      if (birthDate) {
        setMonthlyNewsLoading(true)
        getMonthlyNews(birthDate).then(result => {
          console.log(`[Babykrant] Monthly news response:`, result?.totalItems, 'items, apiVersion:', result?.apiVersion)
          setMonthlyNews(result)
          setMonthlyNewsLoading(false)
        })
      }

      if (birthDate) {
        const birthDateObj = new Date(birthDate)
        const earliestDate = new Date('2005-01-01')
        if (birthDateObj >= earliestDate) {
          setWaybackNewsLoading(true)
          getWaybackNews(birthDate).then(result => {
            console.log(`[Babykrant] Wayback news response:`, result?.totalHeadlines, 'headlines, sources:', result?.sources, 'apiVersion:', result?.apiVersion)
            setWaybackNews(result)
            setWaybackNewsLoading(false)
          })
        }
      }
    }
    setLoading(false)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Laden...</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg mb-4">Geen data gevonden</p>
          <Link href="/wizard" className="text-blue-600">Terug naar wizard</Link>
        </div>
      </div>
    )
  }

  const sterrenbeeld = getSterrenbeeld(data.basisGegevens.geboorteDatum)
  const chineesJaar = getChineesJaar(data.basisGegevens.geboorteDatum)
  const birthYear = new Date(data.basisGegevens.geboorteDatum).getFullYear()

  const berekend = {
    sterrenbeeld,
    chineesJaar,
    geboortebloem: getGeboortebloem(data.basisGegevens.geboorteDatum),
    geboortesteen: getGeboortesteen(data.basisGegevens.geboorteDatum),
    kleur: getKleur(data.basisGegevens.geboorteDatum),
  }

  // Function to save all enriched data to localStorage
  const saveEnrichedData = () => {
    const enrichedData = {
      ...data,
      berekend,
      weather: weather || undefined,
      dailyNews: dailyNews || undefined,
      waybackNews: waybackNews || undefined,
      monthlyNews: monthlyNews || undefined,
      top40: top40 || undefined,
      yearChart: yearChart || undefined,
      tvPrograms: tvPrograms || undefined,
      wikipediaTV: wikipediaTV || undefined,
      nameMeaning: nameMeaning || undefined,
      famousNamesakes: famousNamesakes || undefined,
      bornPersons: bornPersons.length > 0 ? bornPersons : undefined,
      movies: movies || undefined,
      topMovies: topMovies || undefined,
      series: series || undefined,
    }

    localStorage.setItem('babykrant_test_data', JSON.stringify(enrichedData))
    console.log('[Babykrant v3.2] ✅ Enriched data saved to localStorage', Object.keys(enrichedData))
  }

  // Handler to save data and navigate to generate-articles
  const handleGenerateArticles = () => {
    saveEnrichedData()
    router.push('/generate-articles')
  }

  // Helper function to build prompts (same logic as backend)
  const buildPromptForSection = (section: string, enrichedData: any): string => {
    const { basisGegevens, extraVragen } = enrichedData
    const naam = basisGegevens?.volledigeNaam || 'de baby'
    const roepnaam = naam.split(' ')[0]
    const datum = basisGegevens?.geboorteDatum || ''
    const plaats = basisGegevens?.geboorteplaats || ''

    switch(section) {
      case 'hoofdartikel': {
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
      }

      case 'sterrenbeeld': {
        const sterrenbeeld = enrichedData.berekend?.sterrenbeeld || 'onbekend'
        const chineesJaar = enrichedData.berekend?.chineesJaar || 'onbekend'

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
      }

      case 'nieuws': {
        const dailyNews = enrichedData.dailyNews?.events || []
        const waybackNews = enrichedData.waybackNews?.headlines || []
        const monthNews = enrichedData.monthlyNews?.items || []

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
- Vermijd: saai bureaucratisch nieuws, 2 items uit dezelfde categorie
- Zorg voor balans: binnenland én buitenland, zwaar én licht

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
      }

      case 'weer': {
        const weather = enrichedData.weather
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
      }

      case 'cultuur': {
        const top40 = enrichedData.top40
        const yearChart = enrichedData.yearChart
        const tvPrograms = enrichedData.tvPrograms?.programs || []
        const wikipediaTV = enrichedData.wikipediaTV

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
      }

      case 'naam_betekenis': {
        const nameMeaning = enrichedData.nameMeaning
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
      }

      case 'beroemde_namen': {
        const famousNamesakes = enrichedData.famousNamesakes
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
      }

      case 'geboren_op_dag': {
        const bornPersons = enrichedData.bornPersons || []
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
      }

      default:
        return `Schrijf een tekst voor sectie "${section}" van een babykrant voor ${naam}. LENGTE: 100-150 woorden.`
    }
  }

  // Handler to export data for Workbench testing
  const handleExportForWorkbench = () => {
    const enrichedData = {
      ...data,
      berekend,
      weather: weather || undefined,
      dailyNews: dailyNews || undefined,
      waybackNews: waybackNews || undefined,
      monthlyNews: monthlyNews || undefined,
      top40: top40 || undefined,
      yearChart: yearChart || undefined,
      tvPrograms: tvPrograms || undefined,
      wikipediaTV: wikipediaTV || undefined,
      nameMeaning: nameMeaning || undefined,
      famousNamesakes: famousNamesakes || undefined,
      bornPersons: bornPersons.length > 0 ? bornPersons : undefined,
      movies: movies || undefined,
      topMovies: topMovies || undefined,
      series: series || undefined,
    }

    // Build all prompts with actual data
    const sections = ['hoofdartikel', 'sterrenbeeld', 'nieuws', 'weer', 'cultuur', 'naam_betekenis', 'beroemde_namen', 'geboren_op_dag']
    const builtPrompts: Record<string, { prompt: string, expectedLength: string }> = {}

    sections.forEach(section => {
      const prompt = buildPromptForSection(section, enrichedData)
      const lengthMap: Record<string, string> = {
        'hoofdartikel': '200-250 woorden',
        'sterrenbeeld': '150-180 woorden',
        'nieuws': '120-150 woorden',
        'weer': '60-100 woorden',
        'cultuur': '100-140 woorden',
        'naam_betekenis': '120-180 woorden',
        'beroemde_namen': '80-120 woorden',
        'geboren_op_dag': '80-120 woorden'
      }

      builtPrompts[section] = {
        prompt,
        expectedLength: lengthMap[section] || '100-150 woorden'
      }
    })

    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        appVersion: APP_VERSION,
        profileName: data.basisGegevens.volledigeNaam,
        purpose: 'Workbench prompt testing - READY TO USE prompts',
        instructions: 'Kopieer systemPrompt + een sectie prompt naar Workbench en test!'
      },
      systemPrompt: `Je bent een professionele journalist die babykranten schrijft voor Nederlandse ouders.

TONE-OF-VOICE REGELS:
- Warm maar niet overdreven sentimenteel
- Informatief zonder saai te zijn
- Persoonlijk maar professioneel
- Balans tussen positief en realistisch
- Concrete feiten, geen vage taal
- Nederlandse context en taalgebruik

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

Je schrijft ALLEEN de gevraagde tekst, zonder preamble, uitleg of meta-commentaar.`,
      prompts: builtPrompts,
      howToUse: {
        step1: 'Ga naar console.anthropic.com en log in',
        step2: 'Klik "Create New Prompt" of open een nieuwe chat',
        step3: 'Selecteer model: Claude 3.5 Haiku',
        step4: 'Kopieer de "systemPrompt" (hierboven) naar het "System" veld in Workbench',
        step5: 'Kies een sectie uit "prompts" (bijv. hoofdartikel)',
        step6: 'Kopieer de volledige "prompt" tekst naar het message veld',
        step7: 'Klik "Run" - klaar! De prompt is al compleet met alle data',
        step8: 'Pas de prompt aan, test opnieuw, itereer',
        step9: 'Deel je verbeterde prompts terug voor implementatie'
      },
      wizardDataReference: enrichedData
    }

    // Download as JSON file
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const filename = `babykrant-workbench-${data.basisGegevens.volledigeNaam.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.json`
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)

    console.log('[Babykrant] ✅ Workbench export downloaded:', filename)
  }

  const sterrenbeeldInfo = getSterrenbeeldBeschrijving(sterrenbeeld)
  const chineesTekenInfo = getChineesTekenBeschrijving(chineesJaar)
  const firstName = nameMeaning?.firstName || famousNamesakes?.firstName || '...'
  const groupedNewsMap = dailyNews?.events ? groupNewsByCategory(dailyNews.events) : new Map()
  const groupedNews: Record<string, NewsEvent[]> = Object.fromEntries(groupedNewsMap)

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-pink-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link href="/wizard" className="text-blue-600">← Terug naar wizard</Link>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">Testresultaten</h1>
            <p className="text-gray-600">Bekijk de berekende gegevens en opgehaalde informatie</p>
          </div>

          <div className="bg-blue-50 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">✅ Berekende Gegevens</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-600">Sterrenbeeld:</span>
                <p className="text-lg text-blue-700 font-semibold">{berekend.sterrenbeeld}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Chinees jaar:</span>
                <p className="text-lg text-blue-700 font-semibold">{berekend.chineesJaar}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Geboortebloem:</span>
                <p className="text-lg text-blue-700 font-semibold">{berekend.geboortebloem}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Geboortesteen:</span>
                <p className="text-lg text-blue-700 font-semibold">{berekend.geboortesteen}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Kleur:</span>
                <p className="text-lg text-blue-700 font-semibold">{berekend.kleur}</p>
              </div>
            </div>
          </div>

          {sterrenbeeldInfo && (
            <div className="bg-indigo-50 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">♈ Sterrenbeeld {sterrenbeeldInfo.naam}</h2>
              <div className="mb-3 text-sm text-indigo-600">
                <span className="font-medium">{sterrenbeeldInfo.datumStart} - {sterrenbeeldInfo.datumEind}</span>
                <span className="mx-2">|</span>
                <span>Element: {sterrenbeeldInfo.element}</span>
                <span className="mx-2">|</span>
                <span>Planeet: {sterrenbeeldInfo.planeet}</span>
              </div>
              <div className="text-gray-700 whitespace-pre-line leading-relaxed">
                {sterrenbeeldInfo.beschrijving}
              </div>
            </div>
          )}

          {chineesTekenInfo && (
            <div className="bg-red-50 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">🐉 Chinees teken: {chineesTekenInfo.naam}</h2>
              <div className="mb-3 text-sm text-red-600">
                <span className="font-medium">Jaren: </span>
                {chineesTekenInfo.jaren.join(', ')}
              </div>
              <div className="text-gray-700 whitespace-pre-line leading-relaxed">
                {chineesTekenInfo.beschrijving}
              </div>
              <p className="text-xs text-red-400 mt-3 italic">
                Let op: Chinese Nieuwjaar valt tussen 21 jan - 20 feb. Mensen geboren in jan/feb moeten checken welk jaar ze precies zijn.
              </p>
            </div>
          )}

          <div className="bg-sky-50 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">📰 Nieuws op de geboortedag (Internationaal)</h2>
            {dailyNewsLoading && <p className="text-gray-500 italic">Internationaal nieuws wordt opgehaald...</p>}
            {!dailyNewsLoading && dailyNews && dailyNews.events.length > 0 && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 mb-3">
                  Wat er gebeurde op {new Date(data.basisGegevens.geboorteDatum).toLocaleDateString('nl-NL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}:
                </p>
                {Object.entries(groupedNews).slice(0, 6).map(([category, events]) => (
                  <div key={category} className="bg-white p-3 rounded border border-sky-200">
                    <h4 className="font-medium text-sky-800 mb-2">{category}</h4>
                    <ul className="space-y-1">
                      {events.slice(0, 3).map((event, idx) => (
                        <li key={idx} className="text-sm text-gray-700 pl-3 border-l-2 border-sky-200">{event.text}</li>
                      ))}
                    </ul>
                  </div>
                ))}
                <p className="text-xs text-gray-500 mt-3">
                  <a href={dailyNews.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:underline">Bron: {dailyNews.source} →</a>
                  {' '}• {dailyNews.totalEvents} nieuwsberichten gevonden
                </p>
              </div>
            )}
            {!dailyNewsLoading && dailyNews?.error && <p className="text-amber-600 italic">{dailyNews.error}</p>}
            {!dailyNewsLoading && !dailyNews?.error && dailyNews?.events.length === 0 && <p className="text-gray-500 italic">Geen internationaal nieuws gevonden voor deze datum</p>}
          </div>

          <div className="bg-orange-50 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">🇳🇱 Nieuws & Context ({monthlyNews?.monthName} {monthlyNews?.year})</h2>
            {monthlyNewsLoading && <p className="text-gray-500 italic">Maandoverzicht wordt opgehaald...</p>}
            {!monthlyNewsLoading && monthlyNews && monthlyNews.items.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 mb-3">Wat er die maand gebeurde in Nederland en de wereld:</p>
                <div className="space-y-2">
                  {monthlyNews.items.slice(0, 10).map((item, idx) => (
                    <div key={idx} className="bg-white p-3 rounded border border-orange-200">
                      <span className="text-xs font-medium text-orange-600 mr-2">{item.day} {monthlyNews.monthName}:</span>
                      <span className="text-sm text-gray-700">{item.text}</span>
                    </div>
                  ))}
                </div>
                {monthlyNews.items.length > 10 && <p className="text-xs text-orange-600">+ {monthlyNews.items.length - 10} meer items...</p>}
                <p className="text-xs text-gray-500 mt-3">
                  <a href={monthlyNews.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline">Bron: {monthlyNews.source} →</a>
                  {' '}• {monthlyNews.totalItems} items gevonden
                </p>
              </div>
            )}
            {!monthlyNewsLoading && monthlyNews?.error && <p className="text-amber-600 italic">{monthlyNews.error}</p>}
            {!monthlyNewsLoading && !monthlyNews?.error && monthlyNews?.items.length === 0 && <p className="text-gray-500 italic">Geen maandoverzicht gevonden</p>}
          </div>

          <div className="bg-red-50 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">
              📰 Nederlandse Headlines
              {waybackNews?.cacheHit && <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-normal">⚡ Cached</span>}
            </h2>
            {waybackNewsLoading && <p className="text-gray-500 italic">Nederlandse headlines worden opgehaald...</p>}
            {!waybackNewsLoading && waybackNews && waybackNews.headlines.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 mb-3">
                  Nieuws op {new Date(waybackNews.date).toLocaleDateString('nl-NL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  {waybackNews.sources && waybackNews.sources.length > 0 && <span className="ml-2 text-xs font-medium text-red-600">({waybackNews.sources.join(', ')})</span>}:
                </p>
                <div className="space-y-2">
                  {waybackNews.headlines.slice(0, 10).map((headline, idx) => (
                    <div key={idx} className="bg-white p-3 rounded border border-red-200">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-1">
                          {headline.category && <span className="text-xs font-medium text-red-600">{headline.category}</span>}
                          {headline.source && <span className="text-xs text-gray-500 italic">via {headline.source}</span>}
                        </div>
                        {headline.url ? (
                          <a href={headline.url} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-900 hover:text-red-700 hover:underline">{headline.title}</a>
                        ) : (
                          <span className="text-sm text-gray-900">{headline.title}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {waybackNews.headlines.length > 10 && <p className="text-xs text-red-600">+ {waybackNews.headlines.length - 10} meer headlines...</p>}
                <p className="text-xs text-gray-500 mt-3">
                  <a href={waybackNews.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline">Bron: Internet Archive →</a>
                  {' '}• {waybackNews.totalHeadlines} headlines gevonden
                  {waybackNews.sources && waybackNews.sources.length > 0 && <span className="ml-2">• Bronnen: {waybackNews.sources.join(', ')}</span>}
                  {waybackNews.snapshotTimestamp && <span className="ml-2">• Snapshot: {formatWaybackTimestamp(waybackNews.snapshotTimestamp)}</span>}
                  {waybackNews.cacheHit && <span className="ml-2 text-green-600">• Cache hit ⚡</span>}
                </p>
              </div>
            )}
            {!waybackNewsLoading && waybackNews?.error && <p className="text-amber-600 italic">{waybackNews.error}</p>}
            {!waybackNewsLoading && !waybackNews?.error && waybackNews?.headlines.length === 0 && <p className="text-gray-500 italic">Geen Nederlandse headlines gevonden</p>}
            {!waybackNewsLoading && !waybackNews && <p className="text-gray-500 italic text-sm">Nederlandse headlines zijn beschikbaar vanaf 2005 (via Internet Archive)</p>}
          </div>

          <div className="bg-green-50 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">🎵 #1 Hit op geboortedatum</h2>
            {top40Loading && <p className="text-gray-500 italic">Hitlijst wordt opgehaald...</p>}
            {!top40Loading && top40?.numberOne && (
              <div className="space-y-3">
                <div className="bg-white p-4 rounded-lg border-2 border-green-300">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-bold text-green-600">#1</span>
                    <div>
                      <p className="text-xl font-semibold text-gray-900">{top40.numberOne.title}</p>
                      <p className="text-lg text-gray-600">{top40.numberOne.artist}</p>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-500">Top 40 week {top40.weekNumber}, {top40.year}</p>
                {top40.sourceUrl && <a href={top40.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-green-600 hover:underline">Bron: Top40.nl →</a>}
              </div>
            )}
            {!top40Loading && !top40?.numberOne && <p className="text-gray-500 italic">Geen hitlijst gevonden voor deze datum</p>}
          </div>

          <div className="bg-emerald-50 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">🎤 Populaire hits in {birthYear}</h2>
            {yearChartLoading && <p className="text-gray-500 italic">Jaaroverzicht wordt opgehaald...</p>}
            {!yearChartLoading && yearChart && yearChart.entries.length > 0 && (
              <div className="space-y-2">
                {yearChart.entries.slice(0, 5).map((entry, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-white p-2 rounded border">
                    <span className="text-lg font-bold text-emerald-600 w-8">{entry.position}.</span>
                    <div className="flex-1">
                      <span className="font-medium">{entry.artist}</span>
                      <span className="text-gray-500"> - </span>
                      <span className="text-gray-700">{entry.title}</span>
                    </div>
                  </div>
                ))}
                {yearChart.sourceUrl && <a href={yearChart.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-600 hover:underline block mt-2">Bron: DutchCharts.nl →</a>}
              </div>
            )}
            {!yearChartLoading && (!yearChart || yearChart.entries.length === 0) && <p className="text-gray-500 italic">Geen jaaroverzicht gevonden</p>}
          </div>

          <div className="bg-amber-50 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">🎬 Films in de bioscoop</h2>
            {moviesLoading && <p className="text-gray-500 italic">Films worden opgehaald...</p>}
            {!moviesLoading && movies && movies.movies.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 mb-3">Films in Nederland rond {new Date(data.basisGegevens.geboorteDatum).toLocaleDateString('nl-NL')}:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {movies.movies.slice(0, 6).map((movie) => (
                    <div key={movie.id} className="bg-white p-3 rounded border flex gap-3">
                      {movie.posterPath && <img src={getPosterUrl(movie.posterPath, 'w92') || ''} alt={movie.title} className="w-12 h-18 object-cover rounded" />}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{movie.title}</p>
                        <p className="text-xs text-gray-500">{formatGenres(movie.genreIds).slice(0, 2).join(', ')}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-yellow-500">★</span>
                          <span className="text-sm text-gray-600">{movie.voteAverage.toFixed(1)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">Bron: TMDB • Totaal {movies.totalResults} films gevonden</p>
              </div>
            )}
            {!moviesLoading && (!movies || movies.movies.length === 0) && <p className="text-gray-500 italic">Geen films gevonden voor deze periode</p>}
          </div>

          {topMovies && topMovies.movies.length > 0 && (
            <div className="bg-orange-50 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">🏆 Populairste films van {birthYear}</h2>
              <div className="space-y-2">
                {topMovies.movies.map((movie, idx) => (
                  <div key={movie.id} className="flex items-center gap-3 bg-white p-2 rounded border">
                    <span className="text-lg font-bold text-orange-600 w-8">{idx + 1}.</span>
                    <div className="flex-1">
                      <span className="font-medium">{movie.title}</span>
                      <span className="text-gray-500 text-sm ml-2">★ {movie.voteAverage.toFixed(1)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-indigo-50 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">📺 Populaire series in {birthYear}</h2>
            {seriesLoading && <p className="text-gray-500 italic">Series worden opgehaald...</p>}
            {!seriesLoading && series && series.movies.length > 0 && (
              <div className="space-y-2">
                {series.movies.map((show, idx) => (
                  <div key={show.id} className="flex items-center gap-3 bg-white p-2 rounded border">
                    <span className="text-lg font-bold text-indigo-600 w-8">{idx + 1}.</span>
                    {show.posterPath && <img src={getPosterUrl(show.posterPath, 'w92') || ''} alt={show.title} className="w-10 h-14 object-cover rounded" />}
                    <div className="flex-1">
                      <span className="font-medium">{show.title}</span>
                      <span className="text-gray-500 text-sm ml-2">★ {show.voteAverage.toFixed(1)}</span>
                    </div>
                  </div>
                ))}
                <p className="text-xs text-gray-500 mt-2">Bron: TMDB</p>
              </div>
            )}
            {!seriesLoading && (!series || series.movies.length === 0) && <p className="text-gray-500 italic">Geen series gevonden voor dit jaar</p>}
          </div>

          <div className="bg-violet-50 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">📺 Op TV op de geboortedag</h2>
            {tvLoading && <p className="text-gray-500 italic">TV programma's worden opgehaald...</p>}
            {!tvLoading && tvPrograms && tvPrograms.programs.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600 mb-3">Dit was er op TV op {new Date(data.basisGegevens.geboorteDatum).toLocaleDateString('nl-NL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filterInterestingPrograms(tvPrograms.programs).map((program, idx) => (
                    <div key={idx} className="bg-white p-3 rounded border border-violet-200">
                      <p className="font-semibold text-gray-900">{program.title}</p>
                      {program.episodeTitle && <p className="text-sm text-violet-700">{program.episodeTitle}</p>}
                      {(program.channel || program.broadcaster) && <p className="text-xs text-violet-500 mt-1">{program.channel || program.broadcaster}</p>}
                      {program.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{program.description}</p>}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  <a href={tvPrograms.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline">Bron: {tvPrograms.source} →</a>
                  {' '}• {filterInterestingPrograms(tvPrograms.programs).length} van {tvPrograms.totalFound} programma's getoond (gefilterd op interessante content)
                </p>
              </div>
            )}
            {!tvLoading && (!tvPrograms || tvPrograms.programs.length === 0) && <p className="text-gray-500 italic">Geen TV programma's gevonden voor deze datum</p>}
          </div>

          <div className="bg-slate-50 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">📖 TV Highlights {birthYear}</h2>
            {wikipediaTVLoading && <p className="text-gray-500 italic">Wikipedia data wordt opgehaald...</p>}
            {!wikipediaTVLoading && wikipediaTV && (
              <div className="space-y-4">
                {wikipediaTV.events.length > 0 && (
                  <div>
                    <h3 className="font-medium text-gray-700 mb-2">Belangrijke TV-momenten</h3>
                    <div className="space-y-2">
                      {wikipediaTV.events.map((event, idx) => (
                        <div key={idx} className="bg-white p-2 rounded border text-sm">
                          {event.date && <span className="font-medium text-slate-600">{event.date}: </span>}
                          <span className="text-gray-700">{event.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {wikipediaTV.runningShows.length > 0 && (
                  <div>
                    <h3 className="font-medium text-gray-700 mb-2">Populaire programma's in {birthYear}</h3>
                    <div className="flex flex-wrap gap-2">
                      {wikipediaTV.runningShows.slice(0, 15).map((show, idx) => (
                        <span key={idx} className="bg-white px-2 py-1 rounded border text-sm">
                          {show.title}
                          {show.years && <span className="text-gray-400 text-xs ml-1">({show.years})</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {wikipediaTV.debuts.length > 0 && (
                  <div>
                    <h3 className="font-medium text-gray-700 mb-2">Nieuwe programma's in {birthYear}</h3>
                    <div className="flex flex-wrap gap-2">
                      {wikipediaTV.debuts.map((show, idx) => (
                        <span key={idx} className="bg-green-100 px-2 py-1 rounded text-sm text-green-800">{show}</span>
                      ))}
                    </div>
                  </div>
                )}
                {wikipediaTV.endings.length > 0 && (
                  <div>
                    <h3 className="font-medium text-gray-700 mb-2">Gestopte programma's in {birthYear}</h3>
                    <div className="flex flex-wrap gap-2">
                      {wikipediaTV.endings.map((show, idx) => (
                        <span key={idx} className="bg-red-100 px-2 py-1 rounded text-sm text-red-800">{show}</span>
                      ))}
                    </div>
                  </div>
                )}
                {wikipediaTV.sourceUrl && (
                  <p className="text-xs text-gray-500 mt-2">
                    <a href={wikipediaTV.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:underline">Bron: Wikipedia →</a>
                  </p>
                )}
              </div>
            )}
            {!wikipediaTVLoading && (!wikipediaTV || (wikipediaTV.events.length === 0 && wikipediaTV.runningShows.length === 0)) && <p className="text-gray-500 italic">Geen Wikipedia TV data gevonden voor dit jaar</p>}
          </div>

          <div className="bg-purple-50 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">📛 Betekenis naam {firstName}</h2>
            {nameMeaningLoading && <p className="text-gray-500 italic">Naambetekenis wordt opgehaald...</p>}
            {!nameMeaningLoading && nameMeaning && (
              <div className="space-y-4">
                {nameMeaning.meaning ? (
                  <div>
                    <span className="font-medium text-gray-600">Betekenis:</span>
                    <p className="text-gray-900 mt-1">{nameMeaning.meaning}</p>
                  </div>
                ) : (
                  <p className="text-gray-500 italic">Geen betekenis gevonden</p>
                )}
                {nameMeaning.origin && (
                  <div>
                    <span className="font-medium text-gray-600">Oorsprong:</span>
                    <p className="text-gray-900 mt-1">{nameMeaning.origin}</p>
                  </div>
                )}
                {nameMeaning.gender && (
                  <div>
                    <span className="font-medium text-gray-600">Geslacht:</span>
                    <p className="text-gray-900 mt-1">{nameMeaning.gender}</p>
                  </div>
                )}
                <div className="text-xs text-gray-500 mt-3 pt-3 border-t border-purple-200">
                  <span className="font-medium">Bron: </span>
                  {nameMeaning.source ? (
                    <a href={nameMeaning.source} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">
                      {nameMeaning.source.includes('naamdokter') ? 'Naamdokter.nl' : nameMeaning.source.includes('betekenisnamen') ? 'Betekenisnamen.nl' : 'Bron'}
                    </a>
                  ) : (
                    <span>Geen bron gevonden</span>
                  )}
                </div>
              </div>
            )}
            {!nameMeaningLoading && !nameMeaning && <p className="text-red-500">Naambetekenis kon niet worden opgehaald</p>}
          </div>

          <div className="bg-pink-50 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">⭐ Bekende mensen die {firstName} heten</h2>
            {namesakesLoading && <p className="text-gray-500 italic">Bekende naamdragers worden opgehaald...</p>}
            {!namesakesLoading && famousNamesakes && famousNamesakes.persons.length > 0 && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3">
                  {famousNamesakes.persons.map((person, idx) => (
                    <div key={idx} className="bg-white p-3 rounded border border-pink-200">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          {person.wikipediaUrl ? (
                            <a href={person.wikipediaUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-pink-700 hover:underline">{person.name}</a>
                          ) : (
                            <span className="font-semibold text-gray-900">{person.name}</span>
                          )}
                          <span className="text-xs text-gray-400 ml-2">({person.source.toUpperCase()})</span>
                        </div>
                      </div>
                      {person.description && <p className="text-sm text-gray-600 mt-1">{person.description}</p>}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-3">Totaal {famousNamesakes.persons.length} bekende naamdragers gevonden</p>
                <div className="text-xs text-gray-500 pt-3 border-t border-pink-200">
                  <span className="font-medium">Bronnen: </span>
                  {famousNamesakes.sources.nl && <a href={famousNamesakes.sources.nl} target="_blank" rel="noopener noreferrer" className="text-pink-600 hover:underline mr-3">Wikipedia NL</a>}
                  {famousNamesakes.sources.en && <a href={famousNamesakes.sources.en} target="_blank" rel="noopener noreferrer" className="text-pink-600 hover:underline">Wikipedia EN</a>}
                </div>
              </div>
            )}
            {!namesakesLoading && famousNamesakes && famousNamesakes.persons.length === 0 && <p className="text-gray-500 italic">Geen bekende naamdragers gevonden</p>}
            {!namesakesLoading && !famousNamesakes && <p className="text-gray-500 italic">Kon geen gegevens ophalen</p>}
          </div>

          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">🌤️ Weerbericht</h2>
            {weatherLoading && <p className="text-gray-500 italic">Weerbericht wordt opgehaald...</p>}
            {!weatherLoading && weather && (
              <div className="space-y-3">
                <div>
                  <span className="font-medium text-gray-600">
                    Weer in {weather.city} op {new Date(weather.date).toLocaleDateString('nl-NL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}:
                  </span>
                  <p className="text-gray-900 mt-2">{formatWeatherReport(weather)}</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
                  <div className="bg-white p-3 rounded border">
                    <div className="text-gray-600 text-xs">Max temperatuur</div>
                    <div className="text-xl font-semibold text-blue-600">{weather.temperature_max}°C</div>
                  </div>
                  <div className="bg-white p-3 rounded border">
                    <div className="text-gray-600 text-xs">Min temperatuur</div>
                    <div className="text-xl font-semibold text-blue-600">{weather.temperature_min}°C</div>
                  </div>
                  <div className="bg-white p-3 rounded border">
                    <div className="text-gray-600 text-xs">Neerslag</div>
                    <div className="text-xl font-semibold text-blue-600">{weather.precipitation}mm</div>
                  </div>
                  <div className="bg-white p-3 rounded border">
                    <div className="text-gray-600 text-xs">Zonneschijn</div>
                    <div className="text-xl font-semibold text-blue-600">{weather.sunshine_duration}u</div>
                  </div>
                </div>
              </div>
            )}
            {!weatherLoading && !weather && <p className="text-red-500">Weerbericht kon niet worden opgehaald</p>}
          </div>

          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">🎂 Ook geboren op deze dag</h2>
            {bornLoading && <p className="text-gray-500 italic">Bekende personen worden opgehaald...</p>}
            {!bornLoading && bornPersons.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 mb-3">Ook geboren op {new Date(data.basisGegevens.geboorteDatum).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}:</p>
                <div className="grid grid-cols-1 gap-3">
                  {bornPersons.map((person, idx) => (
                    <div key={idx} className="bg-white p-3 rounded border">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-semibold text-gray-900">{person.name}</span>
                          <span className="text-gray-500 ml-2">({person.year})</span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{person.description}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-3">Totaal {bornPersons.length} bekende personen gevonden</p>
              </div>
            )}
            {!bornLoading && bornPersons.length === 0 && <p className="text-gray-500 italic">Geen bekende personen gevonden voor deze datum</p>}
          </div>

          <div className="bg-gray-50 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">📋 Ingevoerde Wizard Data (v3.0)</h2>
            
            <div className="mb-4">
              <h3 className="font-semibold text-gray-700 mb-2">👤 Basisgegevens</h3>
              <div className="bg-white p-3 rounded border text-sm space-y-1">
                <p><strong>Naam:</strong> {data.basisGegevens.volledigeNaam}</p>
                <p><strong>Datum:</strong> {data.basisGegevens.geboorteDatum} om {data.basisGegevens.geboorteTijd}</p>
                <p><strong>Plaats (stad):</strong> {data.basisGegevens.geboorteplaats}</p>
                <p><strong>Gewicht:</strong> {data.basisGegevens.gewicht} gram</p>
                <p><strong>Lengte:</strong> {data.basisGegevens.lengte} cm</p>
                <p><strong>Ouder 1:</strong> {data.basisGegevens.ouder1Naam || '-'}</p>
                <p><strong>Ouder 2:</strong> {data.basisGegevens.ouder2Naam || '-'}</p>
                <p><strong>Alleenstaand:</strong> {data.basisGegevens.alleenstaand ? 'Ja' : 'Nee'}</p>
              </div>
            </div>

            <div className="mb-4">
              <h3 className="font-semibold text-gray-700 mb-2">🏥 Sectie 1: Bevalling</h3>
              <div className="bg-white p-3 rounded border text-sm space-y-1">
                <p><strong>Locatie:</strong> {data.extraVragen.geboorteLocatie} {data.extraVragen.geboorteLocatieNaam && `(${data.extraVragen.geboorteLocatieNaam})`}</p>
                {data.extraVragen.bevallingVerloop && (
                  <>
                    <p><strong>Verloop:</strong> {data.extraVragen.bevallingVerloop}</p>
                    {data.extraVragen.bevallingAndersOmschrijving && <p><strong>Omschrijving:</strong> {data.extraVragen.bevallingAndersOmschrijving}</p>}
                  </>
                )}
                {data.extraVragen.wieWarenErbij && data.extraVragen.wieWarenErbij.length > 0 && <p><strong>Wie erbij:</strong> {data.extraVragen.wieWarenErbij.join(', ')}</p>}
              </div>
            </div>

            {data.extraVragen.zwangerschapVerloop && (
              <div className="mb-4">
                <h3 className="font-semibold text-gray-700 mb-2">🤰 Sectie 2: Zwangerschap</h3>
                <div className="bg-white p-3 rounded border text-sm">
                  <p>{data.extraVragen.zwangerschapVerloop}</p>
                </div>
              </div>
            )}

            {(data.extraVragen.voornaamReden || data.extraVragen.achternaamReden) && (
              <div className="mb-4">
                <h3 className="font-semibold text-gray-700 mb-2">💭 Sectie 3: Naamkeuze</h3>
                <div className="bg-white p-3 rounded border text-sm space-y-1">
                  {data.extraVragen.voornaamReden && <p><strong>Voornaam:</strong> {data.extraVragen.voornaamReden}</p>}
                  {data.extraVragen.achternaamReden && <p><strong>Achternaam:</strong> {data.extraVragen.achternaamReden}</p>}
                </div>
              </div>
            )}

            {(data.extraVragen.heeftBroertjesZusjes || data.extraVragen.eersteKraamvisite) && (
              <div className="mb-4">
                <h3 className="font-semibold text-gray-700 mb-2">👶 Sectie 4: Familie & Eerste Dagen</h3>
                <div className="bg-white p-3 rounded border text-sm space-y-2">
                  {data.extraVragen.heeftBroertjesZusjes && data.extraVragen.broertjesZusjes.length > 0 && (
                    <div>
                      <strong>Broertjes/Zusjes:</strong>
                      {data.extraVragen.broertjesZusjes.map((sibling: any, idx: number) => (
                        <div key={idx} className="ml-3">
                          • {sibling.naam}
                          {sibling.leeftijd && <span className="text-gray-600"> ({sibling.leeftijd} jaar)</span>}
                        </div>
                      ))}
                      {data.extraVragen.reactieBroertjesZusjes && <p className="ml-3 text-gray-600 italic">Reactie: {data.extraVragen.reactieBroertjesZusjes}</p>}
                    </div>
                  )}
                  {data.extraVragen.eersteKraamvisite && <p><strong>Eerste kraamvisite:</strong> {data.extraVragen.eersteKraamvisite}</p>}
                </div>
              </div>
            )}

            {data.extraVragen.bijzonderheden && (
              <div className="mb-4">
                <h3 className="font-semibold text-gray-700 mb-2">✨ Sectie 5: Bijzonderheden</h3>
                <div className="bg-white p-3 rounded border text-sm">
                  <p>{data.extraVragen.bijzonderheden}</p>
                </div>
              </div>
            )}
            
            <details className="cursor-pointer mt-4">
              <summary className="font-medium text-blue-600 mb-2">▶ Toon volledige JSON data</summary>
              <pre className="bg-white p-4 rounded border overflow-auto text-xs">{JSON.stringify(data, null, 2)}</pre>
            </details>
            
            <details className="cursor-pointer mt-4">
              <summary className="font-medium text-sky-600 mb-2">▶ Daily News ({dailyNews?.totalEvents || 0} events, apiVersion: {dailyNews?.apiVersion || '?'})</summary>
              <pre className="bg-white p-4 rounded border overflow-auto text-xs max-h-96">{JSON.stringify(dailyNews, null, 2)}</pre>
            </details>
            
            <details className="cursor-pointer mt-4">
              <summary className="font-medium text-orange-600 mb-2">▶ Monthly News ({monthlyNews?.totalItems || 0} items, apiVersion: {monthlyNews?.apiVersion || '?'})</summary>
              <pre className="bg-white p-4 rounded border overflow-auto text-xs max-h-96">{JSON.stringify(monthlyNews, null, 2)}</pre>
            </details>
            
            <details className="cursor-pointer mt-4">
              <summary className="font-medium text-red-600 mb-2">▶ Wayback News ({waybackNews?.totalHeadlines || 0} headlines, sources: {waybackNews?.sources?.join(', ') || '?'}, apiVersion: {waybackNews?.apiVersion || '?'})</summary>
              <pre className="bg-white p-4 rounded border overflow-auto text-xs max-h-96">{JSON.stringify(waybackNews, null, 2)}</pre>
            </details>
            
            <details className="cursor-pointer mt-4">
              <summary className="font-medium text-green-600 mb-2">▶ Top 40 ({top40?.topTen?.length || 0} entries)</summary>
              <pre className="bg-white p-4 rounded border overflow-auto text-xs max-h-96">{JSON.stringify(top40, null, 2)}</pre>
            </details>
            
            <details className="cursor-pointer mt-4">
              <summary className="font-medium text-green-600 mb-2">▶ Jaaroverzicht ({yearChart?.entries?.length || 0} entries)</summary>
              <pre className="bg-white p-4 rounded border overflow-auto text-xs max-h-96">{JSON.stringify(yearChart, null, 2)}</pre>
            </details>
            
            <details className="cursor-pointer mt-4">
              <summary className="font-medium text-green-600 mb-2">▶ Films ({movies?.movies?.length || 0} films)</summary>
              <pre className="bg-white p-4 rounded border overflow-auto text-xs max-h-96">{JSON.stringify(movies, null, 2)}</pre>
            </details>
            
            <details className="cursor-pointer mt-4">
              <summary className="font-medium text-green-600 mb-2">▶ Series ({series?.movies?.length || 0} series)</summary>
              <pre className="bg-white p-4 rounded border overflow-auto text-xs max-h-96">{JSON.stringify(series, null, 2)}</pre>
            </details>
            
            <details className="cursor-pointer mt-4">
              <summary className="font-medium text-green-600 mb-2">▶ TV Programma's ({tvPrograms?.totalFound || 0} totaal, {filterInterestingPrograms(tvPrograms?.programs || []).length} na filter, apiVersion: {tvPrograms?.apiVersion || '?'})</summary>
              <pre className="bg-white p-4 rounded border overflow-auto text-xs max-h-96">{JSON.stringify(tvPrograms, null, 2)}</pre>
            </details>
            
            <details className="cursor-pointer mt-4">
              <summary className="font-medium text-green-600 mb-2">▶ Wikipedia TV ({wikipediaTV?.events?.length || 0} events, {wikipediaTV?.runningShows?.length || 0} shows, apiVersion: {wikipediaTV?.apiVersion || '?'})</summary>
              <pre className="bg-white p-4 rounded border overflow-auto text-xs max-h-96">{JSON.stringify(wikipediaTV, null, 2)}</pre>
            </details>
          </div>

          <div className="mt-6 flex flex-wrap gap-4">
            <Link href="/wizard" className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold">Nieuwe babykrant maken</Link>
            <button
              onClick={handleGenerateArticles}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              💾 Opslaan & AI Artikelen Genereren ✨
            </button>
            <button
              onClick={handleExportForWorkbench}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              📥 Exporteer voor Workbench
            </button>
          </div>
          
          <div className="mt-8 pt-4 border-t border-gray-200 text-xs text-gray-400 text-right">
            test-results {APP_VERSION}
          </div>
        </div>
      </div>
      <VersionFooter />
    </div>
  )
}