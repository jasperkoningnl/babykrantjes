# Contentbibliotheek: review en uitgevoerd fundament

Review door Codex, 5 september 2026. De opdrachtgever heeft het beperkte
nieuwsfundament expliciet goedgekeurd: bouwen en testen, geen productiemigratie.
Dit is geen review door Claude en geen akkoord op de volledige uitrol.

## Advies over de aanpak

De scheiding tussen gedeelde artikelen, revisies en privékranten is goed.
Voer eerst nieuws uit; cultuur, personen, suggesties en krantmigratie tegelijkertijd
bouwen maakt de eerste stap onnodig groot. De belangrijkste aanpassingen zijn:

1. **Wachten op een generatiejob is niet wachten op publicatie.** Een nieuwe
   AI-revisie gaat naar `needs_review`. Een klantverzoek mag niet op menselijke
   review blijven wachten. Fase 2 moet bij een ontbrekende publicatie de bestaande
   private generatie gebruiken, met begrensde wachttijd. Een job in de achtergrond
   levert pas na review centrale content op. Dit kan tijdelijk extra kosten geven.
2. **De gepubliceerde revisie staat los van het nieuwe concept.**
   `current_revision_id` verwijst uitsluitend naar een gepubliceerde revisie van
   hetzelfde artikel. Een nieuwe revisie in review verbergt de vorige publicatie
   niet. Gebruik later een afzonderlijk bewerkbaar concept voor redactiewerk;
   voltooide revisies worden niet overschreven.
3. **Exactly-once modeluitvoering is niet gegarandeerd.** Een lease met uniek token
   voorkomt dat een verlopen worker nog schrijft. Na een timeout kan een provider
   wel twee keer zijn aangeroepen. De garantie is één geaccepteerd resultaat per
   job, niet één betaalde modelcall. Neem provider-idempotentie en een kostenlimiet
   mee zodra de worker bestaat.
4. **Begin niet met 60 dagen ongecontroleerde AI-productie.** Valideer eerst enkele
   datums en de redactiewerklast. Start daarna de begrensde 60-dagenbootstrap met
   expliciet budget en stopmechanisme. Meerdere modellen zijn geen vervanging
   voor onafhankelijke primaire bronnen.

## Antwoorden op de tien reviewvragen

1. De tabelgrenzen zijn bruikbaar. Ontbrekende relaties: artikeltype bij detailtabel,
   revisie-eigenaarschap bij de publicatiepointer, en een kalenderdagsleutel voor
   het daadwerkelijke `born_on_day`-artikel (selecties van personen alleen zijn
   onvoldoende). Die laatste relatie hoort bij de latere namenfase.
2. Eén revisielaag voorkomt duplicatie. Alleen `articles`, `article_revisions`,
   `news_articles`, `content_jobs` en `article_publications` zijn nu gebouwd.
   Bronnen worden onveranderlijk per revisie opgeslagen; een extra muteerbare
   bronnentabel is voor deze eerste stap niet nodig. Een latere index op bronnen
   kan naar revisies verwijzen zodat historische herkomst behouden blijft.
3. Maak eerst artikelen en revisies aan; voeg daarna een samengestelde FK
   `(id, current_revision_id) -> (article_id, id)` toe. Publicatie vergrendelt
   het artikel en wijzigt revisiestatus, pointer en auditlog in één transactie.
   De redacteur moet de verwachte huidige revisie meegeven; stale publicaties falen.
4. Een unieke `(job_type, content_key)` dedupliceert aanvragen. Claims gebruiken
   `FOR UPDATE SKIP LOCKED`, maximaal drie pogingen, een lease van standaard
   vijf minuten, tokencontrole en oplopende retryvertraging. Expiratie bij de
   laatste poging eindigt als `failed`. Een afgeronde job wordt niet automatisch
   heropend. Handmatige regeneratie met reden is bewust een latere uitbreiding.
5. Suggesties zijn uitgesteld. Ontwerp straks een begrensd formulier met expliciete
   toestemming, tekstversie van de toestemming en een serverdatum. Neem geen
   volledige klanttekst, babygegevens of e-mail over in centrale artikelen of logs.
   Bepaal vóór activering bewaartermijn, verwijdering en beheerrechten. Dit zijn
   ontwerpvoorstellen; de juridische grondslag is hiermee niet vastgesteld.
6. Iedere gegenereerde revisie vereist bronobjecten met naam en HTTP(S)-URL.
   Modellen horen in `generation_metadata`. URL-validatie bewijst geen juistheid:
   de redacteur moet inhoud, publicatiedatum en onafhankelijke herkomst controleren.
   Een latere fetcher moet bovendien SSRF-bescherming hebben.
7. Er is nu geen krantmigratie. Later geldt per sectie: `original_body` uit
   `generated_articles`, `customer_body` uit `manual_edits` als die sleutel bestaat
   (ook bij lege tekst), anders uit origineel. Ondersteun string én `{text}`-vorm;
   tel verschillen en vergelijk snapshots vóór omschakeling. Overschrijf bestaande
   `paper_articles` niet bij herhaalde backfill. Bewaar de oude kolommen voor rollback.
8. Stel cultuur, personen, suggesties, cron, bulkimport, admin-UI en definitieve
   krantsnapshots uit. Adminauth moet eerst server-side worden vastgesteld,
   bijvoorbeeld Supabase Auth met een beheerderslijst die klanten niet kunnen wijzigen.
   De huidige gastensessie is geen beheerdersauthenticatie.
9. Reken met metingen, niet alleen tekstgrootte: 365 nieuwsartikelen × 3 revisies ×
   bijvoorbeeld 20 KB aan tekst/feiten/bronnen is circa 22 MB ruwe payload, exclusief
   indexen, TOAST, MVCC en overige content. Dit is een scenario, geen meting.
   De meeste groei komt later mogelijk uit foto's, krantstate en bronsnapshots.
10. Blokkerend voor live-integratie: concurrency op echte PostgreSQL, previewtests
    met daadwerkelijke Supabase-rollen/PostgREST, adminauth, kostenbegrenzing,
    fallback bij reviewachterstand, behoud van klantbewerkingen en rollback van de
    flag. Bestelimmutabiliteit moet vóór checkoutintegratie getest en afgedwongen zijn.

De locking-aanpak volgt de [PostgreSQL-documentatie over SELECT en SKIP LOCKED](https://www.postgresql.org/docs/current/sql-select.html).
De interne functies gebruiken `SECURITY INVOKER`, een lege `search_path` en expliciete
rechten volgens de [Supabase-documentatie over databasefuncties](https://supabase.com/docs/guides/database/functions).

## Databronnen: gecontroleerd maar geen algemene importvrijgave

De [Meertens-FAQ](https://nvb.meertens.knaw.nl/veelgesteldevragen) biedt een
downloadbare lijst van veelvoorkomende eerste voornamen uit 2017 en vraagt bij
presentatie elders bronvermelding met link. Dat is bruikbaar als historische
kandidaatbron, maar bewijst geen algemene toestemming om betekenisartikelen te
kopiëren, alles te scrapen of een commerciële AI-dataset te maken. De recente
top-50 vereist ook een actuele bron. Leg per concreet bestand de voorwaarden,
downloadversie, attributie en toegestane toepassing vast vóór namenimport.
Er is geen dataset geïmporteerd en geen toestemming namens de gebruiker aangevraagd.

## Overige repositorybevindingen

- Verholpen: de editor meldde succes vóór serverbevestiging en verwerkte HTTP-fouten
  als succes. Opslag wacht nu op bevestiging, verzoeken worden achter elkaar
  verzonden en fouten krijgen een herhaalknop. Ook na eerste automatische generatie
  worden bewerkingen nu opgeslagen. Meerdere tabbladen en serverrequests die ondanks
  een clienttimeout doorgaan, vereisen later server-side versiecontrole.
- Verholpen: kalenderberekeningen en datumlabels konden buiten de lokale tijdzone
  een dag verschuiven. Ze gebruiken nu UTC voor een datum zonder tijdstip.
- Toegevoegd: de overeengekomen waarschuwing bij **meer dan** 365 Nederlandse
  kalenderdagen, in wizard, editor en checkoutvoorbereiding.
- Bijgewerkt: kwetsbare ontwikkelafhankelijkheden `browserslist` en
  `postcss-selector-parser`, binnen hun bestaande versiegrenzen.
- Nog open: `getChineesJaar` gebruikt het kalenderjaar; Chinees nieuwjaar valt niet
  op 1 januari. Daarvoor is een gecontroleerde kalendertabel of bron nodig.
- Nog open: `.github/workflows/claude-auto-merge.yml` keurt `claude/*` automatisch
  goed en probeert direct te mergen. Deze wijziging gebruikt daarom `codex/*`.
  Wijzigingen aan het mergebeleid moeten afzonderlijk worden besloten.
- Nog open: de bestaande checkout noemt PDF en betalingen terwijl de echte
  order-/PDF-afhandeling nog niet bestaat. Deze PR bouwt dat niet.

## Uitrol en rollback

1. Review de nieuwe migratie en laat alle CI-jobs slagen, inclusief PostgreSQL.
2. Voer de migratie eerst in een wegwerp-/previewdatabase uit. Controleer RLS,
   RPC-rechten via PostgREST en Supabase advisors. Er is nog geen echte adminroute.
3. Laat de bestaande gebruikersflow intact; er zijn geen workers, cronjobs,
   modelcalls of backfills aangesloten. Alleen de waarschuwing en kleine fixes zijn
   direct bruikbaar na normale applicatiedeploy.
4. Een applicatierollback kan met de oude code; de nieuwe tabellen mogen blijven.
   Geen automatische DROP-rollback: die zou later redactionele historie verwijderen.
5. Beslis apart over fase 2: adminidentiteit, redactiescherm, kostenbudget, bronkeuze,
   kleine bootstrap en fallback. Activeer daarna shadow-read en pas vervolgens een flag.

## Tests

`npm test` voert de nieuwe migratie uit op PGlite (PostgreSQL in geheugen) en
controleert constraints, rollen, retries, immutable revisies, audit en publicatie.
PGlite serialiseert verbindingen; dat alleen bewijst geen echte workerconcurrency.
De aparte CI-job draait dezelfde suite met een pool van echte PostgreSQL 17-sessies.
Gebruik daarvoor alleen een lege wegwerpdatabase `babykrant_content_test` en
`CONTENT_TEST_DATABASE_URL`. De suite maakt tabellen aan en wist testrecords.
De bestaande productie- of previewdatabase mag hiervoor nooit worden gebruikt.
