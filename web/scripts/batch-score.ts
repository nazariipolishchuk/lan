// Map layer values for every field (PLAN 4.2): the same engine as the card, run in Node over the field chunks.
//   rh = rotation health 0–100 of the last five known seasons (−1 when fewer than three are known)
//   dr = summer drought years out of the last 20 in the field's climate cell (−1 unknown): the water balance
//        (rain − evaporation demand) around maize flowering, about July, below the hazard threshold
// Usage (bundled by scripts/batch-score.mjs): node batch-score.bundle.mjs <out dir> <rules dir> <scores.json> [YYYY-MM-DD]
import { closeSync, openSync, readFileSync, readdirSync, writeFileSync, writeSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { fieldSeasons, scoreContext } from '../src/engine/card'
import { hazards } from '../src/engine/hazards'
import { lastCompleteYear, rotationHealth } from '../src/engine/score'
import type { ClimateCell, CropsFile, FieldChunk, RulesFile } from '../src/engine/types'

export const DROUGHT_HAZARD = 'maize_flowering_dry'

function readJson<T>(path: string): T {
  const buf = readFileSync(path)
  return JSON.parse((path.endsWith('.gz') ? gunzipSync(buf) : buf).toString('utf8')) as T
}

function main() {
  const [outDir, rulesDir, dst, date] = process.argv.slice(2)
  const today = date ? new Date(`${date}T12:00:00`) : new Date()
  const crops = readJson<CropsFile>(join(rulesDir, 'crops.json'))
  const rules = readJson<RulesFile>(join(rulesDir, 'rules.json'))
  const maize = crops.crops.find((c) => c.id === 'maize')!
  const cells = new Map<string, ClimateCell | null>()
  const drought = new Map<string, number>()
  const cell = (id: string) => {
    if (!cells.has(id)) {
      let c: ClimateCell | null = null
      try {
        c = readJson<ClimateCell>(join(outDir, 'climate', `${id}.json`))
      } catch {
        c = null
      }
      cells.set(id, c)
      const h = c ? hazards(maize, c, lastCompleteYear(c, today), 20).find((x) => x.id === DROUGHT_HAZARD) : undefined
      drought.set(id, h && h.years >= 10 ? h.count : -1)
    }
    return cells.get(id) ?? null
  }
  const scores: Record<string, { rh: number; dr: number }> = {}
  // large builds (the USA): stream one TSV line per field instead of holding all of them in memory
  const tsv = dst.endsWith('.tsv') ? openSync(dst, 'w') : null
  const TAB = String.fromCharCode(9)
  const NL = String.fromCharCode(10)
  if (tsv !== null) writeSync(tsv, ['id', 'rh', 'dr'].join(TAB) + NL)
  const files = readdirSync(join(outDir, 'fields')).filter((f) => /\.json(\.gz)?$/.test(f))
  let n = 0
  let withRh = 0
  const t0 = Date.now()
  for (const f of files) {
    const chunk = readJson<FieldChunk>(join(outDir, 'fields', f))
    for (const field of chunk.fields) {
      const c = cell(field.cell)
      let rh = -1
      if (c && field.hist.length && !field.flags.includes('small')) {
        try {
          const { seasons } = fieldSeasons(field, today)
          rh = rotationHealth(seasons, scoreContext(field, c, crops, rules, today))
        } catch {
          rh = -1
        }
      }
      if (rh >= 0) withRh++
      const dr = drought.get(field.cell) ?? -1
      if (tsv !== null) writeSync(tsv, [field.id, rh, dr].join(TAB) + NL)
      else scores[field.id] = { rh, dr }
      n++
    }
  }
  if (tsv !== null) closeSync(tsv)
  else writeFileSync(dst, JSON.stringify(scores))
  const dr = [...drought.values()].filter((v) => v >= 0)
  console.log(JSON.stringify({ fields: n, withRotationHealth: withRh, cells: cells.size, droughtRange: dr.length ? [Math.min(...dr), Math.max(...dr)] : null, seconds: Math.round((Date.now() - t0) / 1000) }))
}

main()
