import { describe, expect, it } from 'vitest'
import { buildCard } from './card'
import { DEFAULT_PRIORITIES, blockReason, toWeights, type Priorities } from './prefs'
import { histToSeasons } from './precursors'
import { DEFAULT_WEIGHTS, scorePlan } from './score'
import { coverFits, suggestRotations } from './strategies'
import { CROPS, RULES, field, syntheticCell } from './testkit'
import type { HistoryItem } from './types'

const TODAY = new Date(2026, 10, 14)
const cell = syntheticCell(1990, 2026)
const hist: HistoryItem[] = [2021, 2022, 2023, 2024, 2025, 2026].map((y, i) => ({
  y, k: i % 2 ? 'winter_cereal' : 'sunflower', p: 0.9, src: 'model' as const,
}))
const f = field({ hist })
const seasons = histToSeasons(hist, 2016, 2026)
const P = (over: Partial<Priorities>): Priorities => ({ ...DEFAULT_PRIORITIES, ...over })

describe('priorities and constraints', () => {
  it('neutral sliders keep the default weights', () => {
    const w = toWeights(DEFAULT_PRIORITIES)
    for (const k of ['water', 'heat', 'soil', 'disease'] as const) expect(w[k]).toBeCloseTo(DEFAULT_WEIGHTS[k])
    expect(w.cash).toBe(0)
  })

  it('missing equipment and bans block crops with a reason', () => {
    expect(blockReason('sugar_beet', P({ equipment: { beetHarvester: false, rowPlanter: true, dryer: true } }))).toBe('no_beet_harvester')
    expect(blockReason('sunflower', P({ equipment: { beetHarvester: true, rowPlanter: false, dryer: true } }))).toBe('no_row_planter')
    expect(blockReason('maize', P({ equipment: { beetHarvester: true, rowPlanter: true, dryer: false } }))).toBe('no_dryer')
    expect(blockReason('soy', P({ sell: { soy: false } }))).toBe('no_sell')
    expect(blockReason('soy', P({ ban: ['soy'] }))).toBe('ban')
    expect(blockReason('soy', DEFAULT_PRIORITIES)).toBeNull()
  })

  it('a banned crop is never suggested, on the card or in any plan', () => {
    const prefs = P({ ban: ['soy', 'w_wheat'] })
    const card = buildCard(f, cell, CROPS, RULES, TODAY, { prefs })
    expect([...card.sowNext, ...card.other].map((c) => c.crop.id)).not.toContain('soy')
    expect(card.blocked.map((b) => b.crop.id)).toContain('soy')
    const s = suggestRotations(seasons, { crops: CROPS, rules: RULES, cell, field: f, today: TODAY, prefs })
    for (const x of s.slice(1)) for (const sl of x.score.slots) expect(['soy', 'w_wheat']).not.toContain(sl.crop)
  })

  it('a pinned crop appears in the suggested plans', () => {
    const prefs = P({ pin: ['sugar_beet'] })
    const s = suggestRotations(seasons, { crops: CROPS, rules: RULES, cell, field: f, today: TODAY, prefs })
    expect(s[1].score.slots.map((x) => x.crop)).toContain('sugar_beet')
  })

  it('irrigation never lowers the water bar', () => {
    const slots = [{ y: 2027, crop: 'maize' as const }, { y: 2028, crop: 'w_wheat' as const }]
    const ctx = { crops: CROPS, rules: RULES, cell, field: f, today: TODAY }
    const dry = scorePlan(slots, seasons, ctx)
    const wet = scorePlan(slots, seasons, { ...ctx, prefs: P({ irrigation: true }) })
    expect(wet.bars.water).toBeGreaterThanOrEqual(dry.bars.water)
  })

  it('raising "keep cash crops" raises a sunflower plan against a wheat-only one', () => {
    const ctx = { crops: CROPS, rules: RULES, cell, field: f, today: TODAY }
    const sun = [{ y: 2027, crop: 'soy' as const }]
    const neutral = scorePlan(sun, seasons, { ...ctx, weights: toWeights(DEFAULT_PRIORITIES) }).total
    const cash = scorePlan(sun, seasons, { ...ctx, weights: toWeights(P({ weights: { water: 50, soil: 50, risk: 50, cash: 100 } })) }).total
    expect(cash).toBeGreaterThan(neutral)
  })

  it('a cover crop fits after an early harvest before a spring crop, not before a winter crop', () => {
    expect(coverFits('w_wheat', 'soy', CROPS, cell)).toBe(true)
    expect(coverFits('w_wheat', 'w_barley', CROPS, cell)).toBe(false)
  })
})
