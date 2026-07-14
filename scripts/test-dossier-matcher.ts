#!/usr/bin/env tsx
// scripts/test-dossier-matcher.ts
// @version 1.0.0
// Unit tests for lib/dossierMatcher.ts. No test framework needed:
//   npx tsx scripts/test-dossier-matcher.ts
// Exits non-zero when a test fails.

import {
  matchDossiers,
  isDossierActiveOn,
  formatDossierPeriode,
  buildDossierPromptBlock,
  type Dossier,
} from '../lib/dossierMatcher'

let passed = 0
let failed = 0

function check(name: string, condition: boolean) {
  if (condition) {
    passed++
  } else {
    failed++
    console.error(`FAIL: ${name}`)
  }
}

function matchedIds(headlines: string[], date: string): string[] {
  return matchDossiers(headlines, date).map((m) => m.dossier.id)
}

// --- date window: dossier must be active on the date -----------------------

check(
  'Ukraine headline during the war matches',
  matchedIds(['Zware Russische aanval op Kharkiv'], '2023-03-15').includes('oorlog-rusland-oekraine')
)
check(
  'same Ukraine headline before the invasion does not match the 2022 dossier',
  !matchedIds(['Spanningen rond Oekraïne lopen op'], '2021-06-01').includes('oorlog-rusland-oekraine')
)
check(
  'Crimea headline in 2014 matches the annexation dossier, not the 2022 war',
  matchedIds(['Rusland annexeert de Krim'], '2014-03-20').includes('krim-annexatie') &&
    !matchedIds(['Rusland annexeert de Krim'], '2014-03-20').includes('oorlog-rusland-oekraine')
)
check(
  'covid headline after the pandemic dossier ended does not match',
  !matchedIds(['Nieuwe covid-variant ontdekt'], '2024-06-01').includes('coronapandemie')
)
check(
  'covid headline during the pandemic matches',
  matchedIds(['Persconferentie over lockdown en avondklok'], '2021-01-20').includes('coronapandemie')
)

// --- diacritics and word boundaries ----------------------------------------

check(
  'diacritics fold: "Oekraïne" matches alias "oekraine"',
  matchedIds(['Nieuwe wapenleveranties aan Oekraïne'], '2023-01-10').includes('oorlog-rusland-oekraine')
)
check(
  'word boundary: "coronation" does not match alias "corona"',
  !matchedIds(['Coronation of King Charles draws crowds'], '2023-05-06').includes('coronapandemie')
)
check(
  'multi-word alias: "Islamitische Staat" matches',
  matchedIds(['Islamitische Staat eist aanslag op'], '2015-11-14').includes('opkomst-is')
)

// --- multiple dossiers and headline attribution -----------------------------

const multi = matchDossiers(
  [
    'Hamas en Israël akkoord over staakt-het-vuren in Gaza',
    'Oekraïne meldt drone-aanvallen op Kyiv',
    'AEX sluit hoger na rustige handelsdag',
  ],
  '2024-05-01'
)
check('two dossiers match on a mixed news day', multi.length === 2)
check(
  'each match only lists its own headlines',
  multi.every((m) => m.headlines.length === 1)
)
check(
  'unrelated headline (AEX) is attributed to no dossier',
  multi.every((m) => !m.headlines.some((h) => h.includes('AEX')))
)

// --- MH17 -------------------------------------------------------------------

check(
  'MH17 matches on the day itself',
  matchedIds(['Vliegtuig MH17 neergestort in Oekraïne'], '2014-07-17').includes('mh17')
)

// --- empty and invalid input -------------------------------------------------

check('no headlines yields no matches', matchDossiers([], '2023-03-15').length === 0)
check('empty headline strings are ignored', matchDossiers(['', '  '], '2023-03-15').length === 0)
check('invalid date yields no matches', matchDossiers(['Oorlog in Oekraïne'], 'not-a-date').length === 0)

// --- isDossierActiveOn boundaries -------------------------------------------

const testDossier: Dossier = {
  id: 't',
  naam: 'Test',
  start: '2020-01-01',
  eind: '2020-12-31',
  aliassen: ['test'],
  context: 'x',
}
check('active on start date', isDossierActiveOn(testDossier, '2020-01-01'))
check('active on end date', isDossierActiveOn(testDossier, '2020-12-31'))
check('inactive before start', !isDossierActiveOn(testDossier, '2019-12-31'))
check('inactive after end', !isDossierActiveOn(testDossier, '2021-01-01'))
const ongoing: Dossier = { ...testDossier, eind: null }
check('ongoing dossier active far in the future', isDossierActiveOn(ongoing, '2030-01-01'))

// --- period label -------------------------------------------------------------

check(
  'ongoing period label',
  formatDossierPeriode(ongoing) === 'sinds januari 2020'
)
check(
  'closed period label',
  formatDossierPeriode(testDossier) === 'januari 2020 – december 2020'
)

// --- prompt block --------------------------------------------------------------

check('no matches -> empty prompt block', buildDossierPromptBlock([]) === '')
const blok = buildDossierPromptBlock(
  matchDossiers(['Rusland bombardeert Kharkiv'], '2023-03-15')
)
check('prompt block names the dossier', blok.includes('Oorlog Rusland–Oekraïne'))
check('prompt block includes the period', blok.includes('sinds februari 2022'))
check('prompt block quotes the headline', blok.includes('"Rusland bombardeert Kharkiv"'))
check('prompt block carries the context paragraph', blok.includes('24 februari 2022'))

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
