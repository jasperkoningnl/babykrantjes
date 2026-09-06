# Nieuwsredactie: geboortedagnieuws

Bijgewerkt op 6 september 2026. De twee databasemigraties zijn toegepast en beheerlogin is live.

## Redactionele formule

De beheerflow gebruikt dezelfde `buildPrompt('nieuws', ...)` en `SYSTEM_PROMPT` als de gewone geboortekrant:
- ChatGPT met websearch en Claude leveren feiten via de bestaande `gatherNewsFacts`.
- Claude Haiku 4.5 schrijft 200–280 woorden met 5–8 nieuwsitems, Nederlandse en internationale context, eventueel sport en een lichte afsluiting.
- De vaste openingszin begint met de geboorte. Geen rampen of doden als opening.
- De gedeelde tekst gebruikt [NAAM]. De individuele krant gebruikt de echte roepnaam; centrale publicaties zijn nog niet op klantgeneratie aangesloten.

De eerder toegevoegde losse NASA-voorbeeldberichten voldeden niet aan deze formule. Ze zijn afgekeurd en uit de actieve lijst gehaald, zonder de historie te wissen.

## Gebruik

Open een datum en klik op **Maak geboortedagnieuws voor deze datum**. Je hoeft vooraf geen feiten in te voeren. Na onderzoek en schrijven wordt het concept bewaard met modelnamen, gebruiksgegevens en bronverwijzingen. Een bestaand concept wordt niet overschreven. Controle en publicatie blijven afzonderlijke acties.

ChatGPT levert webcitaten; Claude gebruikt in de bestaande onderzoeksmethode modelkennis. Modeluitvoer is geen onafhankelijke bronverificatie. Controleer datum, feiten en de werkelijk geciteerde artikelen vóór publicatie. Ontbreekt een onderzoeker of zijn er geen bronverwijzingen, dan wordt niet geschreven.

## Budget en technische grenzen

`NEWS_PILOT_ENABLED=true` activeert de beheerproef. `ADMIN_EMAILS`, `NEXT_PUBLIC_SITE_URL`, Supabase, Redis, Resend, OpenAI en Anthropic moeten ingesteld zijn.

De database reserveert €1 per proefpoging, maximaal €5 totaal. Deze reservering omvat twee onderzoekers en één schrijver, en blijft staan bij mislukking of timeout. Geen automatische retries. ChatGPT: maximaal twee zoekcalls en 2500 uitvoertokens; Claude-onderzoek en schrijver: elk maximaal 1500 uitvoertokens. Iedere provider heeft een timeout van 45 seconden. De reservering is geen gemeten factuurbedrag.

Versiecontrole voorkomt overschrijven van gelijktijdige redactionele wijzigingen. Bij een opslagconflict blijft de nieuwe tekst beschikbaar in het formulier om te kopiëren. Modellen, onderzoeksuitvoer en verbruik worden bij een geslaagde generatie in het concept vastgelegd.

Nog niet geïmplementeerd: dagelijkse automatische vulling, de 60-dagenbootstrap, centrale hergebruikssnapshots in klantkranten en automatische inhoudelijke broncontrole. Dit beheerherstel verandert die klantflow niet.

## Validatie

Unit- en integratietests controleren auth, budget, het gebruik van de bestaande prompt, beide onderzoekers, opslag en het weigeren van onvolledig onderzoek. CI gebruikt PostgreSQL 17 en PostgREST voor database- en toegangscontroles. De echte proef moet aanvullend inhoudelijk beoordeeld worden.
