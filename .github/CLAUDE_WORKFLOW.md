# Claude Code Auto-Merge Workflow

## 🎯 Doel

Deze workflow automatiseert het mergen van Claude Code's wijzigingen naar de `main` branch, waardoor de developer experience vergelijkbaar wordt met direct naar main pushen, maar met de veiligheid van code review.

## 🔄 Hoe Het Werkt

### 1. Claude Maakt Wijzigingen
```
Claude werkt op: claude/feature-xyz123
                 └─ Automatisch gegenereerd door Claude Code
```

### 2. Automatisch Process

Wanneer Claude een PR maakt:

```mermaid
PR Created → Lint → Build → Auto-Approve → Auto-Merge → Cleanup
   ✓         ✓      ✓          ✓            ✓           ✓
```

**Stappen:**
1. ✅ **PR wordt aangemaakt** van `claude/*` → `main`
2. 🔍 **Checks draaien:** `npm run lint` + `npm run build`
3. ✔️ **Auto-approve:** Als checks slagen
4. 🔀 **Auto-merge:** Squash merge naar `main`
5. 🧹 **Cleanup:** `claude/*` branch wordt verwijderd

### 3. Resultaat

De wijzigingen staan binnen ~2 minuten in `main`, zonder handmatige interventie!

## 📋 Vereisten

### GitHub Repository Settings

**⚠️ Belangrijk:** Jasper moet eenmalig deze instellingen configureren:

1. **Ga naar:** `Settings` → `Actions` → `General`

2. **Workflow permissions:**
   ```
   ☑ Read and write permissions
   ☑ Allow GitHub Actions to create and approve pull requests
   ```

3. **Branch protection** (optioneel maar aanbevolen):
   - `Settings` → `Branches` → `Add rule` voor `main`
   - ☐ Require pull request reviews (UIT! Anders werkt auto-approve niet)
   - ☑ Require status checks to pass
     - Selecteer: `auto-merge` check
   - ☑ Require branches to be up to date before merging

## 🚀 Workflows

### `claude-auto-merge.yml`

**Trigger:** Elke PR van `claude/*` naar `main`

**Wat het doet:**
- Installeert dependencies
- Runt linter
- Runt build
- Auto-approves PR als alles slaagt
- Merged automatisch met squash
- Verwijdert branch na merge

**Voorbeeld output:**
```
✓ npm run lint     (passed)
✓ npm run build    (passed)
✓ Auto-approved PR #42
✓ Merged to main
✓ Deleted branch claude/feature-xyz123
```

### `cleanup-claude-branches.yml`

**Trigger:** Dagelijks om 2:00 UTC + handmatig via `Actions` tab

**Wat het doet:**
- Verwijdert gemerged `claude/*` branches
- Verwijdert oude (>30 dagen) unmerged branches

**Handmatig trigger:**
```
GitHub → Actions → Cleanup Claude Branches → Run workflow
```

## 🛠️ Configuratie Aanpassen

### Check Draaien Aanpassen

Edit `.github/workflows/claude-auto-merge.yml`:

```yaml
# Tests toevoegen
- name: Run tests
  run: npm test
  continue-on-error: false  # Set to true om failures te negeren

# Type checking toevoegen
- name: Type check
  run: npm run type-check
```

### Merge Strategie Wijzigen

Standaard: `squash` (alle commits worden 1 commit)

Andere opties:
```bash
gh pr merge --merge          # Reguliere merge
gh pr merge --rebase        # Rebase merge
gh pr merge --squash        # Squash merge (default)
```

### Cleanup Frequentie Aanpassen

Edit `.github/workflows/cleanup-claude-branches.yml`:

```yaml
on:
  schedule:
    - cron: '0 2 * * *'   # Dagelijks om 2 AM
    # - cron: '0 */6 * * *'  # Elke 6 uur
    # - cron: '0 0 * * 0'    # Wekelijks op zondag
```

## 🔍 Monitoring

### Check Workflow Status

```bash
# Zie laatste workflow runs
gh run list --workflow=claude-auto-merge.yml

# Zie details van een run
gh run view <run-id>

# Zie logs
gh run view <run-id> --log
```

### Check Welke Branches Er Zijn

```bash
# Lokaal
git branch -r | grep claude/

# Via GitHub CLI
gh api repos/:owner/:repo/branches | jq '.[].name | select(startswith("claude/"))'
```

## ⚠️ Troubleshooting

### PR Wordt Niet Auto-Merged

**Check 1:** Workflow permissions
```
Settings → Actions → General → Workflow permissions
✓ Read and write permissions
✓ Allow GitHub Actions to create and approve pull requests
```

**Check 2:** Branch protection conflicteert
```
Settings → Branches → main
☐ Require pull request reviews (moet UIT!)
```

**Check 3:** Checks falen
```bash
# Check logs
gh run list --workflow=claude-auto-merge.yml
gh run view <failed-run-id> --log
```

### Oude Branches Worden Niet Opgeschoond

**Check:** Workflow ran recent
```bash
gh run list --workflow=cleanup-claude-branches.yml
```

**Manual trigger:**
```
GitHub → Actions → Cleanup Claude Branches → Run workflow
```

## 🎓 Voor Claude Code

Als Claude Code, gebruik je de workflow als volgt:

1. **Werk normaal** op je `claude/*` branch
2. **Commit & push** zoals gebruikelijk
3. **Maak PR** naar `main`
4. **Wait ~2 minuten** - workflow handled de rest!

Je hoeft NIETS anders te doen! De PR wordt automatisch:
- Getest
- Goedgekeurd
- Gemerged
- Branch cleanup

## 📊 Benefits

| Voor | Zonder Auto-Merge | Met Auto-Merge |
|------|------------------|----------------|
| **Claude** | Wacht op manual review | Instant merge na checks |
| **Jasper** | Must review elke PR | Review alleen bij failures |
| **Repository** | Veel oude branches | Auto cleanup |
| **Speed** | Minuten-uren delay | ~2 minuten total |
| **Safety** | ✅ Review protection | ✅ Automated checks |

## 🔐 Security

**Wat is veilig:**
- ✅ Alle checks moeten slagen (lint, build)
- ✅ Audit trail blijft (PR history)
- ✅ Rollback mogelijk via git revert
- ✅ Alleen `claude/*` branches auto-merge

**Wat NIET auto-merged:**
- ❌ Andere feature branches
- ❌ PRs van forks
- ❌ PRs met failing checks
- ❌ Handmatige PRs door developers

## 📝 Version History

- **v1.0** (2025-12-21): Initial auto-merge workflow
  - Auto-approve + auto-merge
  - Lint + build checks
  - Automatic branch cleanup
