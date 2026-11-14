// USA rule set (N, 15 Nov: "separate rules for the USA"). Same structure as rules/crops.json and
// rules/rules.json, so the engine is unchanged; values and sources come from US land-grant extension
// publications (docs/REFERENCES.md). Ukrainian law (Resolution No. 164) and the team's local practice do
// not apply in the USA: where no US source was found the number stays, its source becomes null, and the
// app shows it as unverified. Deterministic: `node scripts/make-us-rules.mjs`.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const src = join(here, '..', 'public', 'rules')
const out = join(src, 'us')
mkdirSync(out, { recursive: true })
const crops = JSON.parse(readFileSync(join(src, 'crops.json'), 'utf8'))
const rules = JSON.parse(readFileSync(join(src, 'rules.json'), 'utf8'))

// minimum years between two crops of the same kind on one field
const RETURN = {
  sunflower: [4, 'ndsu_sunflower'], // NDSU (Kandel): at least four years between sunflower crops
  w_rape: [3, 'ndsu_blackleg'], // NDSU: three-year rotation helps manage blackleg (four recommended)
  sugar_beet: [3, 'umn_rhizoctonia'], // UMN/NDSU: minimum three-year rotation for Rhizoctonia
  peas: [3, 'sdsu_pulses'], // SDSU: three years between pea crops and related pulses
  chickpea: [4, 'ndsu_ascochyta'], // NDSU: Ascochyta spreads from chickpea residue for at least four years
  soy: [0, null], maize: [0, null], w_wheat: [0, null], w_barley: [0, null], s_barley: [0, null],
  sorghum: [0, null], fallow: [0, null], cover: [0, null],
}
for (const c of crops.crops) {
  const r = RETURN[c.id]
  if (r) c.returnGap = { v: r[0], source: r[1] }
  if (c.id === 'maize') c.maxInRow = null // continuous corn is common in the USA; the yield drag is a predecessor effect
}

rules.predecessor = [
  { from: 'soy', to: 'maize', effect: 2, reason: 'nitrogen', source: 'isu_corn_rotation' },
  { from: 'maize', to: 'maize', effect: -2, reason: 'rootworm_residue', source: 'isu_corn_rotation' },
  { from: 'maize', to: 'soy', effect: 1, reason: 'residue_break', source: 'isu_soy_after_corn' },
  { from: 'maize', to: 'w_wheat', effect: -2, reason: 'fusarium_late_sowing', source: 'okstate_fhb' },
  { from: 'soy', to: 'w_wheat', effect: 1, reason: 'disease_break_early_harvest', source: 'ncsu_fhb' },
  { from: 'w_wheat', to: 'sugar_beet', effect: 1, reason: 'classic_predecessor', source: 'umn_rhizoctonia' },
  { from: 'w_barley', to: 'sugar_beet', effect: 1, reason: 'classic_predecessor', source: 'umn_rhizoctonia' },
  { from: 's_barley', to: 'sugar_beet', effect: 1, reason: 'classic_predecessor', source: 'umn_rhizoctonia' },
  { from: 'sunflower', to: 'soy', effect: -2, reason: 'white_mold', source: 'ndsu_sclerotinia' },
  { from: 'soy', to: 'sunflower', effect: -2, reason: 'white_mold', source: 'ndsu_sclerotinia' },
  { from: 'w_rape', to: 'sunflower', effect: -2, reason: 'white_mold', source: 'ndsu_sclerotinia' },
  { from: 'sunflower', to: 'w_rape', effect: -2, reason: 'white_mold', source: 'ndsu_sclerotinia' },
]
rules.sharedHost = rules.sharedHost.map((h) => ({ ...h, source: 'ndsu_sclerotinia' }))
rules.regionShareMax = [] // Resolution No. 164 shares are Ukrainian law
const COMBO_SRC = { N_BONUS: 'isu_corn_rotation', CLASSIC_BEET: 'umn_rhizoctonia', FUSARIUM: 'okstate_fhb', WHITE_MOLD: 'ndsu_sclerotinia' }
rules.combos = rules.combos.map((c) => {
  const s = COMBO_SRC[c.id] ?? null
  return { ...c, source: s, points: { ...c.points, source: s } }
})

writeFileSync(join(out, 'crops.json'), JSON.stringify(crops, null, 1))
writeFileSync(join(out, 'rules.json'), JSON.stringify(rules, null, 1))
console.log('rules/us written:', crops.crops.length, 'crops,', rules.predecessor.length, 'predecessor rules,', rules.combos.length, 'combos')
