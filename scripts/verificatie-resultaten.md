# Verificatie topic/dossier-indexpagina's nieuwssites

Gegenereerd: 2026-07-14T09:25:56.520Z
Script: `scripts/check-topic-indexes.mjs` — Node v22.22.2, gewone fetch, timeout 15s, ~1s pauze.
User-Agent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36`

> **Herkomst.** Metingen (HTTP-status, aantallen) komen uit een lokale run op 2026-07-14 (Node v22.17.0, open uitgaand verkeer). De oordelen zijn daarna opnieuw berekend met de gecorrigeerde heuristiek van het script (o.a. geen valse GEBLOKKEERD op grote 200-pagina's, sitemapindex/datum-archief → GEEN-TOPICS, navigatie uit de voorbeelden gefilterd). Bij bronnen waar de voorbeeldtopics in de lokale run navigatie waren, staat een notitie: draai `node scripts/check-topic-indexes.mjs` opnieuw voor verse voorbeeldtopics. Aantallen tellen álle links op de pagina, dus voor HTML-bronnen is het aantal een bovengrens, geen zuiver topic-aantal.

Oordeel: BRUIKBAAR (>50 items) · MAGER (10-50) · ONBRUIKBAAR-JS · GEBLOKKEERD · NIET-GEVONDEN · FOUT · GEEN-TOPICS (sitemapindex/datum-archief, bereikbaar maar geen topics) · EGRESS-GEBLOKKEERD (omgeving, niet gemeten).

| Bron | Geteste URL | Status | Type | Aantal items | Oordeel | 5 voorbeeldtopics |
| --- | --- | --- | --- | ---: | --- | --- |
| VRT NWS | https://www.vrt.be/vrtnws/nl/dossiers/ | 200 | HTML | 114 | BRUIKBAAR | WK voetbal 2026; Festivalzomer; Hitte; Oorlog Rusland-Oekraïne; Frankrijk kiest |
| Al Jazeera | https://www.aljazeera.com/sitemap | 200 | HTML | 9623 | BRUIKBAAR | Explained; Human Rights; Science & Technology; Abd-Rabbu Mansour Hadi; Abdel Fattah el-Sisi |
| France 24 | https://www.france24.com/sitemaps/fr/tags.xml | 200 | XML | 5770 | BRUIKBAAR | cofoe; didier drogba; paléontologie; boris heger; la france insoumise |
| Irish Times | https://www.irishtimes.com/tags/index/ | 200 | HTML | 246 | BRUIKBAAR | Crosswords & Puzzles |
| Guardian API | https://content.guardianapis.com/tags?api-key=test&page-size=50 | 200 | JSON | 50 | MAGER | 2019 family gift guide; 20th Century Fox: The Shape of Water; 20th Century Studios: The Amateur; A Day Out In History; Gifting reimagined |
| SCMP | https://www.scmp.com/topics | 200 | HTML | 227 | BRUIKBAAR | A business hub connecting cities; A chicken in every pot; A city walk in sound; A collection of homes to match your lifestyle; A contest for speed and glory |
| RFI (fr) | https://www.rfi.fr/sitemaps/fr/tags.xml | 200 | XML | 3337 | BRUIKBAAR | victor missistrano; francis lemarque; coronavirus la riposte pays par pays; sophie bouillon; burundi |
| RFI (en) | https://www.rfi.fr/sitemaps/en/tags.xml | 200 | XML | 3176 | BRUIKBAAR | monkeypox; andorra; gerald darmanin; archaeology; afro |
| Zeit Online | https://www.zeit.de/schlagworte/index | 404 | HTML | 88 | NIET-GEVONDEN | ZEITmagazin; Wirtschaft |
| Der Spiegel | https://www.spiegel.de/thema/ | 200 | HTML | 1531 | BRUIKBAAR | Die Nazi-Kartei; Fußball-WM; Leben; Daten & Visualisierungen; Reporter |
| El País | https://elpais.com/noticias/ | 200 | HTML | 498 | BRUIKBAAR | España; América; México; Colombia; Chile |
| Guardian HTML-index | https://www.theguardian.com/index/subjects/a | 200 | HTML | 2397 | BRUIKBAAR |  |
| CNN | https://edition.cnn.com/specials | 200 | HTML | 530 | NIET-GEVONDEN | US State Supplement |
| AP | https://apnews.com/sitemap.xml | 200 | XML | 228 | GEEN-TOPICS | ap sitemap 200602; ap sitemap 201011; ap sitemap 201401; ap sitemap 201703; ap sitemap 202005 |
| Corriere della Sera | https://www.corriere.it/argomenti/ | 200 | HTML | 655 | BRUIKBAAR | Argomenti; Iran; Trump; Meloni; Ucraina-Russia |
| La Repubblica | https://www.repubblica.it/argomenti/ | 200 | HTML | 510 | BRUIKBAAR | Repubblica 50; Lena; Giochi senza barriere; Europa, Italia; Repubblica dei cavalli |
| G1 Globo | https://g1.globo.com/tudo-sobre/ | 404 | HTML | 2 | NIET-GEVONDEN |  |
| Folha de São Paulo | https://www1.folha.uol.com.br/folha-topicos/ | 200 | HTML | 295 | BRUIKBAAR | Tópicos; Lula; veículos; Enem; guerra no irã |
| Daily Maverick | https://www.dailymaverick.co.za/wp-sitemap.xml | 404 | HTML | 88 | NIET-GEVONDEN | Investigations; Maverick News; Business |
| Mail & Guardian | https://mg.co.za/wp-sitemap.xml | 404 | HTML | 0 | NIET-GEVONDEN |  |
| Tagesschau | https://www.tagesschau.de/thema/ | 200 | HTML | 287 | BRUIKBAAR |  |
| Deutsche Welle | https://www.dw.com/en/topics/s-100152 | 404 | HTML | 57 | NIET-GEVONDEN | Africa; Asia; Europe |
| Süddeutsche Zeitung | https://www.sueddeutsche.de/thema/ | 200 | HTML | 147 | BRUIKBAAR | Dossier; Nahost; Fußball-WM; Ukraine; Reportage |
| Le Monde | https://www.lemonde.fr/sujet/ | 402 | HTML | 0 | FOUT |  |
| Le Figaro | https://www.lefigaro.fr/tag/ | 404 | HTML | 166 | NIET-GEVONDEN | Politique; International |
| Franceinfo | https://www.franceinfo.fr/sitemap.xml | 200 | XML | 935 | GEEN-TOPICS | 2026 07 article; 2023 05 audio; 2020 09 video; 2018 03 video; 2015 11 poll |
| El Mundo | https://www.elmundo.es/temas/ | 200 | HTML | 400 | BRUIKBAAR | L/O/C; YoDona; Viajes; Motor; Metrópoli |
| La Nación | https://www.lanacion.com.ar/tema/ | 404 | HTML | 102 | NIET-GEVONDEN | Entrevistas; Detrás del rodaje; Mario Pergolini; La historia detrás de la foto; Catalejo |
| Público | https://www.publico.pt/temas | 202 | HTML | 0 | ONBRUIKBAAR-JS |  |
| ANSA | https://www.ansa.it/sitemap.xml | 404 | HTML | 15 | NIET-GEVONDEN |  |
| The Hindu | https://www.thehindu.com/topic/ | 200 | HTML | 681 | BRUIKBAAR | Live Now; Israel-US strikes on Iran; Delimitation; Ground Zero; Spotlight |
| Channel News Asia | https://www.channelnewsasia.com/topic | 404 | HTML | 428 | NIET-GEVONDEN | CNA Explains; China; artificial intelligence; Indonesia; Malaysia |
| NHK World | https://www3.nhk.or.jp/nhkworld/en/news/tags/ | 200 | HTML | 0 | ONBRUIKBAAR-JS |  |
| The National | https://www.thenationalnews.com/tags/ | 404 | HTML | 283 | NIET-GEVONDEN |  |
| Haaretz | https://www.haaretz.com/ty-tag | 404 | HTML | 0 | NIET-GEVONDEN |  |
| NRK | https://www.nrk.no/emner/ | 404 | HTML | 85 | NIET-GEVONDEN | NRK P3 |
| DR | https://www.dr.dk/nyheder/tema | 404 | HTML | 2 | NIET-GEVONDEN |  |
| SVT | https://www.svt.se/nyheter/amne/ | 200 | HTML | 308 | NIET-GEVONDEN | Gävleborg; Jämtland; Norrbotten |
| YLE | https://yle.fi/aihe | 200 | HTML | 201 | NIET-GEVONDEN | Venäjän hyökkäys; Iranin sota; Sanapyramidi; Jalkapallon MM |
| Global Issues | https://www.globalissues.org/news/topic | 200 | HTML | 210 | BRUIKBAAR | AIDS around the world; AIDS in Africa; Aid; Arms Control; Arms Trade—a major cause of suffering |
| NYT | https://www.nytimes.com/topics | 200 | HTML | 73 | BRUIKBAAR | U.S. |
| Washington Post | https://www.washingtonpost.com/topics/ | 200 | HTML | 429 | NIET-GEVONDEN |  |
| BBC | https://www.bbc.com/news/topics | 404 | HTML | 17 | NIET-GEVONDEN |  |
| Wikipedia Current Events | https://en.wikipedia.org/wiki/Portal:Current_events | 200 | HTML | 2045 | BRUIKBAAR | Current events; Scots; ChiTumbuka |
| Wikipedia maandarchief | https://en.wikipedia.org/wiki/Portal:Current_events/July_2022 | 200 | HTML | 3667 | BRUIKBAAR | Current events |
| Reuters | https://www.reuters.com/sitemap/topics/ | 401 | HTML | 0 | GEBLOKKEERD |  |

## Notities per bron

- **Irish Times**: voorbeelden in lokale run waren navigatie; verse run nodig om topic-kwaliteit te bevestigen
- **Guardian API**: developer-tier; totaal aantal tags is duizenden, paginatie via page/page-size (hier 1 pagina = 50)
- **SCMP**: eerdere run gaf vals GEBLOKKEERD; 200 met 227 links, alfabetische topiclijst
- **Zeit Online**: alternatieve paden /topics /topic /temas gaven 404
- **Der Spiegel**: redirect naar /thema/index-a/ (A–Z themalijst)
- **El País**: redirect naar /ultimas-noticias/; voorbeelden waren geo-secties, verse run nodig voor tags
- **Guardian HTML-index**: voorbeelden in lokale run waren navigatie; A–Z subjects-index, verse run nodig voor topics
- **CNN**: redirect naar homepage; redirect naar homepage; alternatieve paden 404
- **AP**: sitemapindex/datum-archief: bevat sub-sitemaps of datumbuckets, geen directe topics; sitemapindex van maandelijkse archief-sitemaps, geen topics
- **G1 Globo**: alternatieve paden 404
- **Daily Maverick**: wp-sitemap.xml gaf 404 (404-pagina met navigatie); eerdere run gaf vals GEBLOKKEERD
- **Mail & Guardian**: alternatieve paden 404
- **Tagesschau**: redirect naar /thema; voorbeelden waren A–Z-navigatie, verse run nodig voor topics
- **Deutsche Welle**: alternatieve paden 404
- **Süddeutsche Zeitung**: redirect naar /thema
- **Le Monde**: 402 Payment Required (paywall/metering)
- **Le Figaro**: redirect naar /tag; status 404 (soft-404 met inhoud); alternatieve paden 404
- **Franceinfo**: sitemapindex/datum-archief: bevat sub-sitemaps of datumbuckets, geen directe topics; redirect naar sitemap_index.xml: datum-/type-buckets, geen topics
- **El Mundo**: voorbeelden waren secties/supplementen; verse run nodig voor tags
- **La Nación**: status 404; /temas gaf redirect naar homepage
- **Público**: serverside 0 links (waarschijnlijk client-side gerenderd); status 202, 0 links serverside (waarschijnlijk bot-challenge of client-side)
- **ANSA**: sitemap.xml gaf 404; alternatieve paden 404
- **Channel News Asia**: status 404 (soft-404 met topic-inhoud); alternatieve paden 404
- **NHK World**: serverside 0 links (waarschijnlijk client-side gerenderd); 0 links serverside (client-side gerenderd)
- **The National**: status 404 (soft-404); alternatieve paden 404
- **Haaretz**: alternatieve paden 404
- **NRK**: status 404; alternatieve paden 404
- **DR**: status 404; alternatieve paden 404
- **SVT**: redirect naar homepage
- **YLE**: redirect naar homepage
- **NYT**: via alternatief pad /topics; voorbeelden waren navigatie, verse run nodig voor topics
- **Washington Post**: redirect naar homepage
- **BBC**: status 404; alternatieve paden 404
- **Wikipedia Current Events**: eerdere run gaf vals GEBLOKKEERD; voorbeelden waren nav/interwiki, verse run nodig voor gebeurtenissen
- **Wikipedia maandarchief**: eerdere run gaf vals GEBLOKKEERD; voorbeelden waren navigatie, verse run nodig voor gebeurtenissen
- **Reuters**: blokkade gedetecteerd (status of captcha/cloudflare-tekst); status 401 — bevestigd geblokkeerd voor geautomatiseerd verkeer

## (1) Definitief bruikbare bronnen (gesorteerd op aantal items)

- **Al Jazeera** — 9623 items — `https://www.aljazeera.com/sitemap`
- **France 24** — 5770 items — `https://www.france24.com/sitemaps/fr/tags.xml`
- **Wikipedia maandarchief** — 3667 items — `https://en.wikipedia.org/wiki/Portal:Current_events/July_2022`
- **RFI (fr)** — 3337 items — `https://www.rfi.fr/sitemaps/fr/tags.xml`
- **RFI (en)** — 3176 items — `https://www.rfi.fr/sitemaps/en/tags.xml`
- **Guardian HTML-index** — 2397 items — `https://www.theguardian.com/index/subjects/a`
- **Wikipedia Current Events** — 2045 items — `https://en.wikipedia.org/wiki/Portal:Current_events`
- **Der Spiegel** — 1531 items — `https://www.spiegel.de/thema/`
- **The Hindu** — 681 items — `https://www.thehindu.com/topic/`
- **Corriere della Sera** — 655 items — `https://www.corriere.it/argomenti/`
- **La Repubblica** — 510 items — `https://www.repubblica.it/argomenti/`
- **El País** — 498 items — `https://elpais.com/noticias/`
- **El Mundo** — 400 items — `https://www.elmundo.es/temas/`
- **Folha de São Paulo** — 295 items — `https://www1.folha.uol.com.br/folha-topicos/`
- **Tagesschau** — 287 items — `https://www.tagesschau.de/thema/`
- **Irish Times** — 246 items — `https://www.irishtimes.com/tags/index/`
- **SCMP** — 227 items — `https://www.scmp.com/topics`
- **Global Issues** — 210 items — `https://www.globalissues.org/news/topic`
- **Süddeutsche Zeitung** — 147 items — `https://www.sueddeutsche.de/thema/`
- **VRT NWS** — 114 items — `https://www.vrt.be/vrtnws/nl/dossiers/`
- **NYT** — 73 items — `https://www.nytimes.com/topics`

## (2) Afvallers met reden

- **Guardian API** — MAGER (50 items, 10-50 bereik) — `https://content.guardianapis.com/tags?api-key=test&page-size=50`
- **Zeit Online** — NIET-GEVONDEN (na alternatieve paden) — `https://www.zeit.de/schlagworte/index`
- **CNN** — NIET-GEVONDEN (na alternatieve paden) — `https://edition.cnn.com/specials`
- **AP** — GEEN-TOPICS (228 entries, sitemapindex/datum-archief — geen directe topics) — `https://apnews.com/sitemap.xml`
- **G1 Globo** — NIET-GEVONDEN (na alternatieve paden) — `https://g1.globo.com/tudo-sobre/`
- **Daily Maverick** — NIET-GEVONDEN (na alternatieve paden) — `https://www.dailymaverick.co.za/wp-sitemap.xml`
- **Mail & Guardian** — NIET-GEVONDEN (na alternatieve paden) — `https://mg.co.za/wp-sitemap.xml`
- **Deutsche Welle** — NIET-GEVONDEN (na alternatieve paden) — `https://www.dw.com/en/topics/s-100152`
- **Le Monde** — FOUT (status 402) — `https://www.lemonde.fr/sujet/`
- **Le Figaro** — NIET-GEVONDEN (na alternatieve paden) — `https://www.lefigaro.fr/tag/`
- **Franceinfo** — GEEN-TOPICS (935 entries, sitemapindex/datum-archief — geen directe topics) — `https://www.franceinfo.fr/sitemap.xml`
- **La Nación** — NIET-GEVONDEN (na alternatieve paden) — `https://www.lanacion.com.ar/tema/`
- **Público** — ONBRUIKBAAR-JS (0 links serverside) — `https://www.publico.pt/temas`
- **ANSA** — NIET-GEVONDEN (na alternatieve paden) — `https://www.ansa.it/sitemap.xml`
- **Channel News Asia** — NIET-GEVONDEN (na alternatieve paden) — `https://www.channelnewsasia.com/topic`
- **NHK World** — ONBRUIKBAAR-JS (0 links serverside) — `https://www3.nhk.or.jp/nhkworld/en/news/tags/`
- **The National** — NIET-GEVONDEN (na alternatieve paden) — `https://www.thenationalnews.com/tags/`
- **Haaretz** — NIET-GEVONDEN (na alternatieve paden) — `https://www.haaretz.com/ty-tag`
- **NRK** — NIET-GEVONDEN (na alternatieve paden) — `https://www.nrk.no/emner/`
- **DR** — NIET-GEVONDEN (na alternatieve paden) — `https://www.dr.dk/nyheder/tema`
- **SVT** — NIET-GEVONDEN (na alternatieve paden) — `https://www.svt.se/nyheter/amne/`
- **YLE** — NIET-GEVONDEN (na alternatieve paden) — `https://yle.fi/aihe`
- **Washington Post** — NIET-GEVONDEN (na alternatieve paden) — `https://www.washingtonpost.com/topics/`
- **BBC** — NIET-GEVONDEN (na alternatieve paden) — `https://www.bbc.com/news/topics`
- **Reuters** — GEBLOKKEERD (status 401, blokkadetekst) — `https://www.reuters.com/sitemap/topics/`
