import { describe, expect, it } from 'vitest'
import { buildCard } from '../engine/card'
import { DEFAULT_PRIORITIES } from '../engine/prefs'
import { histToSeasons } from '../engine/precursors'
import { suggestRotations } from '../engine/strategies'
import { CROPS, RULES, field, syntheticCell } from '../engine/testkit'
import type { HistoryItem } from '../engine/types'
import { UserStore, setOverride, setPlanSlot, setPrefs, setUnsafe, type KV } from './persist'

const TODAY = new Date(2026, 10, 14)
const cell = syntheticCell(1990, 2026)
const hist: HistoryItem[] = [2020, 2021, 2022, 2023, 2024, 2025, 2026].map((y, i) => ({
  y, k: i % 2 ? 'winter_cereal' : 'maize', p: 0.9, src: 'model' as const,
}))
const f = field({ id: 'abcdefghij', hist })

class MemKV implements KV {
  m = new Map<string, string>()
  getItem(k: string) { return this.m.get(k) ?? null }
  setItem(k: string, v: string) { this.m.set(k, v) }
}

const broken: KV = {
  getItem() { throw new Error('SecurityError') },
  setItem() { throw new Error('QuotaExceededError') },
}

describe('farmer inputs', () => {
  it('test_overrides_persist_and_recalculate', () => {
    const kv = new MemKV()
    const a = new UserStore(kv)
    const before = buildCard(f, cell, CROPS, RULES, TODAY, { overrides: a.data.overrides[f.id] })
    expect(before.avoid.map((x) => x.crop.id)).not.toContain('sunflower')

    // the farmer says 2024 was sunflower (the satellite said maize)
    a.save(setOverride(a.data, f.id, 2024, 'sunflower'))

    // a new visit reads the same storage
    const b = new UserStore(kv)
    expect(b.data.overrides[f.id]).toEqual({ 2024: 'sunflower' })
    const after = buildCard(f, cell, CROPS, RULES, TODAY, { overrides: b.data.overrides[f.id] })
    const sun = after.avoid.find((x) => x.crop.id === 'sunflower')
    expect(sun?.check.rule).toBe('EARLY_RETURN')
    expect(sun?.check.lastYear).toBe(2024)
    expect(after.seasons.find((s) => s.y === 2024)).toMatchObject({ crop: 'sunflower', known: true, farmer: true })

    // "I don't know" turns a confident model year into a gap
    b.save(setOverride(b.data, f.id, 2026, 'unknown'))
    const gap = buildCard(f, cell, CROPS, RULES, TODAY, { overrides: new UserStore(kv).data.overrides[f.id] })
    expect(gap.seasons.find((s) => s.y === 2026)).toMatchObject({ crop: null, known: false })

    // clearing restores the satellite estimate
    b.save(setOverride(setOverride(b.data, f.id, 2024, null), f.id, 2026, null))
    expect(new UserStore(kv).data.overrides[f.id]).toBeUndefined()
  })

  it('test_storage_unavailable_does_not_crash', () => {
    for (const kv of [broken, null]) {
      const s = new UserStore(kv)
      expect(s.ok).toBe(false)
      let d = s.save(setOverride(s.data, f.id, 2024, 'sunflower'))
      d = s.save(setUnsafe(d, f.id, true))
      d = s.save(setPlanSlot(d, f.id, 2027, { crop: 'soy' }))
      d = s.save(setPrefs(d, { ...DEFAULT_PRIORITIES, ban: ['maize'] }))
      // the edits live for this visit
      expect(s.data.overrides[f.id]).toEqual({ 2024: 'sunflower' })
      expect(s.data.unsafe[f.id]).toBe(true)
      expect(s.data.prefs.ban).toEqual(['maize'])
      const card = buildCard(f, cell, CROPS, RULES, TODAY, { overrides: d.overrides[f.id], prefs: d.prefs })
      expect(card.sowNext.map((c) => c.crop.id)).not.toContain('maize')
    }
  })

  it('a corrupt stored value falls back to defaults', () => {
    const kv = new MemKV()
    kv.setItem('lan.user.v1', '{not json')
    const s = new UserStore(kv)
    expect(s.data.prefs).toEqual(DEFAULT_PRIORITIES)
    expect(s.data.overrides).toEqual({})
  })

  it('a farmer-confirmed crop in the ground replaces the assumed wheat', () => {
    const g = field({ hist, now: { state: 'winter_crop', asOf: '2026-11-06' } })
    const seasons = histToSeasons(g.hist, 2016, 2027, undefined, { 2027: 'w_barley' })
    const s = suggestRotations(seasons, { crops: CROPS, rules: RULES, cell, field: g, today: TODAY })
    for (const x of s) expect(x.score.slots[0]).toMatchObject({ y: 2027, crop: 'w_barley', locked: true })
  })
})
