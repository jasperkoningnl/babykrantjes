#!/usr/bin/env node
// check-topic-indexes.mjs
//
// Verifieert per kandidaat-URL of er een scrapbare topic/dossier-indexpagina bestaat.
// Node 18+, geen dependencies, gewone fetch. Draait sequentieel met ~1s pauze.
//
// Output:
//   - scripts/verificatie-resultaten.md  (markdownrapport)
//   - scripts/verificatie-resultaten.json (ruwe meetdata, voor controle)
//
// Gebruik: node scripts/check-topic-indexes.mjs

import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Proxy-bewust maken. In sommige omgevingen loopt uitgaand HTTPS via een lokale
// proxy (HTTPS_PROXY). Node's ingebouwde fetch leest die env pas als
// NODE_USE_ENV_PROXY=1 gezet is (Node >= 22.21). We zetten dat hier alvast,
// vóór de eerste fetch, zodat het script overal werkt.
// Let op: als de proxy TLS her-termineert, start Node dan met
//   NODE_EXTRA_CA_CERTS=<pad naar CA-bundle>
// want die variabele wordt alleen bij het opstarten van Node gelezen.
// Op een gewone machine zonder proxy heeft dit geen effect.
if (process.env.HTTPS_PROXY || process.env.https_proxy) {
  if (!process.env.NODE_USE_ENV_PROXY) process.env.NODE_USE_ENV_PROXY = '1';
  console.log(`(proxy actief: ${process.env.HTTPS_PROXY || process.env.https_proxy})`);
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const TIMEOUT_MS = 15000;
const PAUSE_MS = 1000;

// Kandidatenlijst. group: 'control' | 'verify' | 'known'
const CANDIDATES = [
  // Controlegroep (moeten BRUIKBAAR scoren)
  { name: 'VRT NWS', url: 'https://www.vrt.be/vrtnws/nl/dossiers/', group: 'control' },
  { name: 'Al Jazeera', url: 'https://www.aljazeera.com/sitemap', group: 'control' },
  { name: 'France 24', url: 'https://www.france24.com/sitemaps/fr/tags.xml', group: 'control' },
  { name: 'Irish Times', url: 'https://www.irishtimes.com/tags/index/', group: 'control' },
  { name: 'Guardian API', url: 'https://content.guardianapis.com/tags?api-key=test&page-size=50', group: 'control' },
  { name: 'SCMP', url: 'https://www.scmp.com/topics', group: 'control' },

  // Te verifieren
  { name: 'RFI (fr)', url: 'https://www.rfi.fr/sitemaps/fr/tags.xml', group: 'verify' },
  { name: 'RFI (en)', url: 'https://www.rfi.fr/sitemaps/en/tags.xml', group: 'verify' },
  { name: 'Zeit Online', url: 'https://www.zeit.de/schlagworte/index', group: 'verify' },
  { name: 'Der Spiegel', url: 'https://www.spiegel.de/thema/', group: 'verify' },
  { name: 'El Pais', url: 'https://elpais.com/noticias/', group: 'verify' },
  { name: 'Guardian HTML-index', url: 'https://www.theguardian.com/index/subjects/a', group: 'verify' },
  { name: 'CNN', url: 'https://edition.cnn.com/specials', group: 'verify' },
  { name: 'AP', url: 'https://apnews.com/sitemap.xml', group: 'verify' },
  { name: 'Corriere della Sera', url: 'https://www.corriere.it/argomenti/', group: 'verify' },
  { name: 'La Repubblica', url: 'https://www.repubblica.it/argomenti/', group: 'verify' },
  { name: 'G1 Globo', url: 'https://g1.globo.com/tudo-sobre/', group: 'verify' },
  { name: 'Folha de Sao Paulo', url: 'https://www1.folha.uol.com.br/folha-topicos/', group: 'verify' },
  { name: 'Daily Maverick', url: 'https://www.dailymaverick.co.za/wp-sitemap.xml', group: 'verify' },
  { name: 'Mail & Guardian', url: 'https://mg.co.za/wp-sitemap.xml', group: 'verify' },
  { name: 'Tagesschau', url: 'https://www.tagesschau.de/thema/', group: 'verify' },
  { name: 'Deutsche Welle', url: 'https://www.dw.com/en/topics/s-100152', group: 'verify' },
  { name: 'Sueddeutsche Zeitung', url: 'https://www.sueddeutsche.de/thema/', group: 'verify' },
  { name: 'Le Monde', url: 'https://www.lemonde.fr/sujet/', group: 'verify' },
  { name: 'Le Figaro', url: 'https://www.lefigaro.fr/tag/', group: 'verify' },
  { name: 'Franceinfo', url: 'https://www.franceinfo.fr/sitemap.xml', group: 'verify' },
  { name: 'El Mundo', url: 'https://www.elmundo.es/temas/', group: 'verify' },
  { name: 'La Nacion', url: 'https://www.lanacion.com.ar/tema/', group: 'verify' },
  { name: 'Publico', url: 'https://www.publico.pt/temas', group: 'verify' },
  { name: 'ANSA', url: 'https://www.ansa.it/sitemap.xml', group: 'verify' },
  { name: 'The Hindu', url: 'https://www.thehindu.com/topic/', group: 'verify' },
  { name: 'Channel News Asia', url: 'https://www.channelnewsasia.com/topic', group: 'verify' },
  { name: 'NHK World', url: 'https://www3.nhk.or.jp/nhkworld/en/news/tags/', group: 'verify' },
  { name: 'The National', url: 'https://www.thenationalnews.com/tags/', group: 'verify' },
  { name: 'Haaretz', url: 'https://www.haaretz.com/ty-tag', group: 'verify' },
  { name: 'NRK', url: 'https://www.nrk.no/emner/', group: 'verify' },
  { name: 'DR', url: 'https://www.dr.dk/nyheder/tema', group: 'verify' },
  { name: 'SVT', url: 'https://www.svt.se/nyheter/amne/', group: 'verify' },
  { name: 'YLE', url: 'https://yle.fi/aihe', group: 'verify' },
  { name: 'Global Issues', url: 'https://www.globalissues.org/news/topic', group: 'verify' },
  { name: 'NYT', url: 'https://www.nytimes.com/topic/', group: 'verify' },
  { name: 'Washington Post', url: 'https://www.washingtonpost.com/topics/', group: 'verify' },
  { name: 'BBC', url: 'https://www.bbc.com/news/topics', group: 'verify' },
  { name: 'Wikipedia Current Events', url: 'https://en.wikipedia.org/wiki/Portal:Current_events', group: 'verify' },
  { name: 'Wikipedia maandarchief', url: 'https://en.wikipedia.org/wiki/Portal:Current_events/July_2022', group: 'verify' },

  // Reeds bekend: eenmalige controlefetch
  { name: 'Reuters', url: 'https://www.reuters.com/sitemap/topics/', group: 'known' },
];

// Alternatieve paden om te proberen bij 404 / redirect naar homepage.
const ALT_PATHS = [
  '/topics', '/topic', '/temas', '/thema', '/themen', '/tags',
  '/argomenti', '/dossiers', '/sitemap.xml', '/wp-sitemap.xml', '/robots.txt',
];

const BLOCK_MARKERS = [
  'captcha', 'cloudflare', 'just a moment', 'checking your browser',
  'access denied', 'attention required', 'are you a robot', 'you have been blocked',
  'request unsuccessful', 'incapsula', 'perimeterx', 'px-captcha',
  'verify you are human', 'enable cookies and javascript', 'ddos protection',
];

const JS_MARKERS = [
  'you need to enable javascript', 'please enable javascript', 'enable javascript to run this app',
  '__next_data__', 'id="__next"', 'id="root"', 'id="app"', 'ng-app', 'data-reactroot',
];

const TOPIC_PATH_HINTS = [
  '/topic/', '/topics/', '/tag/', '/tags/', '/thema/', '/themen/', '/schlagworte/',
  '/tema/', '/temas/', '/sujet/', '/sujets/', '/argomenti/', '/dossier', '/dossiers/',
  '/emner/', '/emne/', '/amne/', '/aihe/', '/ty-tag', '/tudo-sobre/', '/folha-topicos/',
  '/specials/', '/special/', '/news/topic', '/portal:current_events',
];

// Navigatie-/footer-/account-/juridische linkteksten die GEEN nieuws-topic zijn.
// Gebruikt om voorbeeldtopics te schonen (exacte match op de kleine-letter tekst,
// of de tekst begint met een van deze woorden).
const NAV_DENY = new Set([
  'home', 'homepage', 'startseite', 'accueil', 'inicio', 'etusivu', 'startpagina',
  'latest', 'latest news', 'latest videos', 'latest audio', 'most popular',
  'subscribe', 'subscription', 'subscriptions', 'print subscriptions', 'subscriber only',
  'sign in', 'signin', 'log in', 'login', 'register', 'my profile', 'profile',
  'account', 'account overview', 'billing', 'settings', 'saved articles',
  'newsletter', 'newsletters', 'video', 'videos', 'audio', 'podcast', 'podcasts',
  'privacy', 'privacy policy', 'privacy policy.', 'terms', 'terms of use',
  'terms and conditions', 'cookie', 'cookies', 'cookie policy', 'contact', 'contact us',
  'about', 'about us', 'advertise', 'help', 'faq', 'sitemap', 'menu', 'search',
  'skip to content', 'today', "today's paper", 'todays paper', 'read', 'edit',
  'view history', 'talk', 'what links here', 'related changes', 'portal',
  'nyheter', 'lokalt', 'nrk tv', 'nrk radio', 'nrk super', 'yr', 'exklusive artikel',
  'politik', 'politics', 'opinions', 'style', 'sport', 'sports', 'weather', 'news',
  'iplayer', 'guida ai contenuti', 'ultima ora', 'torna alla homepage', 'contattaci',
  'ansa.it', 'my profile', 'usersign in', 'user sign in', 'newsletters',
  'abonnez-vous', 'soyez alerté', 'rechercher', 'todos os sites',
  'política de privacidade', 'politica de privacidade',
]);

// Slug uit een sitemap die geen topic is maar een datum-/archief-/sub-sitemapbucket.
// Bijv. "2026 07 article", "ap sitemap 200602", "sitemap news 3".
function isArchiveSlug(s) {
  const t = s.toLowerCase().trim();
  if (/\bsitemap\b/.test(t)) return true;
  if (/^\d{4}[\s_/-]?\d{2}\b/.test(t)) return true; // begint met jaar+maand
  if (/^\d{6,}$/.test(t.replace(/\s+/g, ''))) return true; // puur cijfers (datum-id)
  if (/^(article|video|audio|poll|page)\s*\d*$/.test(t)) return true;
  return false;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function detectType(contentType, body) {
  const ct = (contentType || '').toLowerCase();
  const head = body.slice(0, 2000).trimStart();
  if (ct.includes('json') || head.startsWith('{') || head.startsWith('[')) return 'JSON';
  if (ct.includes('xml') || head.startsWith('<?xml') || head.includes('<urlset') || head.includes('<sitemapindex')) return 'XML';
  return 'HTML';
}

function firstKb(body) {
  return body.slice(0, 4096).toLowerCase();
}

// Egress-/allowlistblokkade van de omgeving zelf (niet de site). Bijv.:
// "Host not in allowlist: <host>. Add this host to your network egress settings".
function isEgressBlocked(status, body) {
  const head = firstKb(body);
  return (
    head.includes('not in allowlist') ||
    head.includes('network egress') ||
    head.includes('egress settings') ||
    head.includes('add this host')
  );
}

// Site-blokkade. Statuscodes zijn hard. Tekstmarkers tellen ALLEEN op korte,
// linkarme pagina's — een echte anti-bot-challenge is klein en heeft nauwelijks
// links. Een volledig gerenderde 200-pagina met honderden links die toevallig
// het woord "captcha" bevat is geen blokkade (voorkomt valse positieven op o.a.
// SCMP en Wikipedia).
function isBlocked(status, body, linkCount) {
  if (status === 401 || status === 403 || status === 429) return true;
  if (body.length < 15000 && linkCount < 30) {
    const head = firstKb(body);
    return BLOCK_MARKERS.some((m) => head.includes(m));
  }
  return false;
}

// Analyseer een XML-sitemap: is het een sitemapindex (lijst van sub-sitemaps)
// of bevat het overwegend datum-/archiefbuckets in plaats van topics?
function analyzeXml(body) {
  const isSitemapIndex = /<sitemapindex[\s>]/i.test(body);
  const locs = [...body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]);
  const total = locs.length;
  const xmlLocs = locs.filter((l) => /\.xml($|\?)/i.test(l)).length;
  const archiveLocs = locs.filter((l) => isArchiveSlug(slugToTopic(l))).length;
  const mostlyXml = total > 0 && xmlLocs / total > 0.7;
  const mostlyArchive = total > 0 && archiveLocs / total > 0.7;
  // Geen bruikbare topic-index als het puur sub-sitemaps of datumbuckets zijn.
  const noTopics = isSitemapIndex || mostlyXml || mostlyArchive;
  return { isSitemapIndex, mostlyXml, mostlyArchive, noTopics, total };
}

function hasJsMarkers(body) {
  const head = body.slice(0, 8192).toLowerCase();
  return JS_MARKERS.some((m) => head.includes(m));
}

function countLocs(body) {
  const m = body.match(/<loc>/gi);
  return m ? m.length : 0;
}

function countSitemapEntries(body) {
  // sitemapindex of urlset: tel <loc>
  return countLocs(body);
}

function countAnchors(body) {
  const m = body.match(/<a\s[^>]*href/gi);
  return m ? m.length : 0;
}

// Decodeer een slug uit een URL-pad naar leesbare topicnaam.
function slugToTopic(u) {
  try {
    const parsed = new URL(u);
    let seg = parsed.pathname.replace(/\/+$/, '').split('/').filter(Boolean).pop() || '';
    seg = decodeURIComponent(seg).replace(/\.(xml|html?)$/i, '');
    seg = seg.replace(/[-_+]/g, ' ').trim();
    return seg;
  } catch {
    return u;
  }
}

function extractXmlTopics(body, limit = 5) {
  const locs = [...body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]);
  // Filter sub-sitemaps (.xml) en datum-/archiefbuckets uit de voorbeelden.
  const usable = locs.filter((l) => !/\.xml($|\?)/i.test(l) && !isArchiveSlug(slugToTopic(l)));
  const pool = usable.length ? usable : locs;
  const out = [];
  const seen = new Set();
  // Spreid de steekproef over de lijst.
  const step = Math.max(1, Math.floor(pool.length / (limit + 1)));
  for (let i = 0; i < pool.length && out.length < limit; i += step) {
    const topic = slugToTopic(pool[i]);
    if (topic && topic.length >= 2 && !seen.has(topic)) {
      seen.add(topic);
      out.push(topic);
    }
  }
  // vul aan indien de spreiding te weinig opleverde
  for (let i = 0; i < pool.length && out.length < limit; i++) {
    const topic = slugToTopic(pool[i]);
    if (topic && topic.length >= 2 && !seen.has(topic)) {
      seen.add(topic);
      out.push(topic);
    }
  }
  return out;
}

function extractJsonTopics(body, limit = 5) {
  try {
    const data = JSON.parse(body);
    // Guardian: response.results[].webTitle
    let arr =
      data?.response?.results ||
      data?.results ||
      data?.tags ||
      data?.items ||
      (Array.isArray(data) ? data : null);
    if (!Array.isArray(arr)) return { count: 0, topics: [] };
    const topics = arr
      .slice(0, limit)
      .map((e) => e?.webTitle || e?.title || e?.name || e?.id || '')
      .filter(Boolean);
    return { count: arr.length, topics };
  } catch {
    return { count: 0, topics: [] };
  }
}

function extractHtmlAnchors(body) {
  // Verzamel {href, text}
  const anchors = [];
  const re = /<a\s[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(body)) !== null) {
    const href = m[1];
    const text = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    anchors.push({ href, text });
  }
  return anchors;
}

function isNavText(text) {
  const t = text.toLowerCase().replace(/\s+/g, ' ').trim();
  if (NAV_DENY.has(t)) return true;
  // alfabet-navigatie zoals "A Pfeil rechts" (A→), losse letters, pijltjes
  if (/pfeil|»|›|→|arrow/i.test(text)) return true;
  if (/^[a-z]$/i.test(t)) return true;
  if (/^[a-z]\s*(pfeil|›|»|→)/i.test(t)) return true;
  // begint met een duidelijk nav-woord
  const firstWord = t.split(' ')[0];
  if (['home', 'subscribe', 'sign', 'login', 'log', 'privacy', 'terms', 'cookie',
    'account', 'newsletter', 'menu', 'search'].includes(firstWord)) return true;
  return false;
}

function extractHtmlTopics(body, baseUrl, limit = 5) {
  const anchors = extractHtmlAnchors(body);
  const clean = anchors.filter(
    (a) =>
      a.text.length >= 3 &&
      a.text.length <= 90 &&
      !/^#/.test(a.href) &&
      !/^(javascript:|mailto:|tel:)/i.test(a.href) &&
      !isNavText(a.text)
  );
  const lowerHint = (href) => {
    let path = href;
    try {
      path = new URL(href, baseUrl).pathname.toLowerCase();
    } catch {
      path = href.toLowerCase();
    }
    return TOPIC_PATH_HINTS.some((h) => path.includes(h));
  };
  const topicLinks = clean.filter((a) => lowerHint(a.href));
  const pool = topicLinks.length >= limit ? topicLinks : clean;
  const out = [];
  const seen = new Set();
  for (const a of pool) {
    const key = a.text.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(a.text);
    }
    if (out.length >= limit) break;
  }
  return out;
}

async function rawFetch(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en,nl;q=0.9,fr;q=0.8,de;q=0.7',
      },
    });
    const body = await res.text();
    return {
      ok: true,
      status: res.status,
      finalUrl: res.url,
      contentType: res.headers.get('content-type') || '',
      body,
    };
  } catch (e) {
    if (e.name === 'AbortError') return { ok: false, error: 'timeout (15s)' };
    const cause = e.cause ? String(e.cause.message || e.cause.code || e.cause) : '';
    // Egress-/proxybeleid weigert de host (CONNECT 403). Dit is GEEN site-blokkade.
    const policyDenied = /403|connect|tunnel|policy|denied|cancelled/i.test(cause + ' ' + (e.message || ''));
    return {
      ok: false,
      error: cause ? `${e.message}: ${cause}` : String(e.message || e),
      policyDenied,
    };
  } finally {
    clearTimeout(timer);
  }
}

// Volledige meting van een URL (met 1 automatische retry bij netwerkfout/timeout).
async function measure(url) {
  let r = await rawFetch(url);
  if (!r.ok) {
    await sleep(PAUSE_MS);
    r = await rawFetch(url); // twijfel: tweede fetch, tweede resultaat rapporteren
    if (!r.ok) {
      return { requested: url, error: r.error, policyDenied: !!r.policyDenied, verdictHint: 'FOUT' };
    }
  }

  const egressBlocked = isEgressBlocked(r.status, r.body);
  const type = detectType(r.contentType, r.body);
  let count = 0;
  let topics = [];
  let noTopics = false; // sitemapindex/datumbuckets: bereikbaar maar geen topics

  if (type === 'XML') {
    const xa = analyzeXml(r.body);
    count = xa.total;
    noTopics = xa.noTopics;
    topics = extractXmlTopics(r.body);
  } else if (type === 'JSON') {
    const j = extractJsonTopics(r.body);
    count = j.count;
    topics = j.topics;
  } else {
    count = countAnchors(r.body);
    topics = extractHtmlTopics(r.body, r.finalUrl);
  }

  // Blokkade pas beoordelen met kennis van het aantal links (voorkomt valse
  // positieven op grote 200-pagina's).
  const blocked = isBlocked(r.status, r.body, count);

  // redirect naar homepage?
  let redirectedHome = false;
  try {
    const reqPath = new URL(url).pathname.replace(/\/+$/, '');
    const finPath = new URL(r.finalUrl).pathname.replace(/\/+$/, '');
    redirectedHome = reqPath !== '' && (finPath === '' || finPath === '/');
  } catch {}

  // Serverside (vrijwel) leeg + JS-app-markers => client-side gerenderd.
  const jsOnly = type === 'HTML' && count < 10 && hasJsMarkers(r.body);
  // Serverside helemaal leeg zonder herkenbare JS-markers: ook onbruikbaar.
  const emptyHtml = type === 'HTML' && count === 0 && !jsOnly;

  return {
    requested: url,
    finalUrl: r.finalUrl,
    status: r.status,
    type,
    count,
    topics,
    blocked,
    egressBlocked,
    redirectedHome,
    jsOnly,
    emptyHtml,
    noTopics,
    bodyLen: r.body.length,
  };
}

function verdictFor(m) {
  if (m.error) return 'FOUT';
  if (m.egressBlocked || m.policyDenied) return 'EGRESS-GEBLOKKEERD';
  if (m.blocked) return 'GEBLOKKEERD';
  if (m.status === 404 || m.redirectedHome) return 'NIET-GEVONDEN';
  if (m.status >= 400) return 'FOUT';
  if (m.jsOnly) return 'ONBRUIKBAAR-JS';
  // XML-sitemapindex of datum-/archiefbuckets: bereikbaar maar geen topics.
  if (m.noTopics) return 'GEEN-TOPICS';
  if (m.count === 0) return m.emptyHtml ? 'ONBRUIKBAAR-JS' : 'NIET-GEVONDEN';
  if (m.count > 50) return 'BRUIKBAAR';
  if (m.count >= 10) return 'MAGER';
  return 'MAGER'; // 1-9 items
}

// Alternatieve paden proberen bij NIET-GEVONDEN. Max 3.
async function tryAlternatives(cand, origin) {
  const tried = [];
  const originalPath = new URL(cand.url).pathname.replace(/\/+$/, '');
  const candidates = ALT_PATHS.filter((p) => p.replace(/\/+$/, '') !== originalPath).slice();
  let attempts = 0;
  for (const p of candidates) {
    if (attempts >= 3) break;
    attempts++;
    const altUrl = origin + p;
    console.log(`    -> alternatief pad: ${altUrl}`);
    await sleep(PAUSE_MS);

    // robots.txt: parse voor sitemap-verwijzing naar tag/topic-sitemap
    if (p === '/robots.txt') {
      const r = await rawFetch(altUrl);
      if (r.ok && r.status === 200) {
        const sitemaps = [...r.body.matchAll(/sitemap:\s*(\S+)/gi)].map((mm) => mm[1]);
        const relevant = sitemaps.find((s) => /tag|topic|thema|tema|sujet|argoment|dossier|schlagwort/i.test(s));
        tried.push({ path: altUrl, note: `robots.txt lists ${sitemaps.length} sitemap(s)` + (relevant ? `, following relevant: ${relevant}` : ', geen tag/topic-sitemap') });
        if (relevant) {
          await sleep(PAUSE_MS);
          const m = await measure(relevant);
          const v = verdictFor(m);
          if (['BRUIKBAAR', 'MAGER'].includes(v)) {
            return { found: true, measure: m, verdict: v, altPath: relevant, tried };
          }
        }
      } else {
        tried.push({ path: altUrl, note: r.ok ? `status ${r.status}` : r.error });
      }
      continue;
    }

    const m = await measure(altUrl);
    const v = m.error ? 'FOUT' : verdictFor(m);
    tried.push({ path: altUrl, note: m.error ? m.error : `status ${m.status}, ${m.count} items -> ${v}` });
    if (['BRUIKBAAR', 'MAGER'].includes(v)) {
      return { found: true, measure: m, verdict: v, altPath: altUrl, tried };
    }
  }
  return { found: false, tried };
}

function escPipe(s) {
  return String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

async function main() {
  const results = [];

  for (const cand of CANDIDATES) {
    console.log(`\n[${cand.name}] ${cand.url}`);
    const m = await measure(cand.url);
    let verdict = verdictFor(m);
    let testedUrl = cand.url;
    let altTried = null;

    // Reuters: eenmalige controlefetch, niet verder proberen
    if (verdict === 'NIET-GEVONDEN' && cand.group !== 'known') {
      const origin = new URL(cand.url).origin;
      console.log(`  ${verdict} -> alternatieve paden proberen`);
      const alt = await tryAlternatives(cand, origin);
      altTried = alt.tried;
      if (alt.found) {
        results.push(buildRow(cand, alt.altPath, alt.measure, alt.verdict, altTried));
        console.log(`  => ${alt.verdict} (via ${alt.altPath})`);
        await sleep(PAUSE_MS);
        continue;
      }
    }

    if (m.error) {
      console.log(`  FOUT: ${m.error}`);
    } else {
      console.log(`  status=${m.status} type=${m.type} items=${m.count} verdict=${verdict} final=${m.finalUrl}`);
    }
    results.push(buildRow(cand, testedUrl, m, verdict, altTried));
    await sleep(PAUSE_MS);
  }

  writeReport(results);
  writeFileSync(join(__dirname, 'verificatie-resultaten.json'), JSON.stringify(results, null, 2));
  console.log('\nKlaar. Rapport geschreven naar scripts/verificatie-resultaten.md');
}

function buildRow(cand, testedUrl, m, verdict, altTried) {
  return {
    name: cand.name,
    group: cand.group,
    testedUrl,
    status: m.error ? '-' : m.status,
    finalUrl: m.finalUrl || '',
    type: m.error ? '-' : m.type,
    count: m.error ? 0 : m.count,
    verdict,
    topics: m.topics || [],
    error: m.error || null,
    policyDenied: !!m.policyDenied,
    egressBlocked: !!m.egressBlocked,
    redirectedHome: !!m.redirectedHome,
    jsOnly: !!m.jsOnly,
    emptyHtml: !!m.emptyHtml,
    noTopics: !!m.noTopics,
    blocked: !!m.blocked,
    bodyLen: m.bodyLen || 0,
    altTried: altTried || null,
  };
}

function writeReport(results) {
  const now = new Date().toISOString();
  let md = `# Verificatie topic/dossier-indexpagina's nieuwssites\n\n`;
  md += `Gegenereerd: ${now}\n`;
  md += `Script: \`scripts/check-topic-indexes.mjs\` — Node ${process.version}, gewone fetch, timeout 15s, ~1s pauze.\n`;
  md += `User-Agent: \`${UA}\`\n\n`;
  md += `Oordeel: BRUIKBAAR (>50 items) · MAGER (10-50) · ONBRUIKBAAR-JS · GEBLOKKEERD · NIET-GEVONDEN · FOUT · ` +
    `GEEN-TOPICS (sitemapindex/datum-archief, bereikbaar maar geen topics) · EGRESS-GEBLOKKEERD (omgeving, niet gemeten).\n\n`;

  // Validiteitscontrole: de controlegroep MOET BRUIKBAAR scoren. Zo niet, dan is
  // de run ongeldig (meestal omdat de omgeving uitgaand verkeer blokkeert).
  const controls = results.filter((r) => r.group === 'control');
  const controlsOk = controls.filter((r) => r.verdict === 'BRUIKBAAR').length;
  const egressCount = results.filter((r) => r.verdict === 'EGRESS-GEBLOKKEERD').length;
  if (controls.length > 0 && controlsOk < Math.ceil(controls.length / 2)) {
    md += `> ⚠️ **RUN ONGELDIG.** Van de ${controls.length} controlebronnen scoorde er ${controlsOk} BRUIKBAAR. ` +
      `De controlegroep hoort altijd BRUIKBAAR te scoren; dat gebeurt hier niet.\n`;
    if (egressCount > 0) {
      md += `>\n> Oorzaak: de uitvoeromgeving hanteert een **network-egress-allowlist**. ` +
        `${egressCount}/${results.length} hosts werden geweigerd met een melding als ` +
        `\`Host not in allowlist: <host>. Add this host to your network egress settings to allow access.\` ` +
        `Het verkeer bereikte de sites dus nooit — er zijn **geen echte site-oordelen** verkregen.\n`;
      md += `>\n> **Oplossing:** draai dit script (a) op een machine/omgeving met open uitgaand verkeer, ` +
        `of (b) voeg de kandidaat-hosts toe aan de network-egress-instellingen van de omgeving en draai opnieuw. ` +
        `Zie https://code.claude.com/docs/en/claude-code-on-the-web (netwerkbeleid).\n`;
    }
    md += `\n`;
  }

  md += `| Bron | Geteste URL | Status | Type | Aantal items | Oordeel | 5 voorbeeldtopics |\n`;
  md += `| --- | --- | --- | --- | ---: | --- | --- |\n`;
  for (const r of results) {
    const topics = r.topics.slice(0, 5).map(escPipe).join('; ');
    md += `| ${escPipe(r.name)} | ${escPipe(r.testedUrl)} | ${r.status} | ${r.type} | ${r.count} | ${r.verdict} | ${topics} |\n`;
  }

  // Notities (redirects, alternatieve paden, blokkades)
  md += `\n## Notities per bron\n\n`;
  for (const r of results) {
    const notes = [];
    if (r.egressBlocked) notes.push('omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade');
    if (r.policyDenied) notes.push('egress-/proxybeleid weigerde de host (CONNECT 403) — NIET gemeten, geen site-blokkade');
    if (r.error) notes.push(`fout: ${r.error}`);
    if (r.finalUrl && r.finalUrl !== r.testedUrl) notes.push(`redirect naar ${r.finalUrl}`);
    if (r.redirectedHome) notes.push('redirect naar homepage');
    if (r.blocked) notes.push('blokkade gedetecteerd (status of captcha/cloudflare-tekst)');
    if (r.noTopics) notes.push('sitemapindex/datum-archief: bevat sub-sitemaps of datumbuckets, geen directe topics');
    if (r.jsOnly) notes.push('client-side gerenderd, serverside vrijwel leeg');
    if (r.emptyHtml) notes.push('serverside 0 links (waarschijnlijk client-side gerenderd)');
    if (r.note) notes.push(r.note);
    if (r.altTried && r.altTried.length) {
      notes.push('alternatieve paden: ' + r.altTried.map((t) => `${t.path} (${t.note})`).join(' | '));
    }
    const uniq = [...new Set(notes)];
    if (uniq.length) md += `- **${r.name}**: ${uniq.join('; ')}\n`;
  }

  // Lijst 1: bruikbaar gesorteerd op aantal items
  const usable = results
    .filter((r) => r.verdict === 'BRUIKBAAR')
    .sort((a, b) => b.count - a.count);
  md += `\n## (1) Definitief bruikbare bronnen (gesorteerd op aantal items)\n\n`;
  if (usable.length === 0) md += `_geen_\n`;
  for (const r of usable) {
    md += `- **${r.name}** — ${r.count} items — \`${r.testedUrl}\`\n`;
  }

  // Lijst 2: afvallers met reden
  const dropped = results.filter((r) => r.verdict !== 'BRUIKBAAR');
  md += `\n## (2) Afvallers met reden\n\n`;
  if (dropped.length === 0) md += `_geen_\n`;
  for (const r of dropped) {
    let reason = r.verdict;
    if (r.verdict === 'MAGER') reason = `MAGER (${r.count} items, 10-50 bereik)`;
    else if (r.verdict === 'GEBLOKKEERD') reason = `GEBLOKKEERD (status ${r.status}${r.blocked ? ', blokkadetekst' : ''})`;
    else if (r.verdict === 'ONBRUIKBAAR-JS') reason = `ONBRUIKBAAR-JS (${r.count} links serverside)`;
    else if (r.verdict === 'NIET-GEVONDEN') reason = `NIET-GEVONDEN (na alternatieve paden)`;
    else if (r.verdict === 'GEEN-TOPICS') reason = `GEEN-TOPICS (${r.count} entries, sitemapindex/datum-archief — geen directe topics)`;
    else if (r.verdict === 'EGRESS-GEBLOKKEERD') reason = `EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten)`;
    else if (r.verdict === 'FOUT') reason = `FOUT (${r.error || 'status ' + r.status})`;
    md += `- **${r.name}** — ${reason} — \`${r.testedUrl}\`\n`;
  }

  writeFileSync(join(__dirname, 'verificatie-resultaten.md'), md);
}

// Alleen draaien wanneer direct aangeroepen (node check-topic-indexes.mjs),
// niet wanneer geïmporteerd voor tests.
const invokedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((e) => {
    console.error('Fataal:', e);
    process.exit(1);
  });
}

// Export van pure helpers t.b.v. tests.
export {
  analyzeXml,
  isArchiveSlug,
  isNavText,
  isBlocked,
  isEgressBlocked,
  verdictFor,
  slugToTopic,
  extractXmlTopics,
  extractHtmlTopics,
  extractJsonTopics,
  writeReport,
};
