// lib/horoscoopData.ts
// @version 1.0.0
// Beschrijvingen voor sterrenbeelden en Chinese dierenriem
// 
// Bronnen:
// - Wikipedia NL (sterrenbeelden en Chinese dierenriem artikelen)
// - Elle.com/nl, Cosmopolitan.com/nl horoscoop secties
// - Mediumchat.nl, Mediumkiezen.nl
//
// Let op: Chinese Nieuwjaar valt tussen 21 jan - 20 feb
// Mensen geboren in jan/feb moeten checken welk jaar ze zijn!

export interface SterrenbeeldInfo {
  naam: string
  datumStart: string  // "21 maart" format voor display
  datumEind: string
  element: string
  planeet: string
  beschrijving: string
}

export interface ChineesTekenInfo {
  naam: string
  jaren: number[]
  beschrijving: string
}

// =============================================================================
// STERRENBEELDEN
// =============================================================================

export const STERRENBEELDEN: Record<string, SterrenbeeldInfo> = {
  'Ram': {
    naam: 'Ram',
    datumStart: '21 maart',
    datumEind: '19 april',
    element: 'Vuur',
    planeet: 'Mars',
    beschrijving: `Mensen geboren onder het sterrenbeeld Ram zijn geboren leiders. Ze zijn energiek, moedig en vol zelfvertrouwen. Een Ram gaat uitdagingen niet uit de weg, maar zoekt ze juist op. Met hun aanstekelijke enthousiasme weten ze anderen te motiveren en mee te slepen in hun avonturen.

De Ram is eerlijk en direct, soms tot op het bot. Ze zeggen waar het op staat en hebben weinig geduld voor omwegen of smoesjes. Deze directheid kan soms bot overkomen, maar een Ram meent het nooit verkeerd. Hun impulsiviteit zorgt ervoor dat ze snel handelen, al is dat niet altijd even doordacht.

Rammen zijn competitief van aard en houden van winnen. Ze zijn pioniers die graag als eerste iets nieuws ontdekken of bereiken. Geduld is niet hun sterkste kant - een Ram wil resultaten zien, en wel nu. Ondanks hun soms koppige karakter zijn het trouwe vrienden die door dik en dun voor je klaarstaan.`
  },

  'Stier': {
    naam: 'Stier',
    datumStart: '20 april',
    datumEind: '20 mei',
    element: 'Aarde',
    planeet: 'Venus',
    beschrijving: `De Stier staat bekend als betrouwbaar, geduldig en praktisch. Mensen met dit sterrenbeeld hebben beide benen stevig op de grond en zijn niet snel van hun stuk te brengen. Ze waarderen stabiliteit, comfort en de mooie dingen des levens.

Een Stier is vastberaden en volhardend. Als ze eenmaal ergens voor gaan, laten ze niet los tot het doel bereikt is. Deze vasthoudendheid kan soms overgaan in koppigheid - een Stier van gedachten laten veranderen is geen sinecure. Maar deze eigenschap maakt hen ook uiterst betrouwbaar en consistent.

Stieren hebben een sterk ontwikkeld gevoel voor schoonheid en kwaliteit. Ze houden van lekker eten, mooie muziek en een comfortabel thuis. Financiële zekerheid is belangrijk voor hen. In relaties zijn ze loyaal, liefdevol en beschermend. Een Stier als vriend betekent een vriend voor het leven.`
  },

  'Tweelingen': {
    naam: 'Tweelingen',
    datumStart: '21 mei',
    datumEind: '20 juni',
    element: 'Lucht',
    planeet: 'Mercurius',
    beschrijving: `Tweelingen zijn de communicatoren van de dierenriem. Ze zijn nieuwsgierig, veelzijdig en altijd in voor een goed gesprek. Hun levendige geest springt moeiteloos van het ene onderwerp naar het andere, wat hen tot boeiende gesprekspartners maakt.

Het belangrijkste kenmerk van Tweelingen is hun beweeglijkheid. Tweelingen zijn rusteloos, snel van begrip en hebben veel afwisseling nodig. Kennis is belangrijk voor hen - ze willen overal van op de hoogte zijn. Ze hebben literaire talenten, zijn subtiel en handig.

Tweelingen zijn sociaal, geestig en kunnen zich goed aanpassen aan verschillende situaties. De keerzijde is dat ze soms oppervlakkig over kunnen komen of moeite hebben met focus. Hun dualiteit zorgt ervoor dat ze meerdere kanten van een zaak kunnen zien, maar ook besluiteloos kunnen zijn.`
  },

  'Kreeft': {
    naam: 'Kreeft',
    datumStart: '21 juni',
    datumEind: '22 juli',
    element: 'Water',
    planeet: 'Maan',
    beschrijving: `De Kreeft is het meest zorgzame en beschermende teken van de dierenriem. Familie en thuis staan centraal in hun leven. Ze hebben een rijk gevoelsleven en een sterk ontwikkelde intuïtie waarmee ze de emoties van anderen feilloos aanvoelen.

Kreeften zijn loyaal en toegewijd aan hun dierbaren. Ze creëren graag een warm en veilig nest waar iedereen welkom is. Hun zorgzaamheid uit zich in het verzorgen en voeden van anderen - zowel letterlijk als figuurlijk. Een Kreeft onthoudt verjaardagen en is er altijd als je hem nodig hebt.

Achter hun harde schaal schuilt een gevoelige ziel. Kreeften kunnen zich gekwetst terugtrekken als ze zich bedreigd voelen. Ze hebben de neiging om aan het verleden vast te houden, zowel aan mooie herinneringen als aan oude pijn. Hun stemmingen kunnen wisselen als de getijden, beïnvloed door hun heersende planeet, de Maan.`
  },

  'Leeuw': {
    naam: 'Leeuw',
    datumStart: '23 juli',
    datumEind: '22 augustus',
    element: 'Vuur',
    planeet: 'Zon',
    beschrijving: `De Leeuw is de koning van de dierenriem. Met hun natuurlijke uitstraling en zelfvertrouwen trekken ze alle aandacht naar zich toe. Leeuwen zijn warm, genereus en hebben een aangeboren talent voor leiderschap.

Samen met de Ram en de Boogschutter vormt de Leeuw de drie vuurtekens. Van deze drie is de Leeuw de stabielste en evenwichtigste. Het zijn goede en eerliefende mensen die van vrede houden. Ze hechten veel waarde aan loyaliteit en zijn niet bepaald dol op verandering.

Leeuwen hebben erkenning en waardering nodig. Mentaal gezien hebben ze een scherpe geest en zijn ze vaak praktisch en intellectueel ingesteld. De keerzijde is dat ze trots kunnen zijn en moeite kunnen hebben met kritiek. Maar hun warme hart en loyaliteit maken veel goed.`
  },

  'Maagd': {
    naam: 'Maagd',
    datumStart: '23 augustus',
    datumEind: '22 september',
    element: 'Aarde',
    planeet: 'Mercurius',
    beschrijving: `De Maagd is het teken van precisie, analyse en dienstbaarheid. Maagden hebben een scherp oog voor detail en streven naar perfectie in alles wat ze doen. Ze zijn praktisch, georganiseerd en uiterst behulpzaam.

Met hun analytische geest kunnen Maagden complexe problemen ontrafelen en praktische oplossingen bedenken. Ze zijn harde werkers die geen moeite te veel is als het resultaat maar goed is. Hun kritische blik is vooral op zichzelf gericht - een Maagd is vaak strenger voor zichzelf dan voor anderen.

Maagden zijn bescheiden en zoeken niet de schijnwerpers. Ze voelen zich het beste als ze nuttig kunnen zijn en een bijdrage kunnen leveren. In relaties zijn ze attent en zorgzaam, al kunnen ze soms wat gereserveerd overkomen. Onder hun nuchtere buitenkant schuilt een warm hart dat oprecht het beste voor heeft met anderen.`
  },

  'Weegschaal': {
    naam: 'Weegschaal',
    datumStart: '23 september',
    datumEind: '22 oktober',
    element: 'Lucht',
    planeet: 'Venus',
    beschrijving: `De Weegschaal zoekt altijd naar balans en harmonie. Mensen met dit sterrenbeeld hebben een sterk gevoel voor rechtvaardigheid en kunnen situaties van meerdere kanten bekijken. Ze zijn diplomatiek, charmant en houden van schoonheid in alle vormen.

De Weegschaal is het enige sterrenbeeld dat niet naar een mens of een dier verwijst, maar naar een object - de weegschaal van de Griekse godin van rechtvaardigheid, Themis. Dit symboliseert hun eeuwige zoektocht naar evenwicht en eerlijkheid.

Mensen met horoscoop Weegschaal zijn elegant, charmant, hebben goede smaak, zijn van nature vriendelijk en zachtaardig. Ze houden van schoonheid, harmonie en het gevoel dat deze dingen brengen. Ze hebben een groot vermogen om kritisch na te denken en kunnen een stapje terugnemen om onpartijdig te kijken naar complexe kwesties. Hun diplomatie maakt hen tot natuurlijke bemiddelaars.`
  },

  'Schorpioen': {
    naam: 'Schorpioen',
    datumStart: '23 oktober',
    datumEind: '21 november',
    element: 'Water',
    planeet: 'Pluto',
    beschrijving: `De Schorpioen is het meest intense en mysterieuze teken van de dierenriem. Schorpioenen voelen alles diep en hebben een doordringende blik waarmee ze dwars door façades heen kijken. Ze zijn gepassioneerd, vastberaden en vergeten nooit.

Achter hun beheerste buitenkant bruist een wereld van emoties. Schorpioenen houden hun kaarten graag tegen de borst en onthullen zichzelf pas als ze iemand volledig vertrouwen. Dit vertrouwen moet verdiend worden, maar eenmaal gegeven is het onwankelbaar - mits het niet beschaamd wordt.

Schorpioenen hebben een enorme wilskracht en doorzettingsvermogen. Als ze zich ergens op richten, gaan ze er volledig voor. Deze intensiteit kan intimiderend zijn, maar maakt hen ook tot trouwe bondgenoten. Een Schorpioen als vriend staat tot het einde der tijden achter je.`
  },

  'Boogschutter': {
    naam: 'Boogschutter',
    datumStart: '22 november',
    datumEind: '21 december',
    element: 'Vuur',
    planeet: 'Jupiter',
    beschrijving: `De Boogschutter is de avonturier en filosoof van de dierenriem. Met hun optimistische blik en honger naar kennis zijn ze altijd op zoek naar nieuwe horizonten - zowel fysiek als mentaal. Vrijheid is hun hoogste goed.

Boogschutters zijn eerlijk, soms pijnlijk eerlijk. Ze zeggen wat ze denken en verwachten dat van anderen ook. Hun enthousiasme is aanstekelijk en ze hebben het vermogen om het positieve in elke situatie te zien. Ze zijn grootmoedig en delen graag hun geluk met anderen.

Met hun filosofische inslag zijn Boogschutters geïnteresseerd in de grote vragen des levens. Ze houden van reizen, leren en het ontmoeten van mensen uit andere culturen. De keerzijde is dat ze moeite kunnen hebben met routine en verplichtingen. Een Boogschutter heeft ruimte nodig om te zijn wie hij is.`
  },

  'Steenbok': {
    naam: 'Steenbok',
    datumStart: '22 december',
    datumEind: '19 januari',
    element: 'Aarde',
    planeet: 'Saturnus',
    beschrijving: `De Steenbok is het teken van ambitie, discipline en doorzettingsvermogen. Steenbokken zijn gedreven om te slagen en bereid om er hard voor te werken. Ze klimmen gestaag naar de top, stap voor stap.

Met hun praktische instelling en sterke verantwoordelijkheidsgevoel zijn Steenbokken betrouwbare pijlers in elke organisatie of familie. Ze nemen hun verplichtingen serieus en houden zich aan hun woord. Traditie en structuur geven hen houvast.

Achter hun serieuze façade schuilt vaak een droge humor en een warm hart. Steenbokken tonen hun gevoelens niet makkelijk, maar hun daden spreken boekdelen. Ze zijn loyale partners en ouders die stabiliteit en zekerheid bieden. Met de jaren worden Steenbokken vaak juist losser en vrolijker.`
  },

  'Waterman': {
    naam: 'Waterman',
    datumStart: '20 januari',
    datumEind: '18 februari',
    element: 'Lucht',
    planeet: 'Uranus',
    beschrijving: `De Waterman is de vernieuwer en idealist van de dierenriem. Met hun originele kijk op de wereld en onafhankelijke geest zijn ze hun tijd vaak vooruit. Ze dromen van een betere wereld en zijn bereid ervoor te vechten.

Watermannen zijn intellectueel, vriendelijk en sociaal betrokken. Ze hebben een brede vriendenkring en behandelen iedereen gelijk, ongeacht achtergrond of status. Hun humanitaire instelling maakt hen tot voorvechters van goede doelen.

De keerzijde van hun onafhankelijkheid is dat Watermannen emotioneel afstandelijk kunnen lijken. Ze leven meer in hun hoofd dan in hun hart, wat relaties soms lastig maakt. Maar hun loyaliteit aan vriendschap is onwankelbaar. Een Waterman accepteert je volledig zoals je bent.`
  },

  'Vissen': {
    naam: 'Vissen',
    datumStart: '19 februari',
    datumEind: '20 maart',
    element: 'Water',
    planeet: 'Neptunus',
    beschrijving: `De Vissen is het meest intuïtieve en empathische teken van de dierenriem. Vissen voelen de emoties van anderen alsof het hun eigen emoties zijn. Ze zijn creatief, dromerig en hebben een rijk innerlijk leven.

Met hun grenzeloze verbeelding zijn Vissen vaak artistiek begaafd. Muziek, kunst en poëzie spreken tot hun ziel. Ze hebben een natuurlijke verbinding met het spirituele en mystieke. Hun intuïtie is vaak verrassend accuraat.

Vissen zijn zachtaardig en hebben de neiging om anderen te helpen, soms ten koste van zichzelf. Ze kunnen moeite hebben met grenzen stellen en de harde realiteit. Hun gevoeligheid maakt hen kwetsbaar, maar ook tot de meest begripvolle en meelevende vrienden die je je kunt wensen.`
  }
}

// =============================================================================
// CHINESE DIERENRIEM
// =============================================================================

export const CHINESE_TEKENS: Record<string, ChineesTekenInfo> = {
  'Rat': {
    naam: 'Rat',
    jaren: [1936, 1948, 1960, 1972, 1984, 1996, 2008, 2020],
    beschrijving: `De Rat is het eerste dier in de Chinese dierenriem en staat symbool voor slimheid en vindingrijkheid. Mensen geboren in het jaar van de Rat zijn intelligent, charmant en hebben een scherpe geest.

Ratten zijn ambitieus en gedreven om te slagen. Ze hebben een uitstekend zakelijk instinct en weten kansen te herkennen die anderen over het hoofd zien. Met hun sociale vaardigheden bouwen ze moeiteloos netwerken op die hen verder helpen in het leven.

De Rat is spaarzaam en denkt vooruit. Ze houden van zekerheid en bouwen graag reserves op voor mindere tijden. In relaties zijn ze loyaal en genereus naar hun dierbaren, al houden ze graag de touwtjes in handen.`
  },

  'Os': {
    naam: 'Os',
    jaren: [1937, 1949, 1961, 1973, 1985, 1997, 2009, 2021],
    beschrijving: `De Os vertegenwoordigt kracht, betrouwbaarheid en vastberadenheid. Mensen geboren in dit jaar zijn harde werkers die met geduld en doorzettingsvermogen hun doelen bereiken.

Een Os is iemand op wie je kunt bouwen. Ze zijn eerlijk, oprecht en houden niet van onzin. Met hun nuchtere kijk op het leven en praktische instelling lossen ze problemen methodisch op. Ze nemen de tijd voor beslissingen maar staan er vervolgens volledig achter.

Ossen kunnen koppig zijn als ze eenmaal een standpunt hebben ingenomen. Ze houden van routine en hebben moeite met onverwachte veranderingen. Maar hun stabiliteit en trouw maken hen tot waardevolle partners en vrienden.`
  },

  'Tijger': {
    naam: 'Tijger',
    jaren: [1938, 1950, 1962, 1974, 1986, 1998, 2010, 2022],
    beschrijving: `De Tijger is het teken van moed, passie en avontuur. Tijgers zijn natuurlijke leiders met een magnetische uitstraling die anderen aantrekt en inspireert.

Mensen geboren in het jaar van de Tijger zijn onafhankelijk en houden van uitdagingen. Ze zijn moedig en staan op voor wat ze geloven, zelfs als ze alleen staan. Hun enthousiasme en energie zijn aanstekelijk.

Tijgers kunnen impulsief en ongeduldig zijn. Ze vervelen zich snel en hebben constante stimulatie nodig. Maar hun grootmoedigheid en beschermende aard maken hen tot fantastische vrienden. Een Tijger vecht voor zijn dierbaren.`
  },

  'Konijn': {
    naam: 'Konijn',
    jaren: [1939, 1951, 1963, 1975, 1987, 1999, 2011, 2023],
    beschrijving: `Het Konijn staat voor gratie, voorzichtigheid en diplomatie. Mensen geboren in dit jaar hebben een verfijnde smaak en een talent voor het creëren van harmonie.

Konijnen zijn vriendelijk en vermijden confrontatie waar mogelijk. Ze zijn uitstekende luisteraars en adviseurs, die conflicten op een elegante manier kunnen oplossen. Met hun oog voor schoonheid creëren ze een stijlvolle omgeving.

De voorzichtigheid van het Konijn kan soms overgaan in besluiteloosheid of het vermijden van moeilijke situaties. Maar hun tact en sensitiviteit maken hen geliefd in sociale kringen. Een Konijn is de perfecte gastheer.`
  },

  'Draak': {
    naam: 'Draak',
    jaren: [1940, 1952, 1964, 1976, 1988, 2000, 2012, 2024],
    beschrijving: `De Draak is het meest gelukkige en krachtige teken in de Chinese astrologie, en het enige mythische dier in de dierenriem. Draken zijn ambitieus, moedig en vol zelfvertrouwen. Ze zijn geboren om te schitteren.

Draken zijn trots en levendig, enthousiast, onweerstaanbaar, geestdriftig, succesvol, krachtig, extravert, inspirerend en voelen zich uitverkoren. Ze zijn geboren onder het teken van geluk. De draak is in China ook het teken van de keizer en is bij ouders die een kind willen bijzonder populair.

Draken kunnen arrogant of veeleisend overkomen door hun hoge verwachtingen. Ze accepteren geen middelmatigheid, van zichzelf noch van anderen. Maar hun generositeit en beschermende aard maken veel goed. Een Draak geeft altijd meer dan hij neemt.`
  },

  'Slang': {
    naam: 'Slang',
    jaren: [1941, 1953, 1965, 1977, 1989, 2001, 2013, 2025],
    beschrijving: `De Slang vertegenwoordigt wijsheid, mysterie en elegantie. Mensen geboren in dit jaar zijn diepzinnig, intuïtief en hebben een magnetische aantrekkingskracht.

Slangen zijn denkers die graag de diepte in gaan. Ze vertrouwen op hun intuïtie en hebben vaak een zesde zintuig voor mensen en situaties. Met hun analytische vermogen doorgronden ze complexe problemen.

De Slang houdt zijn kaarten tegen de borst en onthult zichzelf niet makkelijk. Ze kunnen jaloers of bezitterig zijn in relaties. Maar hun loyaliteit en wijsheid maken hen tot waardevolle raadgevers en vertrouwelingen.`
  },

  'Paard': {
    naam: 'Paard',
    jaren: [1930, 1942, 1954, 1966, 1978, 1990, 2002, 2014, 2026],
    beschrijving: `Het Paard staat voor vrijheid, energie en avontuurlijkheid. Paarden zijn actief, vrolijk en houden van onafhankelijkheid. Ze zijn altijd in beweging.

Mensen geboren in het jaar van het Paard zijn sociaal en populair. Ze hebben een groot gevoel voor humor en weten elk feest op te vrolijken. Hun enthousiasme en optimisme zijn aanstekelijk.

Paarden kunnen rusteloos en ongeduldig zijn. Ze hebben moeite met routine en verplichtingen die hun vrijheid beperken. Maar hun eerlijkheid en warme persoonlijkheid maken hen tot geliefde vrienden.`
  },

  'Geit': {
    naam: 'Geit',
    jaren: [1931, 1943, 1955, 1967, 1979, 1991, 2003, 2015, 2027],
    beschrijving: `De Geit (ook wel Schaap genoemd) symboliseert creativiteit, zachtaardigheid en harmonie. Geiten zijn artistieke zielen met een groot hart en een rijk gevoelsleven.

Mensen geboren in dit jaar zijn verzorgend en hebben oog voor schoonheid. Ze gedijen in een harmonieuze omgeving en hebben moeite met conflicten. Hun creativiteit uit zich vaak in kunst, muziek of andere expressieve vormen.

Geiten kunnen onzeker zijn en hebben bevestiging nodig van anderen. Ze zijn gevoelig voor kritiek en kunnen piekeren. Maar hun warmte en oprechte interesse in anderen maken hen tot dierbare vrienden.`
  },

  'Aap': {
    naam: 'Aap',
    jaren: [1932, 1944, 1956, 1968, 1980, 1992, 2004, 2016, 2028],
    beschrijving: `De Aap staat voor intelligentie, vindingrijkheid en humor. Apen zijn slim, nieuwsgierig en weten overal een oplossing voor te vinden.

Mensen geboren in het jaar van de Aap zijn veelzijdig en kunnen zich snel aanpassen aan nieuwe situaties. Ze zijn entertainers die met hun gevatte humor en charme elk publiek voor zich winnen. Hun snelle geest maakt hen tot uitstekende probleemoplossers.

Apen kunnen soms te slim voor hun eigen bestwil zijn en manipulatief overkomen. Ze vervelen zich snel en hebben uitdaging nodig. Maar hun speelsheid en creativiteit brengen vreugde in elke situatie.`
  },

  'Haan': {
    naam: 'Haan',
    jaren: [1933, 1945, 1957, 1969, 1981, 1993, 2005, 2017, 2029],
    beschrijving: `De Haan vertegenwoordigt eerlijkheid, ijver en punctualiteit. Hanen zijn hardwerkend, georganiseerd en zeggen waar het op staat.

Mensen geboren in dit jaar zijn perfectionisten die hoge eisen stellen aan zichzelf en anderen. Ze zijn moedig en uitgesproken, niet bang om hun mening te geven. Met hun oog voor detail missen ze weinig.

Hanen kunnen kritisch en veeleisend zijn. Ze hechten waarde aan uiterlijk en presentatie, soms te veel. Maar hun loyaliteit en bereidheid om hard te werken maken hen tot betrouwbare partners.`
  },

  'Hond': {
    naam: 'Hond',
    jaren: [1934, 1946, 1958, 1970, 1982, 1994, 2006, 2018, 2030],
    beschrijving: `De Hond staat voor loyaliteit, eerlijkheid en rechtvaardigheid. Honden zijn trouwe vrienden die altijd voor je klaarstaan, wat er ook gebeurt.

Mensen geboren in het jaar van de Hond hebben een sterk moreel kompas. Ze vechten voor de underdog en kunnen niet tegen onrechtvaardigheid. Hun eerlijkheid is soms wat direct, maar altijd goed bedoeld.

Honden kunnen angstig of pessimistisch zijn en hebben de neiging tot piekeren. Ze zijn niet de beste in het uiten van hun eigen emoties. Maar hun onvoorwaardelijke loyaliteit en oprechtheid maken hen tot de beste vrienden die je kunt hebben.`
  },

  'Varken': {
    naam: 'Varken',
    jaren: [1935, 1947, 1959, 1971, 1983, 1995, 2007, 2019, 2031],
    beschrijving: `Het Varken (of Zwijn) symboliseert welvaart, geluk en goedhartigheid. Varkens zijn genereus, tolerant en houden van de geneugten des levens.

Een Varken is een vredestichter. Ze handhaven orde en gezag en geloven in gerechtigheid. Een Varken houdt van gezelschap en groepsdynamiek, maar heeft ook behoefte aan alleen-tijd. Varkens hebben gevoel voor humor en zijn ontzettend loyaal. Ze doen graag wat hen gevraagd wordt en zijn zelden boos.

De goedgelovigheid van het Varken kan hen kwetsbaar maken voor misbruik. Ze hebben moeite met nee zeggen en kunnen daardoor overweldigd raken. Maar hun warmte en optimisme brengen vreugde aan iedereen om hen heen.`
  }
}

// =============================================================================
// HELPER FUNCTIES
// =============================================================================

/**
 * Haal sterrenbeeld beschrijving op basis van naam
 */
export function getSterrenbeeldBeschrijving(sterrenbeeld: string): SterrenbeeldInfo | null {
  return STERRENBEELDEN[sterrenbeeld] || null
}

/**
 * Haal Chinees teken beschrijving op basis van naam
 */
export function getChineesTekenBeschrijving(teken: string): ChineesTekenInfo | null {
  return CHINESE_TEKENS[teken] || null
}