import { describe, expect, it } from 'vitest'
import { checkRepeat, checkReturn, histToSeasons, modelGroupsOnly } from './precursors'
import { crop } from './testkit'
import type { HistoryItem } from './types'

const h = (y: number, k: HistoryItem['k'], p = 0.9): HistoryItem => ({ y, k, p, src: 'model' })

describe('history → seasons', () => {
  it('maps classes to crops and low-confidence items to unknown', () => {
    const s = histToSeasons([h(2024, 'winter_cereal'), h(2025, 'sunflower', 0.4), h(2026, 'other')], 2024, 2026)
    expect(s).toEqual([
      { y: 2024, crop: 'w_wheat', known: true },
      { y: 2025, crop: null, known: false, hint: 'sunflower' }, // a hint, never used by the rules
      { y: 2026, crop: null, known: false },
    ])
  })

  it('missing years are unknown seasons', () => {
    expect(histToSeasons([], 2025, 2026).every((s) => !s.known)).toBe(true)
  })

  it('a farmer override wins over the model', () => {
    const s = histToSeasons([h(2025, 'maize'), { y: 2025, k: 'soy', p: 1, src: 'farmer' }], 2025, 2025)
    expect(s[0].crop).toBe('soy')
  })
})

describe('return intervals (Resolution No. 164)', () => {
  it('test_early_return_is_a_violation: sunflower in 2024, proposed for 2027', () => {
    const seasons = histToSeasons(
      [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026].map((y) =>
        h(y, y === 2024 ? 'sunflower' : 'winter_cereal')),
      2016, 2026)
    const r = checkReturn(seasons, crop('sunflower'), 2027)
    expect(r.status).toBe('violation')
    expect(r.rule).toBe('EARLY_RETURN')
    expect(r.lastYear).toBe(2024)
    expect(r.allowedFrom).toBe(2032) // 7 full seasons between
  })

  it('a crop returning after its full interval is fine', () => {
    const seasons = histToSeasons([2017, 2018, 2019, 2020, 2021, 2022, 2023].map((y) =>
      h(y, y === 2017 ? 'sunflower' : 'winter_cereal')), 2017, 2026)
    // 2017 → 2025 would be legal; 2024–2026 are unknown, but they cannot hide a sunflower that is
    // "too recent" only if they are known — so here the check cannot pass
    expect(checkReturn(seasons, crop('sunflower'), 2027).status).toBe('unknown')
    const known = histToSeasons([2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026].map((y) =>
      h(y, y === 2019 ? 'sunflower' : 'winter_cereal')), 2019, 2026)
    expect(checkReturn(known, crop('sunflower'), 2027)).toMatchObject({ status: 'ok' })
  })

  it('test_unknown_year_is_not_a_pass: a "?" season makes the interval check report "could not check"', () => {
    const seasons = histToSeasons([h(2021, 'maize'), h(2022, 'soy'), h(2023, 'winter_cereal'),
      h(2024, 'maize'), h(2025, 'sunflower', 0.3), h(2026, 'winter_cereal')], 2016, 2026)
    const r = checkReturn(seasons, crop('sunflower'), 2027)
    expect(r.status).toBe('unknown')
    expect(r.unknownYears).toContain(2025)
  })

  it('a known violation wins over unknown years', () => {
    const seasons = histToSeasons([h(2024, 'sunflower'), h(2025, 'maize', 0.2)], 2016, 2026)
    expect(checkReturn(seasons, crop('sunflower'), 2027).status).toBe('violation')
  })

  it('maize may repeat up to three seasons in a row', () => {
    const two = histToSeasons([h(2024, 'soy'), h(2025, 'maize'), h(2026, 'maize')], 2016, 2026)
    expect(checkReturn(two, crop('maize'), 2027).status).toBe('ok')
    expect(checkRepeat(two, crop('maize'), 2027).status).toBe('ok')
    // with 2024 unknown, 2027 could be the fourth maize in a row: cannot check
    const gap = histToSeasons([h(2025, 'maize'), h(2026, 'maize')], 2016, 2026)
    expect(checkRepeat(gap, crop('maize'), 2027).status).toBe('unknown')
    const three = histToSeasons([h(2024, 'maize'), h(2025, 'maize'), h(2026, 'maize')], 2016, 2026)
    expect(checkRepeat(three, crop('maize'), 2027).status).toBe('violation')
  })
})

describe('modelGroupsOnly (USA)', () => {
  it('drops the crop name of model seasons and keeps their group; map years stay', () => {
    const hist: HistoryItem[] = [
      { y: 2025, k: 'maize', p: 0.95, src: 'map' },
      { y: 2026, k: 'sugar_beet', p: 0.7, src: 'model', g: 'summer' },
    ]
    const s = histToSeasons(modelGroupsOnly(hist), 2025, 2026)
    expect(s[0]).toMatchObject({ crop: 'maize', known: true })
    expect(s[1]).toMatchObject({ crop: null, known: false, group: 'summer' })
    expect(s[1].hint).toBeUndefined()
  })
})
