# Verificatie topic/dossier-indexpagina's nieuwssites

Gegenereerd: 2026-07-14T08:44:47.438Z
Script: `scripts/check-topic-indexes.mjs` — Node v22.22.2, gewone fetch, timeout 15s, ~1s pauze.
User-Agent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36`

Oordeel: BRUIKBAAR (>50 items) · MAGER (10-50) · ONBRUIKBAAR-JS · GEBLOKKEERD · NIET-GEVONDEN · FOUT · EGRESS-GEBLOKKEERD (omgeving, niet gemeten).

> ⚠️ **RUN ONGELDIG.** Van de 6 controlebronnen scoorde er 0 BRUIKBAAR. De controlegroep hoort altijd BRUIKBAAR te scoren; dat gebeurt hier niet.
>
> Oorzaak: de uitvoeromgeving hanteert een **network-egress-allowlist**. 46/46 hosts werden geweigerd met een melding als `Host not in allowlist: <host>. Add this host to your network egress settings to allow access.` Het verkeer bereikte de sites dus nooit — er zijn **geen echte site-oordelen** verkregen.
>
> **Oplossing:** draai dit script (a) op een machine/omgeving met open uitgaand verkeer, of (b) voeg de kandidaat-hosts toe aan de network-egress-instellingen van de omgeving en draai opnieuw. Zie https://code.claude.com/docs/en/claude-code-on-the-web (netwerkbeleid).

| Bron | Geteste URL | Status | Type | Aantal items | Oordeel | 5 voorbeeldtopics |
| --- | --- | --- | --- | ---: | --- | --- |
| VRT NWS | https://www.vrt.be/vrtnws/nl/dossiers/ | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |
| Al Jazeera | https://www.aljazeera.com/sitemap | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |
| France 24 | https://www.france24.com/sitemaps/fr/tags.xml | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |
| Irish Times | https://www.irishtimes.com/tags/index/ | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |
| Guardian API | https://content.guardianapis.com/tags?api-key=test&page-size=50 | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |
| SCMP | https://www.scmp.com/topics | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |
| RFI (fr) | https://www.rfi.fr/sitemaps/fr/tags.xml | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |
| RFI (en) | https://www.rfi.fr/sitemaps/en/tags.xml | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |
| Zeit Online | https://www.zeit.de/schlagworte/index | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |
| Der Spiegel | https://www.spiegel.de/thema/ | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |
| El Pais | https://elpais.com/noticias/ | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |
| Guardian HTML-index | https://www.theguardian.com/index/subjects/a | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |
| CNN | https://edition.cnn.com/specials | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |
| AP | https://apnews.com/sitemap.xml | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |
| Corriere della Sera | https://www.corriere.it/argomenti/ | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |
| La Repubblica | https://www.repubblica.it/argomenti/ | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |
| G1 Globo | https://g1.globo.com/tudo-sobre/ | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |
| Folha de Sao Paulo | https://www1.folha.uol.com.br/folha-topicos/ | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |
| Daily Maverick | https://www.dailymaverick.co.za/wp-sitemap.xml | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |
| Mail & Guardian | https://mg.co.za/wp-sitemap.xml | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |
| Tagesschau | https://www.tagesschau.de/thema/ | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |
| Deutsche Welle | https://www.dw.com/en/topics/s-100152 | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |
| Sueddeutsche Zeitung | https://www.sueddeutsche.de/thema/ | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |
| Le Monde | https://www.lemonde.fr/sujet/ | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |
| Le Figaro | https://www.lefigaro.fr/tag/ | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |
| Franceinfo | https://www.franceinfo.fr/sitemap.xml | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |
| El Mundo | https://www.elmundo.es/temas/ | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |
| La Nacion | https://www.lanacion.com.ar/tema/ | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |
| Publico | https://www.publico.pt/temas | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |
| ANSA | https://www.ansa.it/sitemap.xml | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |
| The Hindu | https://www.thehindu.com/topic/ | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |
| Channel News Asia | https://www.channelnewsasia.com/topic | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |
| NHK World | https://www3.nhk.or.jp/nhkworld/en/news/tags/ | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |
| The National | https://www.thenationalnews.com/tags/ | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |
| Haaretz | https://www.haaretz.com/ty-tag | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |
| NRK | https://www.nrk.no/emner/ | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |
| DR | https://www.dr.dk/nyheder/tema | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |
| SVT | https://www.svt.se/nyheter/amne/ | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |
| YLE | https://yle.fi/aihe | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |
| Global Issues | https://www.globalissues.org/news/topic | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |
| NYT | https://www.nytimes.com/topic/ | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |
| Washington Post | https://www.washingtonpost.com/topics/ | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |
| BBC | https://www.bbc.com/news/topics | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |
| Wikipedia Current Events | https://en.wikipedia.org/wiki/Portal:Current_events | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |
| Wikipedia maandarchief | https://en.wikipedia.org/wiki/Portal:Current_events/July_2022 | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |
| Reuters | https://www.reuters.com/sitemap/topics/ | 403 | HTML | 0 | EGRESS-GEBLOKKEERD |  |

## Notities per bron

- **VRT NWS**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)
- **Al Jazeera**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)
- **France 24**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)
- **Irish Times**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)
- **Guardian API**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)
- **SCMP**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)
- **RFI (fr)**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)
- **RFI (en)**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)
- **Zeit Online**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)
- **Der Spiegel**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)
- **El Pais**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)
- **Guardian HTML-index**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)
- **CNN**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)
- **AP**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)
- **Corriere della Sera**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)
- **La Repubblica**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)
- **G1 Globo**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)
- **Folha de Sao Paulo**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)
- **Daily Maverick**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)
- **Mail & Guardian**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)
- **Tagesschau**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)
- **Deutsche Welle**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)
- **Sueddeutsche Zeitung**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)
- **Le Monde**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)
- **Le Figaro**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)
- **Franceinfo**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)
- **El Mundo**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)
- **La Nacion**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)
- **Publico**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)
- **ANSA**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)
- **The Hindu**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)
- **Channel News Asia**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)
- **NHK World**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)
- **The National**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)
- **Haaretz**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)
- **NRK**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)
- **DR**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)
- **SVT**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)
- **YLE**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)
- **Global Issues**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)
- **NYT**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)
- **Washington Post**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)
- **BBC**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)
- **Wikipedia Current Events**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)
- **Wikipedia maandarchief**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)
- **Reuters**: omgeving-egress-allowlist weigerde de host — NIET gemeten, geen site-blokkade; blokkade gedetecteerd (status of captcha/cloudflare-tekst)

## (1) Definitief bruikbare bronnen (gesorteerd op aantal items)

_geen_

## (2) Afvallers met reden

- **VRT NWS** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://www.vrt.be/vrtnws/nl/dossiers/`
- **Al Jazeera** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://www.aljazeera.com/sitemap`
- **France 24** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://www.france24.com/sitemaps/fr/tags.xml`
- **Irish Times** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://www.irishtimes.com/tags/index/`
- **Guardian API** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://content.guardianapis.com/tags?api-key=test&page-size=50`
- **SCMP** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://www.scmp.com/topics`
- **RFI (fr)** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://www.rfi.fr/sitemaps/fr/tags.xml`
- **RFI (en)** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://www.rfi.fr/sitemaps/en/tags.xml`
- **Zeit Online** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://www.zeit.de/schlagworte/index`
- **Der Spiegel** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://www.spiegel.de/thema/`
- **El Pais** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://elpais.com/noticias/`
- **Guardian HTML-index** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://www.theguardian.com/index/subjects/a`
- **CNN** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://edition.cnn.com/specials`
- **AP** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://apnews.com/sitemap.xml`
- **Corriere della Sera** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://www.corriere.it/argomenti/`
- **La Repubblica** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://www.repubblica.it/argomenti/`
- **G1 Globo** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://g1.globo.com/tudo-sobre/`
- **Folha de Sao Paulo** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://www1.folha.uol.com.br/folha-topicos/`
- **Daily Maverick** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://www.dailymaverick.co.za/wp-sitemap.xml`
- **Mail & Guardian** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://mg.co.za/wp-sitemap.xml`
- **Tagesschau** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://www.tagesschau.de/thema/`
- **Deutsche Welle** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://www.dw.com/en/topics/s-100152`
- **Sueddeutsche Zeitung** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://www.sueddeutsche.de/thema/`
- **Le Monde** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://www.lemonde.fr/sujet/`
- **Le Figaro** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://www.lefigaro.fr/tag/`
- **Franceinfo** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://www.franceinfo.fr/sitemap.xml`
- **El Mundo** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://www.elmundo.es/temas/`
- **La Nacion** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://www.lanacion.com.ar/tema/`
- **Publico** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://www.publico.pt/temas`
- **ANSA** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://www.ansa.it/sitemap.xml`
- **The Hindu** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://www.thehindu.com/topic/`
- **Channel News Asia** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://www.channelnewsasia.com/topic`
- **NHK World** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://www3.nhk.or.jp/nhkworld/en/news/tags/`
- **The National** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://www.thenationalnews.com/tags/`
- **Haaretz** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://www.haaretz.com/ty-tag`
- **NRK** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://www.nrk.no/emner/`
- **DR** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://www.dr.dk/nyheder/tema`
- **SVT** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://www.svt.se/nyheter/amne/`
- **YLE** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://yle.fi/aihe`
- **Global Issues** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://www.globalissues.org/news/topic`
- **NYT** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://www.nytimes.com/topic/`
- **Washington Post** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://www.washingtonpost.com/topics/`
- **BBC** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://www.bbc.com/news/topics`
- **Wikipedia Current Events** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://en.wikipedia.org/wiki/Portal:Current_events`
- **Wikipedia maandarchief** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://en.wikipedia.org/wiki/Portal:Current_events/July_2022`
- **Reuters** — EGRESS-GEBLOKKEERD (omgeving-allowlist, host nooit bereikt — niet gemeten) — `https://www.reuters.com/sitemap/topics/`
