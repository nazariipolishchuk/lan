// Hand-made fixtures for the web track (PLAN task 0.6). Deterministic: run `node scripts/make-fixtures.mjs`.
// Field A: sunflower returned too soon. Field B: healthy rotation, winter crop already emerged. Field C: no history.
// The climate cell is synthetic (smooth seasonal curves + fixed pseudo-random noise), clearly marked as a fixture.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'fixtures')
mkdirSync(out, { recursive: true })

const CK = '557_848'
const CELL = '49.5_31.875'

const seq = (classes, conf, mapGroups) =>
  classes.map((k, i) => {
    const y = 2016 + i
    const item = { y, k, p: conf[i], src: 'model' }
    if (mapGroups && y >= 2019 && y <= 2024) item.g = mapGroups[i]
    return item
  })

const group = (k) =>
  k === 'winter_cereal' || k === 'rapeseed' ? 'winter' : k === 'other' ? 'uncultivated' : 'summer'

const histA = ['winter_cereal', 'sunflower', 'winter_cereal', 'maize', 'sunflower', 'winter_cereal',
  'sunflower', 'winter_cereal', 'sunflower', 'maize', 'sunflower']
const histB = ['soy', 'winter_cereal', 'sugar_beet', 'spring_cereal', 'rapeseed', 'winter_cereal',
  'sunflower', 'soy', 'winter_cereal', 'maize', 'soy']

const fields = [
  {
    id: 'fixture-A', c: [32.06, 49.44], ha: 84.3, adm: { oblast: 'Cherkasy', raion: 'Cherkasy' }, cell: CELL,
    soil: { clay: 28, sand: 18, soc: 2.4, ph: 6.4 }, terrain: { slope: 1.8, slopeP90: 4.1, elev: 162 },
    hist: seq(histA, [0.91, 0.88, 0.93, 0.79, 0.9, 0.94, 0.86, 0.92, 0.89, 0.81, 0.87], histA.map(group)),
    now: { state: 'bare', asOf: '2026-11-08' }, bareDays: 141, flags: [],
  },
  {
    id: 'fixture-B', c: [32.12, 49.4], ha: 132.7, adm: { oblast: 'Cherkasy', raion: 'Cherkasy' }, cell: CELL,
    soil: { clay: 31, sand: 15, soc: 2.9, ph: 6.7 }, terrain: { slope: 0.9, slopeP90: 2.2, elev: 171 },
    hist: seq(histB, [0.84, 0.95, 0.77, 0.71, 0.88, 0.93, 0.9, 0.82, 0.94, 0.86, 0.8], histB.map(group)),
    now: { state: 'winter_crop', asOf: '2026-11-08' }, bareDays: 64, flags: [],
  },
  {
    id: 'fixture-C', c: [32.15, 49.3], ha: 1.6, adm: { oblast: 'Cherkasy', raion: 'Cherkasy' }, cell: CELL,
    soil: null, terrain: null, hist: [], now: null, bareDays: null, flags: ['small', 'no_history'],
  },
]
writeFileSync(join(out, `fields_${CK}.json`), JSON.stringify({ v: 1, ck: CK, fields }, null, 1))

// --- synthetic climate cell ---
let seed = 42
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
const round = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d
const years = []
for (let y = 1991; y <= 2026; y++) {
  const warm = (y - 1991) * 0.045 // ~1.6 °C warming over the period
  const tmean = Array.from({ length: 36 }, (_, d) => 8 + warm - 12.5 * Math.cos(((d + 0.5) / 36) * 2 * Math.PI - 0.35))
  const tmin = tmean.map((t) => round(t - 5 - rnd() * 4))
  const tmax = tmean.map((t) => t + 6 + rnd() * 3)
  const hot30 = tmax.map((t) => Math.max(0, Math.min(10, Math.round((t - 26) * 1.2 + rnd() * 2))))
  const hot35 = tmax.map((t, i) => Math.max(0, Math.min(hot30[i], Math.round((t - 31) * 0.8 + rnd()))))
  const rain = tmean.map((t) => round(Math.max(0, 12 + (t > 10 ? 8 : 0) + (rnd() - 0.5) * 20)))
  const et0 = tmean.map((t) => round(Math.max(1, t * 2.1 + rnd() * 6)))
  const wet = rain.map((r, i) => round(Math.min(1, Math.max(0.1, 0.55 + (r - et0[i]) / 120)), 2))
  const gdd = (base) => Math.round(tmean.reduce((s, t) => s + Math.max(0, t - base) * 10, 0))
  const lastSpring = 95 + Math.round(rnd() * 30 - warm * 4)
  const firstAutumn = 285 + Math.round(rnd() * 25 + warm * 3)
  years.push({
    y, gdd5: gdd(5), gdd10: gdd(10), lastSpringFrostDoy: lastSpring, firstAutumnFrostDoy: firstAutumn,
    heavyRainDays: Math.round(rnd() * 6), rain, et0, hot30, hot35, tmin, wet,
  })
}
writeFileSync(join(out, `climate_${CELL}.json`), JSON.stringify({ v: 1, id: CELL, lat: 49.5, lon: 31.875, years }))

writeFileSync(join(out, 'meta.json'), JSON.stringify({
  v: 1, built: 'fixture', coverage: { historyTiles: [], climateOnly: false }, accuracy: null,
  sources: [{ id: 'fixture', name: 'Hand-made fixture data (not real)', version: '0', licence: 'n/a' }],
}, null, 1))
console.log('fixtures written to', out)
