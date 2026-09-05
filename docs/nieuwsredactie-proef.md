# Nieuwsredactie: gecontroleerde proef

Deze stap bouwt beheerlogin, redactionele concepten en publicatie boven op het
nieuwsfundament. De opdrachtgever heeft een proefbudget van maximaal €5
goedgekeurd. Het beheerdersadres wordt uitsluitend in `ADMIN_EMAILS` ingesteld,
niet in de openbare repository.

## Wat werkt na configuratie

- `/admin/login`: inloggen via eenmalige e-maillink, verzonden via de bestaande
  Resend-koppeling. Alleen adressen in de serverinstelling `ADMIN_EMAILS` kunnen inloggen.
- De link werkt alleen in de aanvragende browser. Een bevestigingsknop voorkomt
  dat e-mailscanners de link opgebruiken. De sessie staat maximaal één uur in een
  Secure, HttpOnly-cookie; daarna wordt opnieuw ingelogd. Geen refresh-tokenopslag.
- Iedere beheerpagina en API controleert de identiteit bij Supabase Auth, inclusief
  bevestigde e-mail en allowlist. Gastensessies en clientmetadata geven geen beheerrechten.
- Nieuwsdatum openen, concepttekst en feiten bewerken, bronlinks bekijken/toevoegen,
  concept expliciet bewaren, huidige publicatie naast het concept lezen en publiceren.
- Concepten groeien niet bij iedere bewerking uit tot revisies. Publicatie legt
  tekst, feiten, bronnen, actor en reden in één transactie vast. Versiecontrole
  voorkomt overschrijven door een oud tabblad, ook na verwijderen van het concept.
- Een bestaande publicatie blijft beschikbaar terwijl een correctie wordt gemaakt.

## Grenzen van deze proef

De AI-knop schrijft alleen op basis van **aangeleverde gecontroleerde feiten**.
De bron-URL's worden niet automatisch bezocht; deze stap is geen voltooide
multi-model researchpipeline. De AI-uitvoer komt in het editorformulier en vereist
bewaren, broncontrole en expliciete publicatie. Er zijn nog geen cronjobs of
60-dagenbootstrap en de klantgeneratie gebruikt de centrale publicaties nog niet.

`NEWS_PILOT_ENABLED=true` activeert uitsluitend deze redactionele proefknop.
De database reserveert atomair €1 per poging, maximaal vijf pogingen totaal.
Ook mislukte of onzekere aanvragen houden hun reservering: een timeout kan nog
gefactureerd worden. Dit is een conservatieve reservering, geen gemeten factuur.
Het vaste model is Haiku 4.5, zonder tools of retries, met maximaal 30 KB invoer
en 1500 uitvoertokens. De [geverifieerde modeltarieven](https://platform.claude.com/docs/en/about-claude/pricing)
zijn $1 per miljoen invoertokens en $5 per miljoen uitvoertokens; deze kleine
aanroepen blijven ruim onder de reservering per poging. Verhoog of reset de teller
niet zonder nieuw budgetakkoord. De normale krantgeneratie heeft een ander budget.

## Configuratie en uitrol

1. Laat CI slagen. De wegwerpomgeving gebruikt PostgreSQL 17 en PostgREST 13.0.7,
   dezelfde API-techniek als de Supabase Data API. Ze controleert anonieme en
   ingelogde toegang en een service-role RPC naast concurrentie- en migratietests.
   Dit vervangt geen volledige test van gehoste Supabase Auth en e-mailbezorging.
2. Pas in de doelomgeving eerst `20260905101814_content_library_news_foundation.sql`
   toe als die ontbreekt, daarna `20260905115345_news_editorial_review.sql`.
   Voer niet alle oude migraties blind opnieuw uit: de bestaande productieomgeving
   heeft tabellen maar geen geregistreerde migratiehistorie.
3. Stel `ADMIN_EMAILS` op het opgegeven beheerdersadres in, controleer
   `NEXT_PUBLIC_SITE_URL` (canonieke HTTPS-origin), Supabase anon/service credentials,
   `RESEND_API_KEY`, Redis en `ANTHROPIC_API_KEY`.
4. Zet `NEWS_PILOT_ENABLED=true` pas na databasecontrole. Een nieuwe deploy is nodig
   om gewijzigde hostinginstellingen te laden. Test de echte inloglink voordat
   betaalde generatie wordt gebruikt. Verstuur geen testmails naar derden.
5. Start met één handmatig gecontroleerde datum. De volgende ontwikkeling is de
   automatische researchjob, vastlegging van AI-generatiemetadata en geflagd
   hergebruik in nieuwe kranten met bronrevisie-snapshots en bestaande fallback.

Rollback: zet `NEWS_PILOT_ENABLED=false` en verwijder de beheerallowlist om toegang
te stoppen. Oude applicatiecode werkt met de extra tabellen. Bewaar publicaties en
revisies; geen destructieve down-migratie.

## Geconstateerde omgeving

Op 5 september 2026 is alleen gelezen in het Supabase-project `babykrantjes`:
de nieuwe bibliotheektabellen ontbraken en er waren geen development branches.
De bestaande advisor meldde een veranderbare `search_path` op `set_updated_at`,
`pg_net` in public en publieke execute-rechten op `rls_auto_enable`. Dat zijn
bestaande meldingen en geen reden om server-only tabellen publiek leesbaar te maken.
Zie de [Supabase database-linter](https://supabase.com/docs/guides/database/database-linter)
voor de controles. De betreffende functies/extensie zijn in deze stap niet gewijzigd.
