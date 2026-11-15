import { describe, expect, it } from 'vitest'
import { explain } from './explain'
import { hazards } from './hazards'
import { histToSeasons, type Season } from './precursors'
import { DEFAULT_WEIGHTS, scenarioYears, scorePlan, type PlanSlot, type ScoreContext } from './score'
import { LOCAL_CROPS, PLAN_CROPS, suggestRotations } from './strategies'
import { CROPS, RULES, crop, field, syntheticCell } from './testkit'
import type { ClimateCell, CropId, FieldRecord, HistoryItem } from './types'
import { watchList } from './watch'

const TODAY = new Date(2026, 10, 14)
const ctx = (over: Partial<ScoreContext> = {}): ScoreContext => ({
  crops: CROPS, rules: RULES, cell: syntheticCell(1990, 2026), field: field(), today: TODAY, ...over,
})
const season = (y: number, c: CropId | null): Season => ({ y, crop: c, known: c !== null })
const plan = (...crops: CropId[]): PlanSlot[] => crops.map((c, i) => ({ y: 2027 + i, crop: c }))
const hist = (items: [number, HistoryItem['k'], number?][]): HistoryItem[] =>
  items.map(([y, k, p]) => ({ y, k, p: p ?? 0.9, src: 'model' as const }))

function hotCell(hotYears: number[]): ClimateCell {
  const cell = syntheticCell(1990, 2026)
  for (const y of cell.years) if (hotYears.includes(y.y)) y.hot35 = y.hot35.map(() => 10)
  return cell
}

describe('hazards and scenarios', () => {
  it('test_hazard_frequency_counts_years', () => {
    const cell = hotCell([2016, 2019, 2023])
    const years = Array.from({ length: 12 }, (_, i) => 2014 + i).filter((y) => y >= 1990)
    const r = hazards(crop('maize'), cell, 0, years).find((h) => h.id === 'maize_flowering_heat')!
    expect(r.years).toBe(12)
    expect(r.count).toBe(3)
    expect(r.hitYears).toEqual([2016, 2019, 2023])
  })

  it('test_scenario_switch_changes_frequencies', () => {
    const recent = Array.from({ length: 10 }, (_, i) => 2016 + i)
    const cell = hotCell(recent)
    const freq = (s: 'all' | 'last10' | 'dry') => {
      const h = hazards(crop('maize'), cell, 0, scenarioYears(cell, s, 2025)).find((x) => x.id === 'maize_flowering_heat')!
      return h.count / h.years
    }
    expect(freq('last10')).toBe(1)
    expect(freq('all')).toBeCloseTo(10 / 36, 5)
    // the dry scenario picks the years with the lowest April–September water balance
    const dry = syntheticCell(1990, 2026)
    for (const y of dry.years) if (y.y % 3 === 0) y.rain = y.rain.map(() => 1)
    expect(scenarioYears(dry, 'dry', 2025).every((y) => y % 3 === 0)).toBe(true)
  })
})

describe('scorePlan', () => {
  it('test_adding_a_violation_never_raises_the_score', () => {
    const base: Season[] = Array.from({ length: 11 }, (_, i) => season(2016 + i, null))
    for (const c of PLAN_CROPS) {
      const def = crop(c)
      if (def.returnGap.v < 2) continue
      for (const p of [plan(c, 'w_wheat', 'maize'), plan('maize', c, 'w_wheat'), plan('soy', 'w_wheat', c)]) {
        const clean = scorePlan(p, base, ctx())
        const slotY = p.find((s) => s.crop === c)!.y
        const withV = base.map((s) => (s.y === 2025 ? season(2025, c) : s)) // inside every gap ≥ 2 for 2027..2029? not always
        const v = scorePlan(p, withV, ctx())
        const violated = v.tiles.some((t) => t.hard?.rule === 'EARLY_RETURN')
        if (slotY - 2025 <= def.returnGap.v) expect(violated).toBe(true)
        if (violated) expect(v.total).toBeLessThanOrEqual(clean.total)
      }
    }
  })

  it('a return violation turns the tile red and zeroes its Disease bar', () => {
    const h = [season(2024, 'sunflower'), season(2025, 'w_wheat'), season(2026, 'maize')]
    const s = scorePlan(plan('sunflower', 'w_wheat', 'soy'), h, ctx())
    const t = s.tiles[0]
    expect(t.hard?.rule).toBe('EARLY_RETURN')
    expect(t.bars.disease).toBe(0)
    expect(s.hard).toBe(true)
  })

  it('identical inputs give identical outputs', () => {
    const h = [season(2024, 'soy'), season(2025, 'w_wheat'), season(2026, 'maize')]
    const a = scorePlan(plan('soy', 'w_wheat', 'sunflower'), h, ctx())
    const b = scorePlan(plan('soy', 'w_wheat', 'sunflower'), h, ctx())
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('a zero weight removes a bar from the total', () => {
    const h = [season(2025, 'w_wheat'), season(2026, 'maize')]
    const p = plan('soy', 'w_wheat', 'sunflower')
    const w0 = { ...DEFAULT_WEIGHTS, water: 0 }
    const a = scorePlan(p, h, ctx({ weights: w0 }))
    const dryCell = syntheticCell(1990, 2026)
    for (const y of dryCell.years) y.rain = y.rain.map(() => 0)
    const b = scorePlan(p, h, ctx({ weights: w0, cell: dryCell }))
    expect(b.bars.water).toBeLessThan(a.bars.water)
    expect(b.total).toBe(a.total) // water changed, total did not
  })

  it('a known winter season rules out sunflower for the return check', () => {
    const items = hist([[2020, 'winter_cereal', 0.95], [2021, 'sunflower', 0.4], [2022, 'winter_cereal', 0.95]])
    items[1].g = 'summer'
    const seasons = histToSeasons(items, 2016, 2026)
    expect(seasons.find((s) => s.y === 2021)).toMatchObject({ known: false, group: 'summer', hint: 'sunflower' })
    const s = scorePlan(plan('sunflower', 'w_wheat', 'maize'), seasons, ctx())
    const chk = s.tiles[0].checks.find((c) => c.rule === 'EARLY_RETURN')!
    expect(chk.unknownYears).not.toContain(2020)
    expect(chk.unknownYears).not.toContain(2022)
    expect(chk.unknownYears).toContain(2021) // a summer season might have been sunflower
  })
})

describe('strategies', () => {
  const cases: [string, FieldRecord][] = [
    ['no history', field()],
    ['sunflower too soon', field({ hist: hist([[2022, 'winter_cereal'], [2023, 'sunflower'], [2024, 'winter_cereal'], [2025, 'maize'], [2026, 'soy']]) })],
    ['winter crop emerged', field({ now: { state: 'winter_crop', asOf: '2026-10-25' }, hist: hist([[2025, 'winter_cereal'], [2026, 'maize']]) })],
    ['cycle', field({ hist: hist([[2021, 'winter_cereal'], [2022, 'maize'], [2023, 'winter_cereal'], [2024, 'maize'], [2025, 'winter_cereal'], [2026, 'maize']]) })],
  ]
  for (const [name, f] of cases) {
    it(`test_three_strategies_always_returned_and_distinct (${name})`, () => {
      const seasons = histToSeasons(f.hist, 2016, 2026)
      const s = suggestRotations(seasons, ctx({ field: f }))
      expect(s.map((x) => x.id)).toEqual(['as_now', 'balanced', 'drought'])
      const keys = s.map((x) => x.score.slots.map((t) => t.crop).join(','))
      expect(new Set(keys).size).toBe(3)
      expect(s[1].score.hard).toBe(false)
      expect(s[1].score.slots.every((x) => LOCAL_CROPS.includes(x.crop))).toBe(true) // Balanced: local crops only
    })
  }

  it('As now continues a detected cycle', () => {
    const f = cases[3][1]
    const s = suggestRotations(histToSeasons(f.hist, 2016, 2026), ctx({ field: f }))
    expect(s[0].basis).toBe('cycle')
    // 14 Nov: the winter window has closed, so the cycle continues from its spring step
    expect(s[0].score.slots.map((x) => x.crop)).toEqual(['maize', 'w_wheat', 'maize'])
    expect(s[0].score.tiles[0].hard).toBeNull()
  })

  it('As now continues a cycle straight on while the winter window is still open', () => {
    const f = field({ hist: hist([[2021, 'winter_cereal'], [2022, 'soy'], [2023, 'winter_cereal'], [2024, 'soy'], [2025, 'winter_cereal'], [2026, 'soy']]) })
    const s = suggestRotations(histToSeasons(f.hist, 2016, 2026), ctx({ field: f, today: new Date(2026, 8, 5) }))
    expect(s[0].score.slots[0].crop).toMatch(/^w_/) // a winter cereal follows the 2026 soy
    expect(s[0].score.slots[1].crop).toBe('soy')
    expect(s[0].score.tiles[0].hard).toBeNull()
  })

  it('As now finds a winter / summer cycle when the summer names are only hints that change', () => {
    const items = hist([[2021, 'sunflower'], [2022, 'winter_cereal'], [2023, 'maize'], [2024, 'winter_cereal'], [2025, 'soy'], [2026, 'winter_cereal']])
    for (const h of items) if (h.k !== 'winter_cereal') { h.p = 0.4; h.g = 'summer' }
    const f = field({ hist: items })
    const s = suggestRotations(histToSeasons(f.hist, 2016, 2026), ctx({ field: f }))
    expect(s[0].basis).toBe('cycle')
    const groups = s[0].score.tiles.map((x) => x.crop.type)
    expect(groups).toEqual(['spring', 'winter', 'spring'])
    expect(s[0].score.tiles[0].hard).toBeNull() // the first season can still be sown
  })

  it('the regional pattern starts with a crop that can still be sown', () => {
    const s = suggestRotations([], ctx({ field: field() }))
    expect(s[0].basis).toBe('regional_default')
    expect(s[0].score.slots[0].crop.startsWith('w_')).toBe(false)
    expect(s[0].score.tiles[0].hard).toBeNull()
  })

  it('an emerged winter crop locks the first slot of every strategy', () => {
    const f = cases[2][1]
    const s = suggestRotations(histToSeasons(f.hist, 2016, 2026), ctx({ field: f }))
    for (const x of s) expect(x.score.slots[0]).toMatchObject({ y: 2027, crop: 'w_wheat', locked: true })
  })
})

describe('explanations', () => {
  it('test_sparse_history_year_shows_gap_in_explanation', () => {
    const f = field({ hist: hist([[2022, 'winter_cereal'], [2023, 'unknown', 0], [2024, 'maize'], [2025, 'winter_cereal'], [2026, 'soy']]) })
    const seasons = histToSeasons(f.hist, 2016, 2026)
    const s = suggestRotations(seasons, ctx({ field: f }))
    for (const x of s) {
      const e = explain(x, f, seasons)
      const g = e.gaps.find((m) => m.key === 'gap.history_unknown')
      expect(g).toBeTruthy()
      expect(String(g!.params!.years)).toContain('2023')
    }
  })

  it('test_information_gaps_never_empty', () => {
    const f = field({
      soil: { clay: 30, sand: 20, soc: 2.5, ph: 6.7 },
      hist: Array.from({ length: 11 }, (_, i) => ({ y: 2016 + i, k: (i % 2 ? 'maize' : 'winter_cereal') as HistoryItem['k'], p: 1, src: 'farmer' as const })),
    })
    const seasons = histToSeasons(f.hist, 2016, 2026)
    for (const x of suggestRotations(seasons, ctx({ field: f }))) {
      const e = explain(x, f, seasons)
      expect(e.gaps.length).toBeGreaterThan(0)
      expect(e.why.length).toBeGreaterThan(0)
      expect(e.check.length).toBeGreaterThan(0)
      expect(Object.keys(e)).toEqual(['why', 'evidence', 'benefits', 'gaps', 'check'])
    }
  })
})

describe('watch list', () => {
  it('dates follow the crop calendar and are ordered', () => {
    const w = watchList(crop('w_wheat'), syntheticCell(1990, 2026), 2027)
    expect(w.length).toBe(crop('w_wheat').watch.length)
    for (let i = 1; i < w.length; i++) expect(w[i].start).toBeGreaterThanOrEqual(w[i - 1].start)
    expect(w[0].from.getTime()).toBeLessThan(w[w.length - 1].to.getTime())
    expect(w[0].from.getFullYear()).toBeGreaterThanOrEqual(2026)
  })
})
