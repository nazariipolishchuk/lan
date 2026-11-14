import { describe, expect, it } from 'vitest'
import { cropCalendar, dekadOf, planSlots, sowingOpen } from './calendar'
import { crop, field, syntheticCell } from './testkit'

const cell = syntheticCell()

describe('climate-derived calendars', () => {
  it('a spring crop is sown when the mean temperature rises past its threshold', () => {
    // maize threshold 12 °C → dekad 12 (early May) on the synthetic curve; season 15 dekads, harvest 4
    const cal = cropCalendar(crop('maize'), cell)!
    expect(cal.sow).toEqual({ start: 12, end: 13 })
    expect(cal.harvest).toEqual({ start: 27, end: 30 })
  })

  it('a winter crop is sown in the previous autumn, when the temperature falls past its threshold', () => {
    // winter wheat 15 °C → dekad 25 (early September) of the previous year = −11 in harvest-year dekads
    const cal = cropCalendar(crop('w_wheat'), cell)!
    expect(cal.sow).toEqual({ start: 25 - 36, end: 27 - 36 })
    expect(cal.harvest.start).toBe(25 - 36 + 29)
  })

  it('fallow and cover crops have no calendar', () => {
    expect(cropCalendar(crop('fallow'), cell)).toBeNull()
  })

  it('dekadOf splits months in three', () => {
    expect(dekadOf(new Date('2026-11-14'))).toEqual({ year: 2026, dekad: 31 })
    expect(dekadOf(new Date('2026-01-31'))).toEqual({ year: 2026, dekad: 2 })
  })
})

describe('date awareness', () => {
  const today = new Date('2026-11-14')

  it('test_closed_window_not_offered: on 2026-11-14 a winter crop is not offered for the 2027 season', () => {
    expect(sowingOpen(cropCalendar(crop('w_wheat'), cell)!, 2027, today)).toBe(false)
    expect(sowingOpen(cropCalendar(crop('w_rape'), cell)!, 2027, today)).toBe(false)
    // spring crops for 2027 and winter crops for 2028 are still open
    expect(sowingOpen(cropCalendar(crop('sunflower'), cell)!, 2027, today)).toBe(true)
    expect(sowingOpen(cropCalendar(crop('w_wheat'), cell)!, 2028, today)).toBe(true)
  })

  it('in early September the winter wheat window for next season is still open', () => {
    expect(sowingOpen(cropCalendar(crop('w_wheat'), cell)!, 2027, new Date('2026-09-05'))).toBe(true)
  })

  it('test_emerged_winter_crop_locks_first_slot', () => {
    const f = field({ now: { state: 'winter_crop', asOf: '2026-11-08' } })
    const slots = planSlots(f, today)
    expect(slots[0]).toMatchObject({ y: 2027, locked: 'winter_crop' })
    expect(slots.map((s) => s.y)).toEqual([2027, 2028, 2029, 2030])
    expect(slots.slice(1).every((s) => !s.locked)).toBe(true)
  })

  it('a bare field plans three open seasons from the next harvest year', () => {
    const slots = planSlots(field({ now: { state: 'bare', asOf: '2026-11-08' } }), today)
    expect(slots.map((s) => [s.y, s.locked ?? null])).toEqual([[2027, null], [2028, null], [2029, null]])
  })

  it('in spring the current year is still plannable', () => {
    expect(planSlots(field(), new Date('2027-03-10'))[0].y).toBe(2027)
  })
})
