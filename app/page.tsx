import Link from 'next/link'

const secties = [
  { tag: 'de voorpagina', titel: 'Persoonlijk openingsartikel', tekst: 'Jullie geboorteverhaal, geschreven als een echt krantenbericht — met kop, lead en jullie eigen details.' },
  { tag: 'de naam', titel: 'Naamgenoten', tekst: 'Waar de naam vandaan komt, wat hij betekent en welke beroemde mensen hem al droegen.' },
  { tag: 'de datum', titel: 'Geboren op', tekst: 'Wie deze verjaardag nog meer heeft: schrijvers, sterren en een enkele astronaut.' },
  { tag: 'de sterren', titel: 'Horoscoop', tekst: 'Sterrenbeeld en Chinees teken, met een knipoog beschreven. Geloven mag, lachen ook.' },
  { tag: 'die dag', titel: 'Nieuws van de dag', tekst: 'De koppen van de geboortedag, uit het archief opgediept en netjes naverteld.' },
  { tag: 'die dag', titel: 'Muziek, films en series', tekst: 'Wat er nummer 1 stond, wat er in de bioscoop draaide en waar Nederland naar keek.' },
]

const stappen = [
  { n: '1', titel: 'Naam en datum', tekst: 'Twee minuten. Meer hebben we niet nodig om het archief van die dag open te trekken.' },
  { n: '2', titel: 'Een klein interview', tekst: 'Over de zwangerschap, de bevalling en de eerste dagen. Type kort, wij maken er zinnen van.' },
  { n: '3', titel: 'Lezen, bijschaven, bestellen', tekst: 'Je ziet je krant meteen. Elk artikel is aan te passen, en pas als je blij bent, reken je af.' },
]

const producten = [
  { naam: 'PDF', prijs: '€ 14,95', tekst: 'Drukklaar op A3, zonder watermerk. Zelf printen mag zo vaak je wilt.' },
  { naam: 'Print op A3', prijs: '€ 29,95', tekst: 'Gedrukt op 170-grams krantenpapier en opgerold in een koker bezorgd.' },
  { naam: 'Ingelijst', prijs: '€ 59,95', tekst: 'Eiken lijst met passe-partout, klaar om boven het ledikant te hangen.' },
]

export default function Home() {
  return (
    <div className="min-h-screen bg-cream text-dark font-sans">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-cream/[.92] backdrop-blur-sm border-b border-dark/10">
        <div className="max-w-container mx-auto px-7 py-3.5 flex items-center justify-between gap-6">
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <div className="w-[30px] h-[30px] rounded-full bg-sage flex items-center justify-center text-cream font-extrabold text-[15px]">b</div>
            <div className="font-bold text-[19px] tracking-tight text-dark">babykrantje<span className="text-terracotta">.nl</span></div>
          </Link>
          <div className="flex items-center gap-6 text-sm font-medium">
            <a href="#voorbeelden" className="text-dark no-underline hover:text-terracotta">Voorbeelden</a>
            <a href="#hoe" className="text-dark no-underline hover:text-terracotta">Zo werkt het</a>
            <a href="#prijs" className="text-dark no-underline hover:text-terracotta">Prijs</a>
            <Link href="/wizard" className="bk-btn-primary !py-2.5 !px-[18px] !text-sm">Maak je krantje</Link>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="max-w-container mx-auto px-7 pt-16 pb-10 grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
        <div>
          <div className="inline-flex items-center gap-2 bg-peach px-3.5 py-1.5 rounded-pill text-[13px] font-semibold mb-5">Het origineelste kraamcadeau</div>
          <h1 className="text-[clamp(40px,5.2vw,66px)] leading-[0.96] tracking-[-0.04em] font-extrabold mb-5">
            Een babykrantje,<br />in een handomdraai.
          </h1>
          <p className="font-serif text-xl leading-relaxed text-[#4A4740] mb-7 max-w-[30em]" style={{ textWrap: 'pretty' as any }}>
            Vertel het geboorteverhaal in tien minuten. Wij maken er een echte voorpagina van — mét het nieuws, het weer, de muziek en de films van precies die dag.
          </p>
          <div className="flex items-center gap-4 flex-wrap">
            <Link href="/wizard" className="bk-btn-primary !text-[17px] !py-4 !px-7 no-underline">Begin met een naam en datum</Link>
            <a href="#voorbeelden" className="text-[15px] font-semibold text-dark border-b-2 border-sage pb-0.5 no-underline">Bekijk voorbeelden</a>
          </div>
          <div className="flex gap-5 mt-6 text-[13.5px] text-muted flex-wrap">
            <span>&#10003; Gratis proberen</span>
            <span>&#10003; Betaal pas bij downloaden</span>
            <span>&#10003; Klaar in 10 minuten</span>
          </div>
        </div>
        <div className="flex justify-center relative">
          <div className="absolute w-[420px] h-[420px] rounded-full bg-[#EDE7DA] blur-[2px] top-5" />
          <div className="w-[380px] h-[537px] overflow-hidden relative -rotate-3 shadow-[0_40px_70px_-30px_rgba(35,35,31,.4)] bg-white rounded-sm">
            <div className="flex items-center justify-center h-full text-muted font-serif italic text-lg">
              Voorpagina voorbeeld
            </div>
          </div>
        </div>
      </div>

      {/* Wat staat erin */}
      <div className="max-w-container mx-auto px-7 py-13">
        <h2 className="text-[15px] tracking-[0.12em] uppercase font-semibold text-muted mb-6">Wat er in je krant staat</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[18px]">
          {secties.map((s, i) => (
            <div key={i} className="bk-card">
              <div className="font-serif text-[13px] italic text-sage mb-2.5">{s.tag}</div>
              <div className="font-bold text-[19px] tracking-tight mb-[7px]">{s.titel}</div>
              <div className="font-serif text-[15px] leading-relaxed text-subtle">{s.tekst}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Voorbeelden */}
      <div id="voorbeelden" className="bg-cream-dark py-[60px] mt-6">
        <div className="max-w-container mx-auto px-7">
          <div className="flex items-end justify-between gap-6 mb-7">
            <div>
              <h2 className="text-[42px] leading-none tracking-[-0.03em] font-extrabold mb-2.5">Twee stijlen, één verhaal</h2>
              <p className="font-serif text-lg text-subtle max-w-[34em]">Dezelfde inhoud, een ander jasje. Je kiest je stijl in de laatste stap — en past hem aan tot hij bij de kinderkamer past.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
            {[
              { naam: 'Salie', beschrijving: 'zacht, modern, veel wit' },
              { naam: 'Terracotta', beschrijving: 'warm, klassiek, kop in kapitalen' },
            ].map((stijl) => (
              <div key={stijl.naam}>
                <div className="w-full max-w-[532px] h-[400px] md:h-[550px] overflow-hidden bg-white shadow-[0_24px_50px_-26px_rgba(35,35,31,.5)] flex items-center justify-center">
                  <div className="text-muted font-serif italic text-lg">Voorpagina — {stijl.naam}</div>
                </div>
                <div className="flex justify-between items-baseline mt-3.5">
                  <div className="font-bold text-lg">{stijl.naam}</div>
                  <div className="font-serif italic text-[15px] text-muted">{stijl.beschrijving}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Zo werkt het */}
      <div id="hoe" className="max-w-container mx-auto px-7 pt-16 pb-10">
        <h2 className="text-[42px] leading-none tracking-[-0.03em] font-extrabold mb-8">Zo werkt het</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stappen.map((st) => (
            <div key={st.n} className="flex flex-col gap-2.5">
              <div className="w-[38px] h-[38px] rounded-full border-2 border-dark flex items-center justify-center font-bold text-base">{st.n}</div>
              <div className="font-bold text-[21px] tracking-tight">{st.titel}</div>
              <div className="font-serif text-base leading-relaxed text-subtle">{st.tekst}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Cadeau banner */}
      <div className="max-w-container mx-auto px-7 py-5">
        <div className="bg-sage text-cream rounded-[20px] p-11 grid grid-cols-1 lg:grid-cols-[1.2fr_.8fr] gap-10 items-center">
          <div>
            <h3 className="text-[34px] leading-[1.05] tracking-tight font-extrabold mb-3">Op zoek naar een kraamcadeau dat blijft hangen?</h3>
            <p className="font-serif text-lg leading-relaxed mb-5 opacity-95 max-w-[32em]">Een romper is over een half jaar te klein. Een krant hangt over twintig jaar nog aan de muur — en wordt dan pas echt leuk om te lezen.</p>
            <Link href="/wizard" className="inline-block bg-cream text-dark font-semibold text-base px-6 py-3.5 rounded-pill no-underline">Maak er één</Link>
          </div>
          <div className="bg-cream/15 rounded-[14px] p-5">
            <div className="font-serif italic text-[17px] leading-relaxed">&ldquo;Wij hebben hem laten inlijsten en meegenomen naar de kraamvisite. Iedereen ging erbij zitten lezen.&rdquo;</div>
            <div className="text-[13px] mt-3 opacity-85">— Marit, oma van Sem</div>
          </div>
        </div>
      </div>

      {/* Prijs */}
      <div id="prijs" className="max-w-container mx-auto px-7 pt-5 pb-20">
        <h2 className="text-[42px] leading-none tracking-[-0.03em] font-extrabold mb-2">Maken is gratis</h2>
        <p className="font-serif text-lg text-subtle mb-7">Je betaalt pas als je hem echt wilt hebben. Tot die tijd kijk je naar een voorbeeld met watermerk.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-[18px]">
          {producten.map((pr) => (
            <div key={pr.naam} className="bg-cream-card border border-dark/[.12] rounded-card p-6">
              <div className="font-bold text-xl mb-1">{pr.naam}</div>
              <div className="text-[32px] font-extrabold tracking-tight mb-2.5">{pr.prijs}</div>
              <div className="font-serif text-[15.5px] leading-relaxed text-subtle">{pr.tekst}</div>
            </div>
          ))}
        </div>
        <div className="text-sm text-muted mt-4">Een artikel opnieuw laten schrijven kost &euro; 0,50. De eerste vijf keer zijn gratis.</div>
      </div>

      {/* Footer */}
      <div className="border-t border-dark/[.12] py-7 text-center text-[13.5px] text-muted">
        babykrantje.nl — gemaakt in Amersfoort &middot; <a href="#voorbeelden">Voorbeelden</a> &middot; <a href="#prijs">Prijs</a>
      </div>
    </div>
  )
}
