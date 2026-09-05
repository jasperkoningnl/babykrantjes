# Implementatieplan: centrale contentbibliotheek

> **Status:** beperkt nieuws-fundament goedgekeurd door opdrachtgever op 5 september 2026; overige fases blijven voorstel. Zie [review en uitvoeringsstatus](contentbibliotheek-review.md). Productiemigratie niet uitgevoerd.
> **Doel:** gedeelde artikelen eenmalig genereren, redactioneel beheren en hergebruiken in babykranten.

## 1. Besluiten en afbakening

### Wel in deze verbouwing

- Nieuws centraal opslaan per geboortedatum.
- Starten met een gecontroleerde dataset van de laatste twee maanden.
- Daarna dagelijks het artikel voor gisteren toevoegen; zo groeit de dekking vanzelf naar een jaar.
- Voor oudere datums de bestaande Wayback/Wikipedia-route als on-demand fallback behouden.
- Cultuur centraal opslaan per week: muziek, films en streaming.
- Alleen een aanvullend datumgebonden cultuurevent opnemen als dat echt belangrijk is en niet al voldoende onder nieuws valt.
- Naambetekenissen en naamgenoten centraal opslaan per canonieke voornaam.
- Personen centraal registreren, zodat een nieuwe beroemdheid zowel naamgenoten als „geboren op deze dag” kan voeden.
- Gebruikerssuggesties na expliciete toestemming als redactioneel signaal verzamelen; nooit automatisch publiceren.
- Menselijke review, correctie, publicatie en revisiehistorie ondersteunen.
- Bij iedere definitieve krant vastleggen welke artikelversies en teksten zijn gebruikt.

### Niet in deze verbouwing

- Geen volledig historisch krantenarchief of volledige historische backfill.
- Geen overstap van Supabase/Postgres.
- Geen betaling, PDF- of orderimplementatie; het model moet daar wel later aan te koppelen zijn.
- Geen automatische centrale verwerking van vrije klantteksten.
- Geen revisie per autosave of toetsaanslag.
- Geen radio als verplicht cultuuronderdeel.

## 2. Gewenste gebruikersflow

1. De gebruiker vult de wizard in.
2. De server zoekt gepubliceerde gedeelde content voor datum, week, naam en kalenderdag.
3. Ontbrekende recente content krijgt atomair één generatiejob; gelijktijdige aanvragen wachten op dezelfde job.
4. Alleen persoonlijke secties worden per krant gegenereerd.
5. De krant bewaart bronrevisies én tekstsnapshots.
6. De gebruiker kan alle teksten aanpassen; die wijzigingen blijven privé bij de krant.
7. Een afzonderlijke, expliciete actie kan een toevoeging als redactionele suggestie insturen.

Voor een datum ouder dan 365 dagen tonen wizard en editor een waarschuwing:

> Let op: Babykrantje.nl is vooral gericht op recente geboortedata. Voor oudere datums zijn minder betrouwbare bronnen beschikbaar. We stellen de artikelen zo zorgvuldig mogelijk samen, maar er kunnen onjuistheden in staan. Controleer de teksten daarom extra goed; je kunt ze zelf aanpassen voordat je bestelt.

## 3. Datamodel

Gebruik gespecialiseerde domeintabellen met een gedeelde artikel- en revisielaag. Hiermee blijven constraints duidelijk, terwijl review en versiebeheer niet worden gedupliceerd.

### Gedeelde tabellen

#### `articles`

- `id uuid primary key`
- `article_type text` met checkconstraint: `news`, `culture`, `name_meaning`, `name_namesakes`, `born_on_day`
- `editorial_status text`: `draft`, `needs_review`, `approved`, `rejected`, `superseded`
- `current_revision_id uuid null`
- `created_at`, `updated_at`

#### `article_revisions`

- `id uuid primary key`
- `article_id uuid references articles(id)`
- `version integer`
- `body text`
- `facts_snapshot jsonb`
- `sources_snapshot jsonb`
- `generation_metadata jsonb` met modellen, promptversie, kosten en duur
- `change_summary text null`
- `created_by_type text`: `ai`, `editor`
- `created_at`, `reviewed_at`, `published_at`
- uniek op `(article_id, version)`

Alleen een afgeronde AI-generatie of expliciete redactionele publicatie maakt een revisie. Een onderhanden concept wordt bijgewerkt zonder revisies te stapelen.

#### `content_jobs`

- `id uuid primary key`
- `job_type`, `content_key`
- `status`: `queued`, `running`, `completed`, `failed`
- `attempts`, `last_error`, `available_at`, `locked_at`, `finished_at`
- `idempotency_key text unique`
- `created_at`, `updated_at`

#### `paper_articles`

- `paper_id uuid references generated_papers(id)`
- `section text`
- `source_revision_id uuid null references article_revisions(id)`
- `original_body text`
- `customer_body text`
- `customer_modified boolean`
- uniek op `(paper_id, section)`

Bij definitief maken of bestellen wordt de tekstsnapshot onveranderlijk. Een later gecorrigeerd centraal artikel verandert geen bestaande bestelling.

### Nieuws

#### `news_articles`

- `article_id uuid primary key references articles(id)`
- `news_date date unique`
- `coverage_tier`: `recent_week`, `recent_month`, `recent_year`, `historical_on_demand`
- `research_method`: bijvoorbeeld `multi_ai_recent` of `wayback_wikipedia`

#### `news_article_sources`

- `news_article_id`, `source_url`, `source_name`, `source_date`
- `title`, `excerpt` en `retrieved_at`
- modelnamen gelden als researchers, niet als primaire bronnen

### Cultuur

#### `culture_articles`

- `article_id uuid primary key references articles(id)`
- `week_start date unique`
- bevat het weekbeeld voor muziek, films en streaming

#### `culture_date_events`

- `id`, `event_date`, `title`, `description`, `category`
- `significance_score`, `sources jsonb`, `editorial_status`
- uniek op een genormaliseerde event-identiteit en datum

Een datum-event wordt alleen aan cultuur toegevoegd als het boven een ingestelde relevantiedrempel valt en niet onnodig dupliceert met nieuws.

### Namen en personen

#### `names`

- `id`, `canonical_name`, `normalized_name unique`
- `gender_usage`, `origin`, `meaning`, `variants jsonb`
- `source_data jsonb`, `facts_status`

#### `name_articles`

- `article_id uuid primary key references articles(id)`
- `name_id uuid references names(id)`
- `subtype`: `meaning` of `namesakes`
- uniek op `(name_id, subtype)`

#### `people`

- `id`, `canonical_name`, `normalized_name`
- `description`, `nationality`, `professions jsonb`
- `birth_date`, `death_date`, `source_data jsonb`
- `discovered_at`, `editorial_status`

#### `name_namesakes`

- `name_id`, `person_id`, `relevance_score`, `display_order`, `editorial_status`
- uniek op `(name_id, person_id)`

#### `born_on_day_selections`

- `month`, `day`, `person_id`
- `relevance_score`, `display_order`, `editorial_status`
- uniek op `(month, day, person_id)`

Eén nieuwe persoon kan zo tegelijk kandidaat zijn voor een naamgenotenartikel en het artikel van diens geboortedag.

### Suggesties van gebruikers

#### `editorial_suggestions`

- `id`, `paper_id`, `article_id null`
- `suggestion_type`, `candidate_name`, `suggested_value`, `source_url null`
- `consented_at`, `review_status`, `created_at`

Vrije klantteksten worden niet automatisch centraal geanalyseerd of gepubliceerd. De UI vraagt afzonderlijk toestemming om een specifieke toevoeging als suggestie te delen. Dubbele suggesties worden geaggregeerd in de beheeromgeving, bijvoorbeeld „drie suggesties voor dezelfde Joris in dertig dagen”.

## 4. Generatie- en reviewproces

### Nieuwsdekking

- Bootstrap: laatste 60 dagen genereren en reviewen.
- Dagelijks: controleer en genereer gisteren plus eventuele gaten in de laatste 7 dagen.
- Herstel: probeer gaten in de laatste 30 dagen opnieuw.
- Groei: geen directe jaarbackfill; dagelijkse productie bouwt vanzelf een jaar op.
- Ouder dan 365 dagen: genereer alleen bij aanvraag met Wayback/Wikipedia en bewaar het resultaat centraal.

### Cultuurdekking

- Wekelijks één artikel voor muziek, films en streaming genereren.
- Dagelijks alleen zoeken naar grote datumgebonden evenementen.
- Sport valt standaard onder nieuws; alleen uitzonderlijke collectieve kijkmomenten mogen cultuur aanvullen.
- Radio vervalt als verplicht onderdeel.

### Namenbootstrap

- Importeer eerst de 50 recent populairste en 50 historisch meest voorkomende namen per relevante lijst, ontdubbeld en met varianten.
- Verifieer vóór import de licentie, bronvermelding en hergebruikvoorwaarden van Meertens of een andere bron.
- Genereer naambetekenis en naamgenoten afzonderlijk en zet beide op `needs_review`.
- Een onbekende naam wordt on-demand eenmalig onderzocht, opgeslagen en aan de reviewwachtrij toegevoegd.

### Nieuwe beroemdheden ontdekken

- Jaarlijkse discoveryjob zoekt uitsluitend naar nieuwe relevante personen en nieuwe koppelingen; bestaande personen worden niet standaard volledig opnieuw onderzocht.
- Gebruikerssuggesties kunnen tussentijds een discovery/review triggeren.
- Een redacteur bepaalt of de nieuwe persoon wordt toegevoegd, iemand vervangt of onvoldoende relevant is.
- Na goedkeuring worden zowel betrokken naamgenoten- als kalenderdagartikelen als `needs_review` gemarkeerd voor een nieuwe revisie.

## 5. Aanpassingen aan de bestaande generatieflow

- Verwijder nieuws- en cultuurresearch uit de request van `/api/generate-paper`.
- Splits de huidige volledige acht-sectiecall op:
  - gedeelde secties komen uit gepubliceerde revisies;
  - persoonlijke secties worden per krant gegenereerd;
  - deterministische gegevens blijven codegedreven.
- Haal gedeelde tekst niet opnieuw door een algemeen taalmodel; dat kan goedgekeurde feiten wijzigen.
- Behoud `/api/generate-article` voor persoonlijke regeneratie en definieer apart gedrag voor gedeelde secties: maak een private klantvariant, maar overschrijf nooit de centrale tekst.
- Migreer bestaande conceptkranten zonder tekstverlies naar `paper_articles`.

## 6. Beheeromgeving

Maak een server-side beveiligde beheeromgeving, niet alleen afgeschermd via clientnavigatie.

Minimaal nodig:

- wachtrijen voor ontbrekende, mislukte en te reviewen content;
- artikeltekst naast feiten en primaire bronlinks;
- aanpassen, goedkeuren, afwijzen en publiceren;
- revisieverschil tonen;
- nieuwe-persoonkandidaten en geaggregeerde gebruikerssuggesties;
- handmatig opnieuw genereren met reden;
- auditlog van publicatiehandelingen.

## 7. Gefaseerde uitvoering

### Fase 0 — review en prototypebesluiten

- Claude reviewt dit plan, schema-integriteit, privacy, joblocking en migratierisico's.
- Beslis wie beheerder is en hoe adminauth werkt.
- Verifieer databronlicenties.
- Leg definitieve disclaimertekst en grens van 365 dagen vast.

**Exitcriterium:** plan goedgekeurd; nog geen productiedata gewijzigd.

### Fase 1 — fundament

- Migraties voor `articles`, revisies, jobs en gespecialiseerde tabellen.
- RLS/privileges: geen publieke writes; alleen serverjobs en geautoriseerde beheerder.
- Repositorylaag met transacties, constraints en idempotente jobclaims.
- Unit- en migratietests.

**Exitcriterium:** schema en jobmechanisme werken zonder wijziging aan de gebruikersflow.

### Fase 2 — nieuws als eerste vertical slice

- Centrale multi-AI research- en schrijfpipeline voor nieuws.
- Laatste 60 dagen als begrensde bootstrap.
- Dagelijkse cron, gap recovery en historische fallback.
- Beheerreview voor nieuws.
- `/api/generate-paper` leest centraal nieuws met tijdelijke fallback naar de oude flow.

**Exitcriterium:** dezelfde datum veroorzaakt maximaal één centrale generatie en meerdere kranten hergebruiken dezelfde revisie.

### Fase 3 — cultuur

- Wekelijkse cultuurpipeline en datum-eventcheck.
- Cultuurprompt aanpassen; radio en verplicht dagelijks tv-overzicht verwijderen.
- Beheerreview en deduplicatie met nieuws.
- Oude per-request cultuurresearch verwijderen zodra monitoring stabiel is.

### Fase 4 — namen en personen

- Namenimport na licentiecheck.
- Naambetekenis, personen, naamgenoten en kalenderselecties vullen.
- On-demand fallback voor onbekende namen.
- Jaarlijkse discovery en kruislingse updateworkflow.
- Expliciete gebruikerssuggestieflow.

### Fase 5 — volledige krantintegratie

- `paper_articles` invoeren en bestaande data migreren.
- Persoonlijke en gedeelde generatie definitief scheiden.
- Historische waarschuwing in wizard, editor en checkoutvoorbereiding.
- Revisies en snapshots koppelen aan definitieve kranten.
- Oude code alleen verwijderen na een meetbare stabiele periode en rollbacktest.

## 8. Opslag en retentie

- Geen revisie per autosave.
- Bewaar gepubliceerde revisies; beperk ongepubliceerde conceptrevisies tot bijvoorbeeld vijf.
- Verwijder volledige mislukte modelresponses en joblogs na een korte bewaartermijn; bewaar compacte foutmetadata.
- Meet tabel- en databasegrootte maandelijks met `pg_total_relation_size` en `pg_database_size`.
- Tekst is naar verwachting klein; foto's, gedupliceerde krantstate en onbeperkte logs zijn het grotere opslagrisico.
- Stel waarschuwingen in bij 50%, 75% en 90% van de beschikbare databasecapaciteit.

## 9. Teststrategie

- Migratietests voor foreign keys, unique constraints, checks en RLS.
- Concurrencytest: vijf aanvragen voor dezelfde datum leveren één job en één artikel op.
- Idempotentietests voor cron-retries en vastgelopen jobs.
- Selectietests voor weekgrenzen, tijdzone en 29 februari.
- Tests dat een centrale correctie bestaande definitieve kranten niet wijzigt.
- Tests dat klantwijzigingen nooit centraal publiceren.
- Tests voor toestemming, aggregatie en moderatie van suggesties.
- Fallbacktests voor ontbrekend recent nieuws, oude datums en onbekende namen.
- Kosten- en latencyvergelijking voor en na de migratie.

## 10. Uitrol, observability en rollback

- Gebruik featureflags per contenttype: `CENTRAL_NEWS`, `CENTRAL_CULTURE`, `CENTRAL_NAMES`.
- Eerst shadow-read: centrale content ophalen en vergelijken zonder haar aan klanten te tonen.
- Daarna een klein percentage of alleen beheertests activeren.
- Meet cache-hitratio, jobs per sleutel, kosten per krant, foutpercentages, reviewachterstand en fallbackgebruik.
- Houd de bestaande generatiepaden tijdelijk beschikbaar als rollback.
- Verwijder oude paden pas na geslaagde migratie, stabiele monitoring en expliciete goedkeuring.

## 11. Reviewvragen voor Claude

Claude moet vóór implementatie expliciet antwoorden op:

1. Zijn de tabelgrenzen en foreign keys logisch, of ontbreekt een belangrijke domeinrelatie?
2. Is `articles` plus gespecialiseerde detailtabellen eenvoudiger en veiliger dan volledig losse revisietabellen?
3. Hoe moet `current_revision_id` transactioneel en zonder circulaire migratieproblemen worden beheerd?
4. Is de jobclaim veilig bij gelijktijdige serverless workers en retries?
5. Welke persoonsgegevens mogen in suggesties staan en welke toestemming/retentie is nodig?
6. Hoe voorkomen we dat bron- of modeloutput ongecontroleerd als primaire bron wordt gepresenteerd?
7. Hoe migreren we `generated_articles` en `manual_edits` zonder bestaande concepten te breken?
8. Welke delen zijn te complex voor de eerste vertical slice en kunnen veilig worden uitgesteld?
9. Welke databasegroei en indexkosten verwacht Claude bij één jaar content en de eerste klantvolumes?
10. Welke ontbrekende tests of rollbackscenario's zijn launch-blockers?

## 12. Voorwaarden om te starten

Er wordt pas geïmplementeerd nadat:

- Claude schriftelijk reviewcommentaar heeft gegeven;
- open ontwerpvragen expliciet zijn besloten;
- databronvoorwaarden zijn gecontroleerd;
- de migratie- en rollbackstrategie is goedgekeurd;
- fase 2 als kleine end-to-end vertical slice is afgebakend.

