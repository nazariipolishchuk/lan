import { describe, expect, it } from 'vitest'
import type { Candidate } from '../engine/card'
import { crop } from '../engine/testkit'
import { sowReason } from './sowReason'

const cand = (unknownYears: number[]): Candidate => ({
  crop: crop('sunflower'), score: 80, effect: 0, combos: [], pinned: false,
  bars: { water: 80, heat: 80, soil: 80, disease: 100 },
  checks: [{ status: 'unknown', rule: 'EARLY_RETURN', unknownYears, source: null }],
} as unknown as Candidate)

describe('sowReason', () => {
  it('puts an unchecked rule first', () => {
    const r = sowReason(cand([2021, 2023]), [cand([2021, 2023]), cand([])], null, [])
    expect(r[0].key).toBe('card.unchecked')
  })
  it('says when the satellite suspects the same crop inside its return interval', () => {
    const seasons = [{ y: 2021, crop: null, known: false, group: 'summer' as const, hint: 'sunflower' as const },
      { y: 2023, crop: null, known: false, group: 'summer' as const, hint: 'sunflower' as const }]
    const r = sowReason(cand([2021, 2023]), [cand([2021, 2023])], null, seasons)
    expect(r[0]).toMatchObject({ key: 'sow.why.hinted', tone: 'warn', vars: { years: '2021, 2023', from: 2031 } })
  })
})
