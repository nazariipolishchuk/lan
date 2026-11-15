import { describe, expect, it } from 'vitest'
import { placeCard, unionBox } from './guideLayout'

const card = { w: 360, h: 180 }

describe('guide card placement', () => {
  it('sits below a small spotlight near the top', () => {
    const p = placeCard({ x: 10, y: 60, w: 370, h: 50 }, card.w, card.h, 390, 844)
    expect(p.top).toBe(60 + 50 + 14)
  })

  it('goes above a spotlight in the lower half when it cannot fit below', () => {
    const s = { x: 14, y: 560, w: 362, h: 200 }
    const p = placeCard(s, card.w, card.h, 390, 844)
    expect(p.top + card.h).toBeLessThanOrEqual(s.y)
  })

  it('rests on the bottom edge when it misses fitting below by less than the overlap', () => {
    const p = placeCard({ x: 14, y: 500, w: 362, h: 150 }, card.w, card.h, 390, 844)
    expect(p.top).toBe(844 - 8 - card.h)
  })

  it('lays over the lower part of a spotlight taller than the screen allows', () => {
    const s = { x: 0, y: 20, w: 390, h: 800 }
    const p = placeCard(s, card.w, card.h, 390, 844)
    expect(p.top).toBeGreaterThanOrEqual(8)
    expect(p.top + card.h).toBeLessThanOrEqual(844 - 8)
  })

  it('goes left of a spotlight in the right-hand panel on a wide screen', () => {
    const s = { x: 870, y: 300, w: 400, h: 120 }
    const p = placeCard(s, card.w, card.h, 1280, 800)
    expect(p.left + card.w).toBeLessThanOrEqual(s.x)
    expect(p.top).toBe(300)
  })

  it('never leaves the screen horizontally', () => {
    const p = placeCard({ x: 1200, y: 10, w: 70, h: 30 }, card.w, card.h, 1280, 800)
    expect(p.left).toBeGreaterThanOrEqual(8)
    expect(p.left + card.w).toBeLessThanOrEqual(1280 - 8)
  })

  it('takes the roomier side when neither quite fits', () => {
    const s = { x: 10, y: 235, w: 1245, h: 379 }
    const p = placeCard(s, card.w, 214, 1280, 800)
    expect(p.top).toBe(8)
    expect(p.top + 214).toBeLessThanOrEqual(s.y + 2)
  })

  it('centres the card with no spotlight', () => {
    expect(placeCard(null, card.w, card.h, 1280, 800)).toEqual({ top: 310, left: 460 })
  })

  it('unions boxes', () => {
    expect(unionBox([{ x: 10, y: 10, w: 10, h: 10 }, { x: 30, y: 5, w: 5, h: 40 }])).toEqual({ x: 10, y: 5, w: 25, h: 40 })
    expect(unionBox([])).toBeNull()
  })
})
