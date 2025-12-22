# Prompt Testing in Claude Workbench

Deze handleiding legt uit hoe je de geëxporteerde babykrant data gebruikt om prompts te testen en optimaliseren in Claude Workbench.

## 🎯 Workflow Overzicht

```
1. Wizard 3x doorlopen (dochter + 2 nichtjes)
   ↓
2. Per profiel: "Exporteer voor Workbench" knop klikken
   ↓
3. JSON bestanden openen in editor
   ↓
4. Prompts testen in Workbench (console.anthropic.com)
   ↓
5. Verbeterde prompts delen met Claude Code
   ↓
6. Implementatie in app/api/generate-article/route.ts
```

---

## 📦 Wat zit er in de Export?

Het geëxporteerde JSON bestand bevat **READY-TO-USE prompts**:

```json
{
  "metadata": {
    "exportDate": "2024-...",
    "appVersion": "3.x.x",
    "profileName": "Emma de Vries",
    "purpose": "Workbench prompt testing - READY TO USE prompts",
    "instructions": "Kopieer systemPrompt + een sectie prompt naar Workbench en test!"
  },
  "systemPrompt": "Je bent een professionele journalist...",
  "prompts": {
    "hoofdartikel": {
      "prompt": "Schrijf een hoofdartikel voor een babykrant...\n\nFEITEN:\n- Plaats: Amsterdam (Amsterdam UMC)\n- Datum: vrijdag 15 maart 2024\n...[ALLE DATA AL INGEVULD]",
      "expectedLength": "200-250 woorden"
    },
    "sterrenbeeld": {
      "prompt": "Schrijf een tekst over het sterrenbeeld...\n\nGEGEVENS:\n- Naam: Emma\n- Sterrenbeeld: Vissen\n...[ALLE DATA AL INGEVULD]",
      "expectedLength": "150-180 woorden"
    },
    // ... 8 secties in totaal, allemaal compleet
  },
  "howToUse": {
    "step1": "Ga naar console.anthropic.com...",
    // ... stap-voor-stap instructies
  },
  "wizardDataReference": {
    // Volledige data als referentie (alleen voor debugging)
  }
}
```

**Let op**: Je hoeft **GEEN** data meer te kopiëren! Alle prompts zijn al compleet.

---

## 🚀 Stap-voor-Stap: Prompts Testen in Workbench

### **Stap 1: Open Claude Workbench**
- Ga naar: https://console.anthropic.com
- Log in met je Anthropic account
- Je hebt een API key nodig (gratis te maken in de console)

### **Stap 2: Open je Geëxporteerde JSON**
- Open het gedownloade JSON bestand in een code editor (VS Code, Sublime, etc.)
- Of gebruik een online JSON viewer voor betere leesbaarheid

### **Stap 3: Maak een Nieuwe Chat in Workbench**
1. Klik op **"Create New Prompt"** of **"New Chat"**
2. Selecteer model: **Claude 3.5 Haiku** (zelfde als de app gebruikt)
3. **LET OP**: Je betaalt alleen voor de API calls, niet voor Workbench zelf

### **Stap 4: Kopieer de System Prompt**
1. Zoek in je JSON naar: `"prompts" → "systemPrompt"`
2. Kopieer de **volledige** system prompt (alles tussen de backticks)
3. Plak in het **"System"** veld bovenaan Workbench

```
Waar?
┌─────────────────────────────────┐
│ System: [HIER PLAKKEN]          │ ← System Prompt
├─────────────────────────────────┤
│ User message: ...               │ ← Straks je prompt
└─────────────────────────────────┘
```

### **Stap 5: Kopieer de Ready-to-Use Prompt**

Kies een sectie om te testen (bijv. `hoofdartikel`):

1. Open je JSON bestand
2. Ga naar: `"prompts"` → `"hoofdartikel"` → `"prompt"`
3. **Kopieer de volledige prompt** (alles staat er al in!)
4. Plak in het message veld van Workbench

**Voorbeeld van wat je kopieert:**

```
Schrijf een hoofdartikel voor een babykrant over de geboorte van Emma de Vries.

FEITEN:
- Plaats: Amsterdam (Amsterdam UMC)
- Locatie type: ziekenhuis
- Datum: vrijdag 15 maart 2024
- Tijd: 14:23 uur
- Ouders: Sophie de Vries en Jan Bakker
- Gewicht: 3450 gram
- Lengte: 51 cm
- Bevalling: snel
- Broertjes/zusjes: Liam (3 jaar), Mia (5 jaar)
- Waarom voornaam: genoemd naar oma Emma

STRUCTUUR:
1. Opening in krantstijl: "AMSTERDAM - Op vrijdag 15 maart 2024 werden..."
2. Beschrijf de bevalling en geboorte (snel)
3. Eerste momenten (gewicht, lengte, eerste indrukken)
4. Reactie broertjes/zusjes
5. Verhaal achter de naam
6. Afsluiting met toekomstblik

LENGTE: 200-250 woorden
TONE: Warm, persoonlijk, verhalend zoals in een nieuwsartikel

Schrijf de tekst:
```

**💡 Super simpel**: Alles staat er al in, je hoeft **GEEN** data te kopiëren/plakken!

### **Stap 6: Run en Itereer**
1. Klik **"Run"** → bekijk output
2. **Itereer**:
   - Is de tone goed? → Pas System Prompt aan
   - Is de structuur goed? → Pas prompt instructies aan
   - Mist er informatie? → Voeg data toe
   - Te lang/kort? → Pas lengtespecificatie aan
3. **Vergelijk** versies met de "Compare" functie in Workbench
4. Herhaal tot je tevreden bent

### **Stap 7: Test met Alle 3 Profielen**
- Exporteer data voor dochter + 2 nichtjes
- Test je verbeterde prompt met **alle 3 datasets**
- Controleer consistentie en kwaliteit

### **Stap 8: Deel Resultaat**
- Kopieer je **finale system prompt**
- Kopieer je **finale prompt per sectie**
- Deel met Claude Code:
  ```
  "Ik heb de prompts getest in Workbench. Hier zijn de verbeterde versies:

  SYSTEM PROMPT:
  [plak hier]

  HOOFDARTIKEL PROMPT:
  [plak hier]

  STERRENBEELD PROMPT:
  [plak hier]

  etc..."
  ```
- Claude Code verwerkt deze in `app/api/generate-article/route.ts`

---

## ❓ Veelgestelde Vragen

### **Q: Moet ik data uit de JSON kopiëren en in de prompt plakken?**
**A: NEE!** De prompts zijn al compleet:
- ✅ Alle data is **al ingevuld** in elke prompt
- ✅ Je kopieert gewoon de **volledige prompt** uit het JSON bestand
- ✅ Plak direct in Workbench en klik "Run"
- ❌ **Geen** handmatig data kopiëren/plakken nodig

### **Q: Moet ik Tools of Templatize gebruiken in Workbench?**
**A: NEE!** Voor jouw use case:
- ❌ **GEEN Tools** (dat is voor function calling)
- ❌ **GEEN Templatize** (dat is voor variabelen zoals `{{naam}}`)
- ✅ **Gewoon platte tekst** - de prompts zijn ready-to-use

### **Q: Kan Claude in Workbench zich beperken tot alleen mijn data?**
**A: Ja, met instructies.** Claude heeft altijd toegang tot algemene kennis, maar:
- Instrueer expliciet: **"GEBRUIK ALLEEN DEZE DATA (geen algemene kennis)"**
- Dit werkt goed voor feitelijke content (namen, data, nieuwsfeiten)
- Voor interpretatie (betekenis namen, sterrenbeelden) gebruikt Claude natuurlijk wel algemene kennis

### **Q: Hoeveel kost dit?**
**A: Zeer weinig.** Claude Workbench is gratis, je betaalt alleen voor API calls:
- Claude 3.5 Haiku: ~$0.001 per prompt (200-250 woorden output)
- 100 test runs = ~$0.10
- Workbench zelf is gratis

### **Q: Kan ik versies vergelijken?**
**A: Ja!** Workbench heeft een **"Compare"** functie:
1. Run prompt versie A
2. Pas aan naar versie B
3. Klik "Compare" → zie side-by-side

### **Q: Moet ik voor elke sectie een nieuwe chat maken?**
**A: Niet noodzakelijk.** Je kunt:
- **Optie 1**: Alles in 1 chat (scroll terug voor eerdere outputs)
- **Optie 2**: Per sectie een nieuwe chat (beter overzicht)
- **Advies**: Start met 1 chat, maak nieuwe als het te onoverzichtelijk wordt

### **Q: Hoe weet ik of mijn prompt goed is?**
**A: Checklist:**
- ✅ Tone klopt (warm maar niet overdreven)
- ✅ Lengte klopt (binnen de woordenlimiet)
- ✅ Structuur klopt (intro → body → conclusie)
- ✅ Geen Markdown formatting (`**`, `##`, etc.)
- ✅ Correcte Nederlandse spelling
- ✅ Werkt voor alle 3 profielen (consistentie)

---

## 🎓 Best Practices

### **1. Start met 1 Sectie**
- Test eerst `hoofdartikel` (belangrijkste sectie)
- Leer het proces kennen
- Pas daarna andere secties aan

### **2. Itereer Systematisch**
- Test versie A → noteer wat goed/slecht is
- Maak 1 wijziging → test versie B
- Vergelijk A vs B
- Zo begrijp je wat elke wijziging doet

### **3. Gebruik Echte Data**
- Test met je 3 echte profielen (dochter + nichtjes)
- Niet met fictieve data
- Zo zie je of prompts werken voor verschillende scenarios:
  - Wel/geen broertjes/zusjes
  - Wel/geen naam reden
  - Verschillende steden/data

### **4. Let op Edge Cases**
- Wat als er geen naam reden is?
- Wat als er geen broertjes/zusjes zijn?
- Wat als er geen nieuws data is?
- Test deze scenario's!

### **5. Documenteer Wijzigingen**
- Noteer waarom je iets aanpast
- Zo kun je straks uitleggen: "Ik heb X aangepast omdat Y"

---

## 📊 Voorbeeld Workflow

**Concrete workflow voor het verbeteren van het hoofdartikel:**

```
RONDE 1: Baseline testen
├─ Run met huidige prompt + Emma's data
├─ Output: "AMSTERDAM - Op vrijdag 15 maart..."
├─ Observatie: Te formeel, weinig emotie
└─ Actie: System prompt aanpassen (meer warmte)

RONDE 2: Warmere tone
├─ Wijziging: "Warm en persoonlijk" → "Warm en liefdevol, zoals familie vertelt"
├─ Run opnieuw
├─ Output: Beter! Maar nog steeds generiek
└─ Actie: Prompt specifieker maken over broertjes/zusjes

RONDE 3: Broertjes/zusjes nadruk
├─ Wijziging: "Reactie broertjes/zusjes" → "Beschrijf hoe Liam en Mia reageerden (concreet)"
├─ Run opnieuw
├─ Output: Veel beter! Nu met namen en concreet
└─ Actie: Testen met andere profielen

RONDE 4: Consistentie check
├─ Test met Nichtje 1 (heeft geen broertjes/zusjes)
├─ Output: Prompt faalt - verwacht broertjes/zusjes info
└─ Actie: Maak conditioneel ("indien aanwezig")

RONDE 5: Finale versie
├─ Wijziging: Conditional logic toevoegen
├─ Test met alle 3 profielen
├─ Output: ✅ Werkt voor alle scenario's
└─ KLAAR! → Deel met Claude Code
```

---

## 🔧 Troubleshooting

### **Probleem: Output bevat Markdown formatting**
**Oplossing**: Voeg toe aan System Prompt:
```
ABSOLUUT VERBODEN:
- Markdown formatting (**, ##, -, *, etc.)
- HTML tags
- Bullets of numbered lists in de output
```

### **Probleem: Te lang/te kort**
**Oplossing**: Wees strikter in de instructie:
```
STRIKTE LENGTE EIS: EXACT 200-250 woorden
- Minder dan 200? → FOUT
- Meer dan 250? → FOUT
- Tel de woorden en controleer!
```

### **Probleem: Te generiek, niet persoonlijk genoeg**
**Oplossing**: Vraag om specifieke details:
```
GEBRUIK SPECIFIEKE DETAILS:
- Noem broertjes/zusjes bij naam (niet "de broertjes")
- Noem de exacte tijd (niet "in de middag")
- Noem de exacte locatie (niet "in het ziekenhuis")
```

### **Probleem: Claude gebruikt algemene kennis ipv data**
**Oplossing**: Wees explicieter:
```
⚠️ KRITIEK: Gebruik UITSLUITEND de onderstaande data.
- Geen algemene kennis over namen
- Geen algemene kennis over sterrenbeelden
- Geen algemene kennis over steden
- ALLEEN wat hieronder staat!
```

---

## ✅ Checklist voor Finale Prompts

Voordat je prompts deelt met Claude Code:

- [ ] Getest met alle 3 profielen (dochter + 2 nichtjes)
- [ ] Werkt voor edge cases (geen broertjes, geen naam reden, etc.)
- [ ] Correcte lengte (binnen woordenlimiet)
- [ ] Correcte tone (warm maar niet overdreven)
- [ ] Geen Markdown formatting in output
- [ ] Correcte Nederlandse spelling
- [ ] Structuur klopt (intro → body → conclusie)
- [ ] Gebruikt alleen aangeleverde data (waar nodig)
- [ ] Consistent over alle secties heen

---

## 🎯 Klaar om te Beginnen?

1. **Doorloop wizard 3x** (dochter + 2 nichtjes)
2. **Klik "Exporteer voor Workbench"** per profiel
3. **Open console.anthropic.com**
4. **Volg deze handleiding**
5. **Deel resultaten** met Claude Code

**Succes met het optimaliseren van de prompts!** 🚀

---

**Vragen?** Vraag het aan Claude Code tijdens de sessie.
