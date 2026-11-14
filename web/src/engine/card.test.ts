import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildCard } from './card'
import { chunkKey, chunkOfId, decodeFieldId } from './fieldId'
import { hazards } from './hazards'
import { CROPS, RULES, crop, syntheticCell } from './testkit'
import type { ClimateCell, FieldChunk } from './types'

const here = fileURLToPath(new URL('.', import.meta.url))
const fixtures = join(here, '..', '..', 'public', 'fixtures')
const chunk = JSON.parse(readFileSync(join(fixtures, 'fields_557_848.json'), 'utf8')) as FieldChunk
const cell = JSON.parse(readFileSync(join(fixtures, 'climate_49.5_31.875.json'), 'utf8')) as ClimateCell
const today = new Date('2026-11-14')
const byId = (id: string) => chunk.fields.find((f) => f.id === id)!

describe('field ids', () => {
  it('decode to the centroid and the chunk key', () => {
    // '8a6ovcny14' is a real Cherkasy field id built by the pipeline
    const p = decodeFieldId('8a6ovcny14')!
    expect(p.lat).toBeGreaterThan(48)
    expect(p.lat).toBeLessThan(51)
    expect(chunkOfId('8a6ovcny14')).toBe(chunkKey(p.lat, p.lon))
    expect(decodeFieldId('fixture-A')).toBeNull()
  })
})

describe('hazards', () => {
  it('counts years in which the condition holds', () => {
    const c = syntheticCell(2000, 2026)
    for (const y of c.years) if (y.y % 4 === 0) y.hot35 = y.hot35.map(() => 2) // every fourth year is hot
    const maize = hazards(crop('maize'), c, 2025, 20).find((h) => h.id === 'maize_flowering_heat')!
    expect(maize.years).toBe(20)
    expect(maize.count).toBe(5) // 2008, 2012, 2016, 2020, 2024
  })
})

describe('field card on fixtures', () => {
  it('field A: sunflower is avoided until 2034 and not suggested', () => {
    const m = buildCard(byId('fixture-A'), cell, CROPS, RULES, today)
    expect(m.target).toBe(2027)
    const sun = m.avoid.find((a) => a.crop.id === 'sunflower')!
    expect(sun.check.lastYear).toBe(2026)
    expect(sun.check.allowedFrom).toBe(2034)
    expect(m.sowNext.map((c) => c.crop.id)).not.toContain('sunflower')
    expect(m.sowNext.length).toBe(3)
  })

  it('no winter crop is offered on 14 November', () => {
    const m = buildCard(byId('fixture-A'), cell, CROPS, RULES, today)
    for (const c of m.sowNext) expect(c.crop.type).not.toBe('winter')
  })

  it('field B: an emerged winter crop locks 2027, planning starts in 2028', () => {
    const m = buildCard(byId('fixture-B'), cell, CROPS, RULES, today)
    expect(m.slots[0]).toMatchObject({ y: 2027, locked: 'winter_crop' })
    expect(m.target).toBe(2028)
  })

  it('field C without history still gets suggestions, flagged as unchecked', () => {
    const m = buildCard(byId('fixture-C'), cell, CROPS, RULES, today)
    expect(m.sowNext.length).toBe(3)
    expect(m.sowNext.some((c) => c.checks.some((k) => k.status === 'unknown'))).toBe(true)
    expect(m.risks?.results.length).toBeGreaterThan(0)
  })
})

describe('emerged winter crop in the card', () => {
  it('counts the locked season as a winter season, not a gap', () => {
    const f = { id: 'x', c: [32, 49.4] as [number, number], ha: 50, adm: { oblast: 'Cherkasy', raion: '' }, cell: 't',
      soil: null, terrain: null, hist: [], now: { state: 'winter_crop' as const, asOf: '2026-10-25' }, bareDays: null, flags: [] }
    const card = buildCard(f, syntheticCell(1990, 2026), CROPS, RULES, new Date(2026, 10, 14))
    expect(card.target).toBe(2028)
    expect(card.seasons.find((s) => s.y === 2027)).toMatchObject({ known: false, group: 'winter' })
    // a spring crop cannot have been the winter crop that is up; for winter candidates 2027 stays unknown
    for (const c of card.sowNext) if (c.crop.type === 'spring') for (const k of c.checks) expect(k.unknownYears ?? []).not.toContain(2027)
  })
})
