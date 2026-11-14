// The whole card and the three strategies on real showcase fields (skipped without data/out).
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildCard } from './card'
import { explain } from './explain'
import { chunkOfId } from './fieldId'
import { histToSeasons } from './precursors'
import { suggestRotations } from './strategies'
import { CROPS, RULES, readChunk } from './testkit'
import type { ClimateCell, FieldChunk } from './types'

const here = fileURLToPath(new URL('.', import.meta.url))
const data = join(here, '..', '..', 'public', 'data')
const has = existsSync(join(data, 'fields'))
const TODAY = new Date(2026, 10, 14)
const SHOWCASE = ['894u6cj46a', '8bohkcn1oa', '89e3pcioxe']

function load(id: string) {
  const ck = chunkOfId(id)!
  const chunk = readChunk<FieldChunk>(join(data, 'fields', ck))
  const field = chunk.fields.find((f) => f.id === id)!
  const cell = JSON.parse(readFileSync(join(data, 'climate', `${field.cell}.json`), 'utf8')) as ClimateCell
  return { field, cell }
}

describe.skipIf(!has)('showcase fields on real data', () => {
  for (const id of SHOWCASE) {
    it(id, () => {
      const { field, cell } = load(id)
      const t0 = performance.now()
      const card = buildCard(field, cell, CROPS, RULES, TODAY)
      const t1 = performance.now()
      const seasons = histToSeasons(field.hist, 2016, card.target - 1)
      const strat = suggestRotations(seasons, { crops: CROPS, rules: RULES, cell, field, today: TODAY })
      const t2 = performance.now()
      const strip = card.seasons.map((s) => `${s.y % 100}:${s.crop ?? (s.group ? s.group[0] + '?' + (s.hint ?? '') : '?')}`).join(' ')
      console.log(`${id} ${field.ha} ha, now ${field.now?.state}, bare ${field.bareDays} d, health ${card.health}\n  was ${strip}\n  sow ${card.sowNext.map((c) => `${c.crop.id} ${c.score}`).join(', ')} | avoid ${card.avoid.map((a) => `${a.crop.id}:${a.check.rule}`).join(', ')}\n  ` +
        strat.map((s) => `${s.id}: ${s.score.slots.map((x) => x.crop).join('→')} total ${s.score.total} water ${Math.round(s.score.bars.water)}`).join('\n  ') +
        `\n  gaps: ${explain(strat[1], field, seasons).gaps.map((g) => g.key).join(', ')}\n  card ${Math.round(t1 - t0)} ms, strategies ${Math.round(t2 - t1)} ms`)
      expect(card.sowNext.length).toBeGreaterThan(0)
      expect(strat).toHaveLength(3)
      expect(t2 - t1).toBeLessThan(2000)
    })
  }
})
