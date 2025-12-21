# Wayback Machine Scraper - Diagnostisch Rapport
**Datum**: 2025-12-21
**Versie geanalyseerd**: v1.5.0 (route.ts) + v2.2.0 (cache)
**Testdata**: 2022-03-28 (Lena), 2020-05-18 (Anne)

---

## 🔴 ROOT CAUSE: Cache Format Mismatch

### Probleem
De Wayback Machine scraper geeft **inconsistente resultaten** voor dezelfde datums. Dit wordt veroorzaakt door een **versie conflict tussen oude en nieuwe cache formats**.

### Technische Details

**Oude cache format (v1.x)**:
```json
{
  "2022-03-28": {
    "status": "found",
    "headlines": 76,  // ❌ NUMBER - alleen count
    "timestamp": "20220328004153"
  }
}
```

**Nieuwe cache format (v2.1.0+)**:
```typescript
interface WaybackCacheEntry {
  status: 'found'
  headlines?: WaybackHeadline[]  // ✅ ARRAY - volledige data
  timestamp?: string
}
```

**Code verwacht array** (`/app/api/news/wayback/route.ts:478`):
```typescript
if (cached && cached.status === 'found' && cached.headlines && cached.headlines.length > 0) {
  return NextResponse.json({
    headlines: cached.headlines,  // ❌ FAALT als headlines een number is
    totalHeadlines: cached.headlines.length  // ❌ undefined.length
  })
}
```

### Impact
- **Cache hits met oude data**: Geen headlines, lege resultaten
- **Fresh API calls**: Wel headlines, maar worden niet correct gecached (als sources null is)
- **Gebruikerservaring**: Inconsistent - soms data, soms niet voor dezelfde datum

---

## 📊 Bevindingen uit Code Analyse

### 1. Scraping Flow
**Locatie**: `/app/api/news/wayback/route.ts`

```
┌─────────────────┐
│ Cache Check     │ → Redis (Vercel) of Filesystem (local)
└─────────────────┘
         ↓
┌─────────────────┐
│ CDX API Query   │ → web.archive.org/cdx/search/cdx
└─────────────────┘
         ↓
┌─────────────────┐
│ Fetch Snapshot  │ → web.archive.org/web/{timestamp}
└─────────────────┘
         ↓
┌─────────────────┐
│ Parse HTML      │ → Regex patterns voor nu.nl/nos.nl
└─────────────────┘
         ↓
┌─────────────────┐
│ Cache Result    │ → Alleen bij status='found' + headlines.length > 0
└─────────────────┘
```

### 2. Multi-Source Fallback Strategy
- **Primair**: `www.nu.nl`
- **Fallback**: `www.nos.nl`, `nos.nl`
- **Logic**: Stop zodra primaire bron resultaten geeft (regel 516)

### 3. Cache Strategy (v2.2.0)
```typescript
// ALLEEN successen worden gecached
if (entry.status !== 'found' || !entry.headlines || entry.headlines.length === 0) {
  return  // Skip cache write
}
```

**Probleem**: De code op regel 522 schrijft:
```typescript
sources: [source]  // ❌ Maar oude cache heeft sources: null
```

---

## 🐛 Geïdentificeerde Issues

### Issue #1: Cache Format Migration Ontbreekt
**Severity**: 🔴 CRITICAL
**Locatie**: `/lib/waybackCache.ts:61-72` (checkCacheRedis), `144-152` (checkCacheFile)

**Probleem**:
- Geen validatie of migratie van oude cache entries
- `cached.headlines` kan een `number` zijn (oude format) of `array` (nieuwe format)
- Code gaat er blind vanuit dat het een array is

**Code snippet** (`route.ts:478`):
```typescript
if (cached && cached.status === 'found' && cached.headlines && cached.headlines.length > 0) {
  // ❌ Als cached.headlines = 76 (number), dan cached.headlines.length = undefined
  // ❌ Check faalt, cache wordt niet gebruikt
  console.log(`Cache hit! Returning ${cached.headlines.length} headlines`)
}
```

**Gevolg**: Cache hits worden NIET herkend, elke keer verse API call naar Wayback Machine.

---

### Issue #2: Ontbrekende Error Handling & Timeouts
**Severity**: 🟡 HIGH
**Locatie**: `/app/api/news/wayback/route.ts:61-65`, `111-116`

**Probleem**:
```typescript
const response = await fetch(cdxUrl, {
  headers: {
    'User-Agent': 'Babykrant/1.0 (educational project)'
  }
  // ❌ GEEN timeout parameter
  // ❌ GEEN retry logic
})
```

**Gevolgen**:
- Wayback Machine is **traag en onbetrouwbaar** (vaak 5-30 seconden response tijd)
- Geen timeout → requests kunnen **oneindig hangen**
- Geen retry → tijdelijke netwerk errors geven meteen failure
- Wayback **rate limiting** (HTTP 429) wordt niet afgehandeld

**Observed errors**:
- `EAI_AGAIN` - DNS resolution failures (tijdelijk)
- `ETIMEDOUT` - Connection timeouts
- `HTTP 403` - Rate limiting of IP blocking
- `HTTP 429` - Too many requests

---

### Issue #3: Fragiele HTML Parsing
**Severity**: 🟡 MEDIUM
**Locatie**: `/app/api/news/wayback/route.ts:134-230`

**Probleem**:
Regex-based HTML parsing is fragiel:
```typescript
const titleAttrPattern = /<span[^>]*title="([^"]+)"[^>]*class="[^"]*item-title__title[^"]*"[^>]*>/gi
```

**Gevolgen**:
- Als NU.nl hun HTML structuur verandert → parsing faalt
- Wayback snapshots hebben verschillende HTML versies over tijd
- Geen fallback als parsing 0 headlines oplevert

**Beter**: HTML parser library (jsdom, cheerio) voor robuustheid

---

### Issue #4: Ontbrekende Cache Sources
**Severity**: 🟠 MEDIUM
**Locatie**: `/data/wayback-cache.json`

**Bevinding**:
```json
{
  "2022-03-28": {
    "sources": null  // ❌ Moet ["www.nu.nl"] zijn
  }
}
```

**Impact**: Kan niet tracken welke bron gebruikt werd voor debugging.

---

### Issue #5: CDX API Limit = 5 Te Laag
**Severity**: 🟠 MEDIUM
**Locatie**: `/app/api/news/wayback/route.ts:56`

**Probleem**:
```typescript
const cdxUrl = `...&limit=5`  // ❌ Alleen eerste 5 snapshots
```

**Scenario**:
- 28 maart 2022 heeft misschien 20 snapshots
- Eerste 5 snapshots zijn om 00:00, 02:00, 04:00, 06:00, 08:00
- Deze vroege snapshots hebben vaak **minder nieuws** (nacht)
- Betere snapshots (12:00, 18:00) worden **nooit geprobeerd**

**Oplossing**: Verhoog naar `limit=20` of implementeer time-based filtering (prefer snapshots tussen 12:00-18:00).

---

### Issue #6: Geen Detectie van Incomplete Results
**Severity**: 🟠 MEDIUM

**Probleem**:
Code accepteert **elk resultaat > 0 headlines**:
```typescript
if (headlines.length > 0) {
  // Cache & return
}
```

**Scenario**:
- 28 maart 2022: eerste snapshot (00:00) heeft 3 headlines
- Later snapshot (14:00) heeft 76 headlines
- Code stopt na eerste success → gebruiker krijgt **incomplete data**

**Oplossing**:
- Minimale threshold: `headlines.length >= 10`
- Of: probeer alle bronnen en neem de beste

---

## 🧪 Test Resultaten

### Test Environment
- **Locatie**: Local development (sandbox)
- **Cache**: Filesystem (`/data/wayback-cache.json`)
- **Netwerk**: ❌ web.archive.org geblokkeerd (HTTP 403)

### Cache Analyse
```json
{
  "total_entries": 5,
  "status_breakdown": {
    "found": 3,
    "not_found": 1,
    "too_old": 1
  },
  "success_rate": "60%"
}
```

### Test Datum: 2022-03-28 (Lena)
**Cache entry**:
```json
{
  "status": "found",
  "headlines": 76,  // ❌ NUMBER instead of ARRAY
  "timestamp": "20220328004153",
  "sources": null,
  "lastChecked": "2024-12-13T12:00:00.000Z"
}
```

**Verwacht gedrag** (nieuwe code):
- Cache hit → Return 76 headlines array
- Response: `totalHeadlines: 76`

**Actueel gedrag** (met oude cache):
- Cache check: `cached.headlines.length` → `undefined` (want 76.length = undefined)
- Cache wordt **genegeerd**
- Fresh API call naar Wayback → ❌ Fails (netwerk blocked)
- Response: `totalHeadlines: 0, error: "No snapshots found"`

**Conclusie**: Cache werkt NIET door format mismatch.

---

### Test Datum: 2020-05-18 (Anne)
**Zelfde probleem**:
```json
{
  "status": "found",
  "headlines": 45,  // ❌ NUMBER
  "timestamp": "20200518120000"
}
```

---

## 💡 Voorgestelde Oplossingen

### Oplossing 1: Cache Migration & Validation (CRITICAL)
**Prioriteit**: 🔴 P0
**Schatting**: 2-3 uur

**Implementatie**:
```typescript
// lib/waybackCache.ts
export async function checkCache(date: string): Promise<WaybackCacheEntry | null> {
  const cached = hasUpstashEnv() ? await checkCacheRedis(date) : await checkCacheFile(date)

  if (!cached) return null

  // MIGRATION: Convert old format to new format
  if (cached.status === 'found' && typeof cached.headlines === 'number') {
    console.warn(`[WaybackCache] Old cache format detected for ${date} - invalidating`)
    // Option A: Invalidate old cache (force fresh fetch)
    return null

    // Option B: Keep partial data but mark as stale
    // return { ...cached, headlines: undefined, headlineCount: cached.headlines }
  }

  // VALIDATION: Ensure headlines is array with data
  if (cached.status === 'found' && (!Array.isArray(cached.headlines) || cached.headlines.length === 0)) {
    console.warn(`[WaybackCache] Invalid cache data for ${date} - invalidating`)
    return null
  }

  return cached
}
```

**Voor/nadelen**:
- ✅ Direct fix voor inconsistentie
- ✅ Simpel te implementeren
- ✅ Self-healing (oude cache wordt automatisch vervangen)
- ❌ Eerste request na deployment is langzamer (moet Wayback opnieuw fetchen)

---

### Oplossing 2: Timeout & Retry Logic (HIGH)
**Prioriteit**: 🟡 P1
**Schatting**: 3-4 uur

**Implementatie**:
```typescript
// lib/waybackFetch.ts (nieuwe utility)
const WAYBACK_TIMEOUT = 15000  // 15 seconden
const MAX_RETRIES = 3
const RETRY_DELAY = 2000  // 2 seconden

async function fetchWithRetry(url: string, options: RequestInit = {}, retries = MAX_RETRIES): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), WAYBACK_TIMEOUT)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })

    clearTimeout(timeout)

    // Handle rate limiting
    if (response.status === 429 && retries > 0) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '5') * 1000
      console.log(`[Wayback] Rate limited, retrying after ${retryAfter}ms...`)
      await new Promise(resolve => setTimeout(resolve, retryAfter))
      return fetchWithRetry(url, options, retries - 1)
    }

    // Handle temporary errors
    if ((response.status >= 500 || response.status === 403) && retries > 0) {
      console.log(`[Wayback] Error ${response.status}, retrying (${retries} left)...`)
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
      return fetchWithRetry(url, options, retries - 1)
    }

    return response
  } catch (error) {
    clearTimeout(timeout)

    // Retry on network errors
    if (retries > 0 && (error.name === 'AbortError' || error.code === 'ETIMEDOUT' || error.code === 'EAI_AGAIN')) {
      console.log(`[Wayback] Network error, retrying (${retries} left)...`)
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
      return fetchWithRetry(url, options, retries - 1)
    }

    throw error
  }
}
```

**Voor/nadelen**:
- ✅ Veel robuuster tegen tijdelijke failures
- ✅ Handelt rate limiting netjes af
- ✅ Voorkomt infinite hangs
- ❌ Requests kunnen 45+ seconden duren (3 retries × 15s)
- ❌ Extra complexiteit

---

### Oplossing 3: Fallback naar Alternatieve Data Sources (MEDIUM)
**Prioriteit**: 🟠 P2
**Schatting**: 8-12 uur

**Idee**: Wayback Machine is niet de enige bron voor historisch nieuws.

**Alternatieve bronnen**:
1. **NewsAPI** (news API aggregator)
   - Pro: Betrouwbaar, snel, gestructureerde data
   - Con: Alleen laatste 30 dagen gratis, oudere data betaald

2. **Common Crawl** (web archive alternatief)
   - Pro: Gratis, groot archief
   - Con: Complexere API, minder complete coverage

3. **Google News Archive** (via custom search)
   - Pro: Grote coverage
   - Con: Geen officiele API, scraping vereist

4. **Gecachte headlines in database** (eigen archief)
   - Pro: 100% control, altijd beschikbaar
   - Con: Vereist upfront data collection

**Implementatie strategie**:
```typescript
// Multi-source waterfall
async function getNewsForDate(date: string): Promise<Headline[]> {
  // 1. Try Wayback Machine (current)
  let headlines = await getWaybackNews(date)
  if (headlines.length >= 10) return headlines

  // 2. Try NewsAPI (if recent)
  if (isWithinLast30Days(date)) {
    headlines = await getNewsAPINews(date)
    if (headlines.length >= 10) return headlines
  }

  // 3. Try Common Crawl
  headlines = await getCommonCrawlNews(date)
  if (headlines.length >= 10) return headlines

  // 4. Return whatever we have
  return headlines
}
```

**Voor/nadelen**:
- ✅ Veel hogere success rate
- ✅ Fallback voor Wayback downtime
- ✅ Diversiteit in bronnen
- ❌ Veel werk om te implementeren
- ❌ Mogelijk kosten (NewsAPI)
- ❌ Complexer onderhoud

---

### Oplossing 4: Smart CDX Query Strategy (MEDIUM)
**Prioriteit**: 🟠 P2
**Schatting**: 2-3 uur

**Probleem**: Huidige code pakt eerste 5 snapshots, die vaak suboptimaal zijn.

**Betere strategie**:
```typescript
async function findBestSnapshot(date: string, source: string): Promise<WaybackSnapshot | null> {
  const [year, month, day] = date.split('-')
  const dateStr = `${year}${month}${day}`

  // IMPROVED: Query for more snapshots and prefer peak hours
  const cdxUrl = `...&limit=20`  // Verhoog van 5 naar 20
  const data = await fetch(cdxUrl).then(r => r.json())

  if (data.length < 2) return null

  // Filter snapshots and score by time of day
  const snapshots = data.slice(1).map(record => {
    const timestamp = record[1]
    const hour = parseInt(timestamp.substring(8, 10))

    // Score: prefer afternoon/evening (12:00 - 20:00)
    let score = 0
    if (hour >= 12 && hour <= 20) score = 10
    else if (hour >= 8 && hour < 12) score = 5
    else score = 1  // Night/early morning

    return { record, timestamp, hour, score }
  })

  // Sort by score (highest first) and take best
  snapshots.sort((a, b) => b.score - a.score)
  const best = snapshots[0]

  console.log(`[Wayback] Selected snapshot at ${best.hour}:00 (score: ${best.score})`)

  return {
    timestamp: best.timestamp,
    url: best.record[2],
    status: best.record[4],
    mimeType: best.record[3],
    source
  }
}
```

**Voor/nadelen**:
- ✅ Betere kwaliteit snapshots
- ✅ Simpel te implementeren
- ✅ Geen extra dependencies
- ❌ Iets meer API calls (maar nog steeds binnen limits)

---

### Oplossing 5: Minimum Headline Threshold (EASY)
**Prioriteit**: 🟢 P3
**Schatting**: 0.5 uur

**Implementatie**:
```typescript
const MIN_HEADLINES = 10

if (headlines.length >= MIN_HEADLINES) {
  // Cache and return
} else if (headlines.length > 0) {
  console.log(`[Wayback] Found ${headlines.length} headlines but threshold is ${MIN_HEADLINES}, trying next source...`)
  // Continue to fallback sources
}
```

**Voor/nadelen**:
- ✅ Simpel
- ✅ Voorkomt incomplete data
- ❌ Kan leiden tot meer failures voor oudere datums

---

### Oplossing 6: Monitoring & Alerting (MEDIUM)
**Prioriteit**: 🟠 P2
**Schatting**: 4-6 uur

**Implementatie**:
- Log structured data naar logging service (LogTail, Axiom, etc.)
- Track metrics:
  - Cache hit rate
  - Wayback API success rate
  - Average response time
  - Failures per datum
- Alerts bij:
  - Cache hit rate < 50%
  - Wayback API errors > 25%
  - Avg response time > 10s

**Voor/nadelen**:
- ✅ Inzicht in problemen voordat users klagen
- ✅ Data-driven optimalisatie
- ❌ Extra kosten (logging service)
- ❌ Setup tijd

---

## 📋 Aanbevolen Implementatie Roadmap

### Phase 1: Critical Fixes (Week 1)
**Prioriteit**: 🔴 MUST-HAVE
**Totaal**: ~5-7 uur

1. **Cache Migration** (Oplossing 1) - 2-3 uur
   - Fix format mismatch
   - Invalidate oude cache entries
   - Deploy naar productie

2. **Timeout & Retry** (Oplossing 2) - 3-4 uur
   - Implementeer fetchWithRetry utility
   - Replace alle fetch calls
   - Test met verschillende failure scenarios

**Verwacht resultaat**:
- Inconsistentie opgelost
- 80-90% minder timeouts
- Betere user experience

---

### Phase 2: Reliability Improvements (Week 2-3)
**Prioriteit**: 🟡 SHOULD-HAVE
**Totaal**: ~4-6 uur

3. **Smart CDX Strategy** (Oplossing 4) - 2-3 uur
   - Implementeer time-based snapshot scoring
   - Test met verschillende datums

4. **Minimum Threshold** (Oplossing 5) - 0.5 uur
   - Add MIN_HEADLINES constant
   - Update cache logic

5. **Monitoring** (Oplossing 6) - 4-6 uur
   - Setup logging service
   - Add structured logs
   - Create basic dashboard

**Verwacht resultaat**:
- Hogere data kwaliteit
- Zichtbaarheid in problemen
- Proactieve fixes

---

### Phase 3: Long-term Resilience (Week 4-6)
**Prioriteit**: 🟢 NICE-TO-HAVE
**Totaal**: ~8-12 uur

6. **Fallback Sources** (Oplossing 3) - 8-12 uur
   - Implementeer NewsAPI integration
   - Setup multi-source waterfall
   - A/B test resultaten

**Verwacht resultaat**:
- 95%+ success rate
- Onafhankelijk van Wayback uptime
- Diversiteit in data bronnen

---

## 🎯 Samenvatting

### Root Cause
**Cache format mismatch** tussen oude cache (headlines als number) en nieuwe code (verwacht headlines array).

### Impact
- Gebruikers zien inconsistent data voor dezelfde datums
- Cache wordt niet effectief gebruikt
- Verhoogde belasting op Wayback Machine API

### Snelste Fix
**Oplossing 1 (Cache Migration)** implementeren - 2-3 uur werk, lost core probleem op.

### Ideale State
**Phase 1 + Phase 2** implementeren voor production-ready system met monitoring.

### Business Value per Oplossing
| Oplossing | Impact | Effort | ROI | Priority |
|-----------|--------|--------|-----|----------|
| 1. Cache Migration | 🔴 HIGH | 2-3h | ⭐⭐⭐⭐⭐ | P0 |
| 2. Timeout & Retry | 🟡 MED-HIGH | 3-4h | ⭐⭐⭐⭐ | P1 |
| 4. Smart CDX | 🟠 MEDIUM | 2-3h | ⭐⭐⭐ | P2 |
| 5. Min Threshold | 🟠 MEDIUM | 0.5h | ⭐⭐⭐⭐ | P2 |
| 6. Monitoring | 🟠 MEDIUM | 4-6h | ⭐⭐⭐ | P2 |
| 3. Fallback Sources | 🟢 LOW-MED | 8-12h | ⭐⭐ | P3 |

---

## 📎 Bijlagen

### Relevante Code Locaties
- `/app/api/news/wayback/route.ts` - Main scraper logic
- `/lib/waybackCache.ts` - Cache implementation
- `/data/wayback-cache.json` - Cache storage (local)

### Testdata
- 2022-03-28: 76 headlines (cached, old format)
- 2020-05-18: 45 headlines (cached, old format)
- 2024-12-21: 42 headlines (recent, possibly new format)

### Externe Dependencies
- Wayback Machine CDX API: `https://web.archive.org/cdx/search/cdx`
- Wayback Machine Snapshots: `https://web.archive.org/web/{timestamp}/{url}`
- Upstash Redis: KV storage op Vercel (productie)

---

**Einde Rapport**
