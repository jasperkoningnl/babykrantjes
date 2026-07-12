# Babykrant — Volledige projectanalyse

*Datum: 12 juli 2026 · Versie project: 3.3.1*

Doelstelling: bezoekers kunnen redelijk geautomatiseerd een babykrant **samenstellen en bestellen**.

---

## 1. Waar het project nu staat

**Wat werkt (prototype-niveau):**
- Wizard met 4 stappen (basisgegevens, extra vragen, foto's, review), doordachte datamodellen in `lib/types.ts`.
- Dataverzameling uit ~10 bronnen: weer (Open-Meteo), naambetekenis, naamgenoten (Wikipedia), geboren-op-deze-dag, films/series (TMDB), Top 40, jaaroverzicht muziek (dutchcharts), TV-programma's (drielaags), NL-nieuws (Wayback/NOS/NU), internationaal nieuws (Wikipedia).
- AI-artikelgeneratie per sectie (8 secties) via Claude, met goede prompts en tone-of-voice regels.
- Cache-architectuur in 3 lagen (Redis → bestand → statische JSON per jaar) plus dagelijkse Vercel-cron voor "gisteren".
- GitHub Actions voor bulk-discovery en bron-scans.

**Wat ontbreekt voor het einddoel (samenstellen → bestellen):**
- Geen krant-opmaak of PDF — de output is losse tekstblokken op een testpagina.
- Foto's gaan verloren: `File`-objecten overleven `JSON.stringify` naar localStorage niet en worden nergens geüpload.
- Geen persistentie: refresh = alles kwijt. Geen database, geen "mijn krant"-concept.
- Geen bestelflow: geen checkout, betaling (Mollie/Stripe), drukwerk-integratie of orderbeheer.

---

## 2. Kernbevinding scraping: de scan is kapot, niet de bronnen

Dit is waarschijnlijk waar je op vastliep. `data/tv-source-report.json` rapporteert **0% dekking voor alle 8 bronnen over 180 datums** — inclusief `uitzendinggemist.net`, waarvan we *zeker weten* dat er Wayback-snapshots bestaan (de bron werkt aantoonbaar t/m 20-02-2024 in Layer 1). Een 0-score voor een bewezen bron betekent: **de meting faalde, niet de bron**.

Oorzaken in `scripts/scan-tv-sources.ts`:

1. **Elke fout wordt geteld als "niet gevonden"** — `checkWaybackCDX()` vangt timeouts, 429's (rate limit) en 403's op en retourneert `{ found: false }` zonder onderscheid. Een geblokkeerde runner produceert dus exact hetzelfde rapport als "bron bestaat niet".
2. **Geen retry** — het script gebruikt kale `fetch`, niet de bestaande `fetchWithRetry` uit `lib/waybackFetch.ts` (die 429/5xx wél netjes afhandelt).
3. **Te agressief tempo** — 300 ms tussen CDX-calls; archive.org throttlet de CDX API zwaar, zeker vanaf datacenter-IP's.
4. **GitHub Actions-IP's worden door archive.org vaak geblokkeerd/gethrottled** — hetzelfde verklaart waarom `data/cache/news/` nog leeg is (alleen `.gitkeep`): de bulk news-discovery heeft nooit resultaten opgeleverd/gecommit.

**Fix (klein, hoge impact):**
- Laat `checkWaybackCDX` een derde status teruggeven: `found | not_found | error` (met HTTP-statuscode), gebruik `fetchWithRetry`, verhoog delay naar 1.5–2 s.
- Toon in het rapport: `errors` apart van `not_found`. Pas dan kun je conclusies trekken.
- Draai de scan **lokaal** (residentieel IP) in plaats van in Actions, of via een kleine VPS. De Actions-workflows zijn prima voor commits, maar niet als scraping-IP.
- Sanity-check inbouwen: als een bekende-goede referentie-URL (uzg 2015) 0 scoort → rapport afkeuren i.p.v. wegschrijven.

Dezelfde "silent failure"-stijl (catch → leeg resultaat) zit in vrijwel alle scrapers en API-routes. Daardoor is bij een lege krantsectie niet te zien of de bron leeg was, de parser brak, of het netwerk faalde. Aanrader: overal een `error`-veld + statuscode doorgeven en op één debugpagina tonen.

---

## 3. Het TV-gat raakt juist je échte klanten

De drielaagse TV-strategie heeft een gat dat precies op je doelgroep valt:

| Periode | Bron | Status |
|---|---|---|
| t/m 20-02-2024 | uitzendinggemist.net | ✅ werkt |
| laatste 0–7 dagen | tvblik.nl / kijkonderzoek.nl | ✅ werkt |
| **21-02-2024 t/m 8 dagen geleden** | Wayback (Layer 3) | ❌ TODO — leeg |

Echte bezoekers maken een krant voor een baby van dagen tot maanden oud → vrijwel elke bestelling valt in het gat (dat inmiddels ~2,5 jaar beslaat en dagelijks groeit).

**Advies, in volgorde van rendement:**
1. **Breid de dagelijkse cron uit met TV** (`app/api/cron/cache-yesterday/route.ts` heeft er al een placeholder voor): scrape elke nacht tvblik/kijkonderzoek voor gisteren → vanaf nu groeit er een sluitende TV-cache voor alle toekomstige klanten. Dit is de belangrijkste enkele verbetering in het hele scraping-domein.
2. Backfill 2024–2026 via Wayback-snapshots van tvblik/tvgids — maar pas ná de gerepareerde scan, zodat je weet welke bron dekking heeft.
3. Fallback voor datums zonder dag-data: gebruik de al bestaande `wikipediaTVAPI` (jaar-hoogtepunten) en laat de cultuur-prompt daar gracieus op terugvallen — beter een goed jaaroverzicht dan een lege sectie.

---

## 4. Verbeteropties per front

### 4.1 Scraping & databronnen
- **Parsers zijn regex-op-HTML zonder tests.** Leg per bron 2–3 echte HTML-snapshots vast als fixtures en schrijf unit-tests (vitest) op de parse-functies. Dan zie je bij een site-redesign direct wélke parser brak. De parsers zijn hier ideaal testbaar — pure functies.
- **`decodeHtmlEntities` en entity-cleaning zijn 3× gedupliceerd** (waybackScraper, uzg-route, e.a.) → één util.
- **Datum/tijdzone-bug in spe:** overal `new Date('YYYY-MM-DD')` (= UTC-middernacht) gemixt met lokale tijd (`setHours(0,0,0,0)`, `toISOString()`). Rond middernacht en in zomertijd kan `calculateDaysAgo` er één naast zitten → verkeerde tvblik-pagina. Gebruik één date-util die alles als kalenderdatum (string) behandelt.
- **Nieuwe bronnen om te overwegen:**
  - *Delpher (KB)* — gedigitaliseerde Nederlandse kranten; ideaal voor oudere geboortedatums (< 2005, nu afgekapt op 2005).
  - *Wikipedia "huidige gebeurtenissen"-portalen* per dag als extra nieuwslaag (API, geen scraping).
  - Voor TV op lange termijn: gelicentieerde gidsdata (Bindinc/Gracenote) zodra er omzet is — scraping blijft de zwakste schakel onder een betaald product.

### 4.2 AI-generatie
- **Model is verouderd:** `claude-3-5-haiku-20241022`. Upgrade naar `claude-haiku-4-5-20251001` (merkbaar betere Nederlandse tekst, prijs $1/$5 per Mtok — gelijk aan wat nu al in `CLAUDE_PRICING` staat, dus de kostenberekening blijft kloppen).
- **8 losse calls → 1 gestructureerde call.** Genereer alle secties in één request met JSON-output: goedkoper (systeem-prompt en data één keer i.p.v. acht keer), sneller, en consistentere toon over de hele krant. Houd per-sectie-regeneratie als aparte call voor de "opnieuw"-knop.
- **Prompt-duplicatie:** `SYSTEM_PROMPT` + `buildPrompt` staan integraal gekopieerd in `app/generate-articles/page.tsx` (developer mode) én `app/api/generate-article/route.ts`. Die lopen gegarandeerd uit elkaar. Verplaats naar `lib/prompts.ts` en importeer op beide plekken.
- **Prompt caching** op de system prompt scheelt nog eens in de kosten bij bulk.

### 4.3 Beveiliging & robuustheid (belangrijk vóór publiek gebruik)
- **`NODE_TLS_REJECT_UNAUTHORIZED = '0'` in de Top40-route** schakelt TLS-verificatie *proces-breed* uit tijdens de fetch. Op een serverless instance met parallelle requests raakt dat óók je Anthropic- en betaalverkeer, en de env-var kan door de async race "aan" blijven staan. Vervang door een undici `Agent` met custom `connect`-opties alléén voor die ene host, of accepteer de failure.
- **Rate limiting werkt niet echt:** `dailyUsage` is een in-memory `Map` — die reset bij elke cold start en is per instance; bovendien kiest de client zijn eigen `sessionId`. Iedereen kan dus onbeperkt Anthropic-credits opstoken. Je hebt Upstash Redis al als dependency → gebruik `@upstash/ratelimit` op IP + sessie, server-side.
- **Open endpoints:** `/api/debug/*`, `/api/test/*` en de testpagina's (`/test-results`, `/test-patterns`) staan in productie open. Achter een env-flag of weg uit de build.
- **`CRON_SECRET` is optioneel** — maak verplicht in productie.

### 4.4 Architectuur & onderhoud
- **Client-orkestratie:** de loading-screen vuurt ~14 API-calls vanuit de browser en de data leeft in localStorage. Voor een bestelproduct hoort dit server-side: één `POST /api/kranten` die verzamelt, genereert en een `krant`-record opslaat. Dan krijg je gratis: hervatten, delen via link, orderkoppeling en betrouwbaar foutherstel.
- **Geen tests, geen CI voor build/lint** — er zijn alleen scraping-workflows. Minimaal: `next build` + `lint` + parser-tests op elke PR.
- **Documentatie is verouderd/tegenstrijdig:** `.claudecode` zegt "werk altijd direct op main, nooit claude/*-branches", terwijl de recente historie en workflows juist met claude/*-branches en auto-merge werken. Geen README aan de root. Eén bijgewerkte README + CLAUDE.md voorkomt dat een volgende sessie (van jou of van een agent) de verkeerde workflow volgt.

### 4.5 Juridisch/commercieel (zodra er betaald besteld wordt)
- Headlines en naambetekenis-teksten komen van derden. AI-herschrijving (doe je al) beperkt het risico; letterlijke headlines afdrukken in een betaald product is een grijs gebied — houd de nieuwssectie samenvattend/herschreven.
- TMDB vereist attributie volgens hun voorwaarden.
- AVG: geboortedata, namen en babyfoto's zijn persoonsgegevens → privacyverklaring, EU-opslag (Vercel-regio), bewaartermijn en verwijderoptie.

---

## 5. Plan van aanpak

### Fase 1 — Scraping vlottrekken (het huidige blok)
1. Scan-script repareren: `error` vs `not_found` onderscheiden, `fetchWithRetry` gebruiken, delay ≥ 1,5 s, sanity-check op bekende-goede URL.
2. Scan lokaal her-draaien → nu pas een betrouwbaar beeld van welke TV-bron dekking heeft per jaar.
3. **Dagelijkse cron uitbreiden met TV-caching** (grootste winst — sluit het gat voor alle toekomstige klanten).
4. News-discovery lokaal draaien per jaar — begin met 2024–2026 (de geboortejaren van baby's waarvoor nú besteld wordt) en werk daarna terug — en de `news-YYYY.json` bestanden committen.
5. TV-backfill 2024→nu via de best scorende Wayback-bron; fallback naar jaar-hoogtepunten inbouwen in de cultuur-prompt.

### Fase 2 — Van demo naar product-kern
6. Persistentie: database (Vercel Postgres of Supabase) met `krant`-record (invoer, verzamelde data, gegenereerde teksten, status).
7. Foto-upload naar Vercel Blob/S3 (+ server-side resize), weg uit localStorage.
8. Server-side generatie-endpoint: verzamelen + genereren in één job; model-upgrade naar Haiku 4.5; één gestructureerde call; gedeelde prompt-module.
9. **Krant-layout**: HTML/CSS print-template (A3/tabloid, kolommen, foto-posities) + PDF-render (Playwright/Chromium op een route of externe render-service). Dit is de zichtbare kern van het product.
10. Redis rate limiting + debug-routes dicht + `CRON_SECRET` verplicht + TLS-hack vervangen.

### Fase 3 — Bestellen
11. Preview → checkout: adres, aantal exemplaren, prijs.
12. Betaling via Mollie (iDEAL is in NL onmisbaar).
13. Drukwerk: print-on-demand API (Peecho, Print API.nl, Gelato) óf handmatige eerste versie (order-mail met PDF naar jezelf + lokale drukker) — start handmatig, automatiseer bij volume.
14. Transactionele mail (Resend/Postmark): bevestiging, PDF-proef, verzendstatus.

### Fase 4 — Hardening & lancering
15. Parser-fixtures + tests, CI op elke PR, Sentry voor runtime-fouten.
16. Privacyverklaring, voorwaarden, TMDB-attributie, bewaartermijnen.
17. Scrape-health dashboard: per bron laatste succes/fout, zodat een stille breuk binnen een dag zichtbaar is.

**Volgorde-rationale:** Fase 1 is klein en deblokkeert je datapijplijn; Fase 2 bevat de twee dingen die een bezoeker écht nodig heeft (een mooie krant zien + niets kwijtraken); pas daarna heeft een betaalknop zin.
