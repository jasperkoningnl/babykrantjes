# Nieuwsredactie: geboortedagnieuws

Bijgewerkt op 6 september 2026. De twee databasemigraties zijn toegepast en beheerlogin is live.

## Redactionele formule

De beheerflow gebruikt dezelfde `buildPrompt('nieuws', ...)` en `SYSTEM_PROMPT` als de gewone geboortekrant:
- GPT-5.4 (`gpt-5.4-2026-03-05`) en Claude Sonnet 4.6 (`claude-sonnet-4-6`) verzamelen ieder met websearch de nieuwsfeiten via `gatherNewsFacts`.
- Claude Haiku 4.5 schrijft 200–280 woorden met 5–8 nieuwsitems, Nederlandse en internationale context, eventueel sport en een lichte afsluiting.
- De vaste openingszin begint met de geboorte. Geen rampen of doden als opening.
- De gedeelde tekst gebruikt [NAAM]. De individuele krant gebruikt de echte roepnaam; centrale publicaties zijn nog niet op klantgeneratie aangesloten.

De eerder toegevoegde losse NASA-voorbeeldberichten voldeden niet aan deze formule. Ze zijn afgekeurd en uit de actieve lijst gehaald, zonder de historie te wissen.

## Gebruik

Open een datum en klik op **Maak geboortedagnieuws voor deze datum**. Je hoeft vooraf geen feiten in te voeren. Na onderzoek en schrijven wordt het concept bewaard met modelnamen, gebruiksgegevens en bronverwijzingen. Een bestaand concept wordt niet overschreven. Controle en publicatie blijven afzonderlijke acties.

Beide onderzoekers moeten webcitaten leveren. Modeluitvoer is geen onafhankelijke bronverificatie. Controleer datum, feiten en de werkelijk geciteerde artikelen vóór publicatie. Ontbreekt een onderzoeker of levert die geen bronverwijzingen, dan wordt in de beheerproef niet geschreven. De cultuurmodellen zijn ongewijzigd.

## Budget en technische grenzen

`NEWS_PILOT_ENABLED=true` activeert de beheerproef. `ADMIN_EMAILS`, `NEXT_PUBLIC_SITE_URL`, Supabase, Redis, Resend, OpenAI en Anthropic moeten ingesteld zijn.

De database reserveert €1 per proefpoging, maximaal €5 totaal. Deze reservering omvat twee onderzoekers en één schrijver, en blijft staan bij mislukking of timeout. Geen automatische retries. Iedere onderzoeker krijgt maximaal twee zoekcalls; GPT-5.4 maximaal 4000 uitvoertokens inclusief reasoning, Sonnet maximaal 3000. Het schrijfmodel blijft Haiku 4.5 (`claude-haiku-4-5-20251001`) met maximaal 1500 uitvoertokens. Onderzoek heeft een timeout van 60 seconden per parallelle call; schrijven 45 seconden. De reservering is geen gemeten factuurbedrag.

Versiecontrole voorkomt overschrijven van gelijktijdige redactionele wijzigingen. Bij een opslagconflict blijft de nieuwe tekst beschikbaar in het formulier om te kopiëren. Modellen, onderzoeksuitvoer en verbruik worden bij een geslaagde generatie in het concept vastgelegd.

Nog niet geïmplementeerd: dagelijkse automatische vulling, de 60-dagenbootstrap, centrale hergebruikssnapshots in klantkranten en automatische inhoudelijke broncontrole. Dit beheerherstel verandert die klantflow niet.

## Validatie

Unit- en integratietests controleren auth, budget, het gebruik van de bestaande prompt, beide onderzoekers, opslag en het weigeren van onvolledig onderzoek. CI gebruikt PostgreSQL 17 en PostgREST voor database- en toegangscontroles. De echte proef moet aanvullend inhoudelijk beoordeeld worden.
