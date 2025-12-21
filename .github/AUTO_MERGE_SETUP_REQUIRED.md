# ⚠️ AUTO-MERGE SETUP VEREIST!

## 🚨 Waarom PR #16 Niet Auto-Merged

De auto-merge workflow is WEL geïnstalleerd (PR #15), maar werkt nog niet omdat de **GitHub permissions** nog niet zijn ingesteld.

---

## ✅ VERPLICHTE SETUP (Doe Dit NU!)

### Stap 1: Ga naar Repository Settings

Open in je browser:
```
https://github.com/jasperkoningnl/babykrant_claude/settings/actions
```

### Stap 2: Configureer Workflow Permissions

Scroll naar beneden tot je **"Workflow permissions"** ziet.

**Selecteer:**
```
○ Read repository contents and packages permissions  ← NIET DEZE
● Read and write permissions                          ← DEZE SELECTEREN! ✓
```

**En vink aan:**
```
☑ Allow GitHub Actions to create and approve pull requests  ← AANVINKEN! ✓
```

### Stap 3: Klik "Save"

Onderaan de pagina: klik **"Save"**

---

## 🧪 Test De Setup

### Optie A: Maak Test PR

```bash
git checkout -b claude/test-auto-merge-$(date +%s)
echo "# Test" >> TEST_AUTO_MERGE.md
git add TEST_AUTO_MERGE.md
git commit -m "test: Auto-merge workflow"
git push -u origin HEAD
```

Maak dan een PR via GitHub en watch de magic happen!

### Optie B: Wacht Op Claude's Volgende PR

De volgende keer dat Claude een PR maakt, wordt die automatisch:
- ✅ Getest (lint + build)
- ✅ Approved
- ✅ Merged
- ✅ Branch cleanup

---

## 🔍 Hoe Check Je Of Het Werkt?

### Check 1: Permissions Correct?

```
Settings → Actions → Workflow permissions
✓ Read and write permissions
✓ Allow GitHub Actions to create and approve pull requests
```

### Check 2: Workflow Draait?

Wanneer er een claude/* PR wordt gemaakt:
1. Ga naar de PR pagina
2. Scroll naar beneden naar "Checks"
3. Je zou moeten zien: **"Claude Auto-Merge / auto-merge"**

### Check 3: Workflow Succesvol?

In de PR zie je:
- ✅ Check "auto-merge" passed (groen vinkje)
- ✅ PR is auto-approved (bot comment)
- ✅ PR wordt automatisch gemerged binnen ~2 minuten

---

## 🐛 Troubleshooting

### "Resource not accessible by integration"

**Probleem:** Workflow permissions niet correct

**Oplossing:**
```
Settings → Actions → Workflow permissions
✓ Read and write permissions
✓ Allow GitHub Actions to create and approve pull requests
```

### Workflow Niet Zichtbaar in PR

**Probleem:** Workflow bestaat niet op main branch

**Oplossing:** Check of `.github/workflows/claude-auto-merge.yml` bestaat op main
```bash
git checkout main
ls .github/workflows/
```

Zou moeten tonen:
- `claude-auto-merge.yml` ✓
- `cleanup-claude-branches.yml` ✓

### PR Wordt Approved Maar Niet Gemerged

**Check:** Branch protection rules

```
Settings → Branches → main
```

Zorg dat:
- ☐ "Require a pull request before merging" is **UITGEVINKT**
  (of "Do not require approvals" als het AAN staat)

---

## 📊 Verwacht Gedrag (Na Setup)

```
Claude maakt PR
    ↓
Checks draaien (lint, build) ~1-2 min
    ↓
Auto-approve ✓
    ↓
Auto-merge ✓
    ↓
Branch cleanup ✓

Total tijd: ~2 minuten van PR tot main!
```

---

## ❓ Hulp Nodig?

Zie ook:
- `.github/SETUP_INSTRUCTIONS.md` - Volledige setup guide
- `.github/CLAUDE_WORKFLOW.md` - Technische documentatie

Of check de workflow logs:
```
GitHub → Actions tab → Claude Auto-Merge → Laatste run
```

---

**🎯 TL;DR: Ga nu naar Settings → Actions en zet de permissions aan!**

https://github.com/jasperkoningnl/babykrant_claude/settings/actions
