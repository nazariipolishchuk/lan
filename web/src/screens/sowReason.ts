// Why a crop in "Sow next" ranks where it does (pure: no React, no store, so it can be tested in Node).
import type { Candidate } from '../engine/card'
import type { Season } from '../engine/precursors'
import type { Bars } from '../engine/score'
import type { Key } from '../i18n/en'

export const BAR_KEYS: (keyof Bars)[] = ['water', 'heat', 'soil', 'disease']

export interface Reason { key: Key; vars: Record<string, string | number>; tone: 'go' | 'warn' | 'muted' }

/** Why a crop ranks where it does, in priority order: predecessor, combo, its own strength/weakness. */
export function sowReason(c: Candidate, all: Candidate[], prevCropName: string | null, seasons: Season[] = []): Reason[] {
  const out: Reason[] = []
  // an unchecked rule comes first: the satellite may have seen this very crop inside its return interval
  const unk = c.checks.find((k) => k.status === 'unknown')
  if (unk) {
    const gapYears = unk.unknownYears ?? []
    const hinted = seasons.filter((s) => s.hint === c.crop.id && gapYears.includes(s.y)).map((s) => s.y)
    if (hinted.length && unk.rule === 'EARLY_RETURN') {
      out.push({ key: 'sow.why.hinted', vars: { years: hinted.join(', '), from: Math.max(...hinted) + c.crop.returnGap.v + 1 }, tone: 'warn' })
    } else out.push({ key: 'card.unchecked', vars: { years: gapYears.slice(0, 3).join(', ') }, tone: 'muted' })
  }
  if (c.effect > 0 && prevCropName) out.push({ key: 'sow.why.after', vars: { crop: prevCropName, n: c.effect }, tone: 'go' })
  for (const k of c.combos) out.push({ key: k.sign > 0 ? 'sow.why.combo' : 'sow.why.anti', vars: { what: k.label }, tone: k.sign > 0 ? 'go' : 'warn' })
  const mean = (b: keyof Bars) => all.reduce((a, x) => a + x.bars[b], 0) / Math.max(1, all.length)
  const dev = BAR_KEYS.map((b) => ({ b, d: c.bars[b] - mean(b), v: Math.round(c.bars[b]) }))
  const best = dev.reduce((a, x) => (x.d > a.d ? x : a))
  const worst = dev.reduce((a, x) => (x.d < a.d ? x : a))
  if (all.length > 1 && best.d > 3) out.push({ key: 'sow.why.better', vars: { bar: `bar.${best.b}`, v: best.v }, tone: 'go' })
  if (all.length > 1 && worst.d < -3) out.push({ key: 'sow.why.worse', vars: { bar: `bar.${worst.b}`, v: worst.v }, tone: 'warn' })
  if (!out.length) out.push({ key: 'sow.why.even', vars: {}, tone: 'muted' })
  return out
}

