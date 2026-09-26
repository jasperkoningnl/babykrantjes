# Redactie: nieuws en cultuur via Claude

Nieuws (per dag) en cultuur (per week) worden niet meer per krant door een API onderzocht en geschreven. Claude-taken in Cowork schrijven ze vooraf en publiceren ze in de database. Je leest en stuurt bij in de chat van die taak. De klantkrant haalt de gepubliceerde tekst op en vult `[NAAM]` in.

OpenAI schrijft alleen nog de persoonlijke secties: hoofdartikel, horoscoop, weer, naambetekenis, naamgenoten en geboren op deze dag.

## Onderdelen

- `app/api/redactie/[sleutel]`: een MCP-connector met vier tools (`overzicht`, `lees_artikel`, `publiceer_artikel`, `stijlvoorbeelden`). Zonder de juiste sleutel geeft de route een 404.
- `supabase/migrations/20260926190000_redactie_connector.sql`: de cultuurtabel per week en de functies om te lezen en direct te publiceren. Eerdere versies blijven bewaard.
- `lib/contentLibrary.ts`: leest de gepubliceerde tekst voor de klantkrant.
- Instructies voor Claude:
  - [projectinstructies.md](projectinstructies.md): de redactieregels voor het Cowork-project.
  - [taak-nieuws.md](taak-nieuws.md): de dagelijkse nieuwstaak.
  - [taak-cultuur.md](taak-cultuur.md): de dagelijkse controle van het cultuurartikel.
  - [terugvullen.md](terugvullen.md): een eenmalige prompt om een periode terug te vullen.

## Eenmalig instellen

1. **Database.** Voer `supabase/migrations/20260926190000_redactie_connector.sql` uit in de Supabase SQL-editor.
2. **Sleutel.** Maak in Vercel de omgevingsvariabele `REDACTIE_SLEUTEL` aan, voor Production. Gebruik een willekeurige reeks van minstens 32 letters en cijfers, bijvoorbeeld uit je wachtwoordmanager. Deploy daarna opnieuw.
3. **Connector.** Ga in Claude naar [Customize → Connectors](https://claude.ai/customize/connectors), klik op "+" en kies "Add custom connector".
   - Naam: `Babykrantje redactie`
   - URL: `https://babykrant-claude.vercel.app/api/redactie/<REDACTIE_SLEUTEL>`, of je eigen domein.
   - Laat de OAuth-velden leeg.
   - Wie deze URL heeft, kan publiceren. Deel hem dus niet. Heb je hem toch gedeeld, maak dan een nieuwe sleutel aan en werk de URL bij.
4. **Cowork-project.** Maak een project "Babykrantje redactie" aan en plak [projectinstructies.md](projectinstructies.md) in de instructies. Zet de connector aan.
5. **Taken.** Maak in dat project twee geplande taken aan, elk dagelijks en zonder lokale map, zodat ze in de cloud draaien:
   - "Nieuws van gisteren", rond 07:10, met [taak-nieuws.md](taak-nieuws.md) als instructie;
   - "Cultuur van deze week", rond 07:40, met [taak-cultuur.md](taak-cultuur.md) als instructie.
6. **OpenAI.** Zet de OpenAI-sleutel weer aan (`OPENAI_API_KEY`). Die is nog nodig voor de persoonlijke secties.

## Terugvullen

Start een losse taak of sessie met [terugvullen.md](terugvullen.md) en vul de periode in, bijvoorbeeld één week per keer. De connector werkt ook in Claude Code en de gewone chat.

## Als iets ontbreekt

Ontbreekt het nieuws of de cultuurweek voor een geboortedatum, dan blijft die sectie leeg en kan de klant hem zelf invullen. Er is geen AI-terugvaloptie. De knop "opnieuw" haalt de actuele versie uit de bibliotheek, zonder kosten.
