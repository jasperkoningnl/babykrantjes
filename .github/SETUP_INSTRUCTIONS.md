# 🚀 Claude Auto-Merge Setup - Quick Start

## Wat is er toegevoegd?

✅ **3 nieuwe files:**
- `.github/workflows/claude-auto-merge.yml` - Auto-merges Claude PRs
- `.github/workflows/cleanup-claude-branches.yml` - Ruimt oude branches op
- `.github/CLAUDE_WORKFLOW.md` - Volledige documentatie

## ⚙️ Setup Stappen (Eenmalig)

### Stap 1: GitHub Repository Settings

1. **Open je repository** op GitHub:
   ```
   https://github.com/jasperkoningnl/babykrant_claude
   ```

2. **Ga naar Settings** → **Actions** → **General**

3. **Scroll naar "Workflow permissions"**

4. **Selecteer deze opties:**
   ```
   ○ Read repository contents and packages permissions
   ● Read and write permissions  ← SELECTEER DEZE!

   ☑ Allow GitHub Actions to create and approve pull requests  ← VINK AAN!
   ```

5. **Klik "Save"**

### Stap 2: Branch Protection (Optioneel maar aanbevolen)

1. **Ga naar Settings** → **Branches**

2. **Klik "Add rule"**

3. **Branch name pattern:** `main`

4. **Configureer:**
   ```
   ☐ Require a pull request before merging
      ⚠️ NIET AANVINKEN! (anders werkt auto-approve niet)

   ☑ Require status checks to pass before merging
      ☑ Require branches to be up to date before merging
      In het zoekveld: type "auto-merge" en selecteer de check

   ☑ Do not allow bypassing the above settings
   ```

5. **Klik "Create"**

### Stap 3: Test de Workflow

**Optie A: Wacht op Claude's volgende PR**
- Claude maakt automatisch een PR
- Workflow triggered automatisch
- Check `Actions` tab om te zien of het werkt

**Optie B: Manual test (nu doen)**
```bash
# Maak een test branch (doe dit in je eigen terminal, niet Claude)
git checkout -b claude/test-auto-merge-123
echo "# Test" >> TEST.md
git add TEST.md
git commit -m "test: Auto-merge workflow test"
git push -u origin claude/test-auto-merge-123

# Maak PR via GitHub UI of:
gh pr create --title "Test Auto-Merge" --body "Testing Claude auto-merge workflow"

# Check de Actions tab op GitHub
```

## ✅ Verificatie

**De workflow werkt als je ziet:**

1. **In de PR:**
   - ✅ Check "auto-merge / auto-merge" passed
   - ✅ PR is automatisch approved
   - ✅ PR is automatisch merged
   - ✅ Branch is verwijderd

2. **In Actions tab:**
   ```
   Claude Auto-Merge
   ✓ Run linter
   ✓ Run build
   ✓ Auto-approve PR
   ✓ Merge PR
   ```

## 🎯 Verwacht Gedrag

### Normale Claude Workflow (vanaf nu):

```
1. Claude maakt wijzigingen op: claude/feature-abc123
2. Claude pushed changes
3. Claude maakt PR naar main
   ⏱️ ~30 seconden
4. GitHub Actions: Lint + Build
   ⏱️ ~1-2 minuten
5. Auto-approve ✓
6. Auto-merge ✓
7. Branch cleanup ✓

✅ Klaar! Wijzigingen in main binnen ~2 minuten
```

### Wat gebeurt er NIET auto-merged:

- ❌ Branches die niet beginnen met `claude/`
- ❌ PRs waar lint of build faalt
- ❌ PRs van forks of externe contributors
- ❌ Handmatige PRs (die jij maakt)

## 🛠️ Troubleshooting

### "Resource not accessible by integration" Error

**Probleem:** Workflow permissions niet correct

**Oplossing:**
```
Settings → Actions → General → Workflow permissions
✓ Read and write permissions
✓ Allow GitHub Actions to create and approve pull requests
```

### PR Blijft Open, Wordt Niet Merged

**Check 1:** Gaan de checks door?
```
PR → Checks tab → Zie alle checks groen?
```

**Check 2:** Branch protection te streng?
```
Settings → Branches → main → Edit
☐ Require pull request reviews  (MOET UIT!)
```

**Check 3:** Check de workflow logs
```
Actions tab → Claude Auto-Merge → Laatste run → Logs
```

### Oude Branches Blijven Staan

**Check:** Is cleanup workflow actief?
```
Actions tab → Cleanup Claude Branches
```

**Manual trigger:**
```
Actions → Cleanup Claude Branches → Run workflow → Run
```

## 📚 Meer Info

Zie `.github/CLAUDE_WORKFLOW.md` voor:
- Gedetailleerde workflow uitleg
- Configuratie opties
- Advanced troubleshooting
- Security considerations

## 🆘 Support

**Issue met de workflow?**

1. Check workflow logs: `Actions` tab op GitHub
2. Zie CLAUDE_WORKFLOW.md voor troubleshooting
3. Open een issue in de repository

## 🎉 Success!

Als de setup klopt, hoef je vanaf nu:
- ✅ **NIETS** te doen voor Claude's PRs
- ✅ **GEEN** handmatige reviews
- ✅ **GEEN** handmatige merges
- ✅ **GEEN** branch cleanup

**Everything is automatic!** 🚀

---

**Created:** 2025-12-21
**Version:** 1.0
**For:** babykrant_claude repository
