import { describe, expect, it } from 'vitest'
import { cropCalendar } from './calendar'
import { pairCombos } from './combos'
import { CROPS, RULES, syntheticCell } from './testkit'
import type { CropId } from './types'

const cell = syntheticCell()
const ctx = { crops: CROPS, rules: RULES, cell }
const ids = (prev: CropId, next: CropId) => pairCombos(prev, next, ctx).map((c) => c.id)

describe('pair combos', () => {
  it('test_nitrogen_bonus: soy → winter wheat produces N_BONUS', () => {
    const hits = pairCombos('soy', 'w_wheat', ctx)
    expect(hits.map((c) => c.id)).toContain('N_BONUS')
    expect(hits.find((c) => c.id === 'N_BONUS')!.sign).toBe(1)
    expect(hits.map((c) => c.id)).not.toContain('LATE_HARVEST')
  })

  it('test_late_harvest_blocks_winter_crop: maize → winter wheat is flagged from the cell calendar', () => {
    const maize = cropCalendar(CROPS.crops.find((c) => c.id === 'maize')!, cell)!
    const wheat = cropCalendar(CROPS.crops.find((c) => c.id === 'w_wheat')!, cell)!
    expect(maize.harvest.end - 36).toBeGreaterThan(wheat.sow.end) // the premise, from the climate
    const hits = ids('maize', 'w_wheat')
    expect(hits).toContain('LATE_HARVEST')
    expect(hits).toContain('FUSARIUM')
  })

  it('late harvest is not flagged in front of a spring crop', () => {
    expect(ids('maize', 'soy')).not.toContain('LATE_HARVEST')
  })

  it('rapeseed → winter wheat is a break crop; wheat → wheat is a cereal repeat', () => {
    expect(ids('w_rape', 'w_wheat')).toContain('BREAK_CROP')
    expect(ids('w_wheat', 'w_wheat')).toContain('CEREAL_REPEAT')
  })

  it('sunflower next to soybean shares white mould, and leaves a dry profile', () => {
    const hits = ids('sunflower', 'soy')
    expect(hits).toContain('WHITE_MOLD')
    expect(hits).toContain('DRY_PROFILE')
  })

  it('every hit carries its points and label from rules.json', () => {
    for (const c of pairCombos('soy', 'w_wheat', ctx)) {
      expect(c.points).toBeGreaterThan(0)
      expect(c.label).toMatch(/^combo\./)
    }
  })

  it('identical inputs give identical outputs', () => {
    expect(pairCombos('maize', 'w_wheat', ctx)).toEqual(pairCombos('maize', 'w_wheat', ctx))
  })
})
