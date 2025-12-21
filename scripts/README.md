# Versie Beheer Scripts

## Automatisch Versie Verhogen

Dit project gebruikt gecentraliseerd versiebeheer met automatische bump scripts.

### Hoe het werkt

De versie wordt op **één centrale plek** beheerd:
- **`lib/version.ts`** - Single source of truth voor de applicatie versie
- **`package.json`** - Wordt automatisch gesynchroniseerd

### Versie verhogen

Gebruik één van deze npm scripts om de versie automatisch te verhogen:

```bash
# Patch versie verhogen (bugfixes) - bijv. v3.3.0 → v3.3.1
npm run version:patch

# Minor versie verhogen (nieuwe features) - bijv. v3.3.0 → v3.4.0
npm run version:minor

# Major versie verhogen (breaking changes) - bijv. v3.3.0 → v4.0.0
npm run version:major
```

### Wat gebeurt er automatisch?

Het script:
1. ✅ Leest de huidige versie uit `lib/version.ts`
2. ✅ Verhoogt de versie volgens semantic versioning
3. ✅ Update `APP_VERSION` en `APP_VERSION_FULL` in `lib/version.ts`
4. ✅ Update `RELEASE_DATE` naar vandaag
5. ✅ Synchroniseert `package.json` versie

### Na het verhogen van de versie

1. **Update release notes** in `lib/version.ts`:
   ```typescript
   export const RELEASE_NOTES = {
     major: 'Beschrijf de belangrijkste wijziging',
     features: [
       'Feature 1',
       'Feature 2',
       // ...
     ]
   }
   ```

2. **Commit en push**:
   ```bash
   git add .
   git commit -m "chore: bump version to v3.4.0"
   git push
   ```

### Semantic Versioning

We volgen [Semantic Versioning 2.0.0](https://semver.org/):

- **MAJOR** (v3.0.0 → v4.0.0): Breaking changes - wijzigingen die bestaande functionaliteit breken
- **MINOR** (v3.3.0 → v3.4.0): Nieuwe features - backwards compatible
- **PATCH** (v3.3.0 → v3.3.1): Bugfixes - backwards compatible

### Handmatig versie aanpassen

Als je de versie handmatig wilt aanpassen, edit alleen `lib/version.ts`.
**Draai daarna het script om package.json te synchroniseren:**

```bash
npm run version:patch  # Of minor/major
```

### Versie weergave

De versie wordt automatisch getoond op alle pagina's via:
- `VersionFooter` component (onderkant van elke pagina)
- Import via: `import { APP_VERSION } from '@/lib/version'`

Gebruik **nooit** lokale `PAGE_VERSION` constanten - gebruik altijd de centrale `APP_VERSION`.
