// Explanations (PLAN §6.9): exactly five blocks per strategy, filled from templates (i18n keys + numbers).
// No generated prose. "Information gaps" is never empty.
import type { Season } from './precursors'
import type { PlanScore } from './score'
import type { Strategy } from './strategies'
import type { FieldRecord } from './types'

export interface Msg { key: string; params?: Record<string, string | number> }
export interface Explanation { why: Msg[]; evidence: Msg[]; benefits: Msg[]; gaps: Msg[]; check: Msg[] }

const yrs = (ys: number[]) => ys.join(', ')
const RISK_SHARE = 0.3 // a hazard in at least 30 % of years is a "check locally" item

/** Gaps that apply to every plan on this field, from its data and history. */
export function fieldGaps(field: FieldRecord, history: Season[]): Msg[] {
  const g: Msg[] = []
  g.push(field.soil ? { key: 'gap.soil_map' } : { key: 'gap.soil_unknown' })
  g.push({ key: 'gap.weather_scale' })
  const unknown = history.filter((s) => !s.known && !s.group).map((s) => s.y)
  if (unknown.length) g.push({ key: 'gap.history_unknown', params: { years: yrs(unknown) } })
  const summer = history.filter((s) => !s.known && s.group === 'summer').map((s) => s.y)
  if (summer.length) g.push({ key: 'gap.summer_unconfirmed', params: { years: yrs(summer) } })
  const modelYears = field.hist.filter((h) => h.src === 'model' && h.k !== 'unknown').map((h) => h.y)
  if (modelYears.length) g.push({ key: 'gap.history_estimated', params: { from: Math.min(...modelYears), to: Math.max(...modelYears) } })
  if (field.hist.some((h) => h.src === 'model' && h.k === 'winter_cereal')) g.push({ key: 'gap.winter_rapeseed' })
  // three winter seasons in a row from the model may be a perennial (alfalfa, grass) rather than wheat
  const w = history.filter((s) => s.crop === 'w_wheat' || s.group === 'winter').map((s) => s.y)
  if (w.some((y) => w.includes(y + 1) && w.includes(y + 2))) g.push({ key: 'gap.perennial' })
  if (field.flags.includes('small')) g.push({ key: 'gap.small_field' })
  g.push({ key: 'gap.no_prices' })
  return g
}

export function explain(s: Strategy, field: FieldRecord, history: Season[]): Explanation {
  const p: PlanScore = s.score
  const crops = p.slots.map((x) => x.crop).join(' → ')
  const why: Msg[] = []
  if (s.id === 'as_now') why.push({ key: `why.as_now.${s.basis ?? 'cycle'}`, params: { crops } })
  if (s.id === 'balanced') why.push({ key: 'why.balanced', params: { crops, total: Math.round(p.total) } })
  if (s.id === 'drought') why.push({ key: 'why.drought', params: { crops, water: Math.round(p.bars.water) } })

  const evidence: Msg[] = [{ key: 'ev.history' }]
  for (const t of p.tiles) {
    for (const h of t.hazards) {
      if (h.years > 0) evidence.push({ key: 'ev.hazard', params: { crop: t.crop.id, hazard: h.label, count: h.count, years: h.years, y: t.y } })
    }
  }

  const benefits: Msg[] = []
  for (const l of p.links) for (const c of l.combos) if (c.sign > 0) benefits.push({ key: 'benefit.combo', params: { combo: c.label, from: l.from, to: l.to } })
  if (p.comboPoints > 0 && !benefits.length) benefits.push({ key: 'benefit.diversity' })
  if (!benefits.length) benefits.push({ key: 'benefit.none' })

  const gaps = fieldGaps(field, history)
  if (s.assumed.length) gaps.unshift({ key: 'gap.assumed', params: { years: yrs(s.assumed) } })
  for (const t of p.tiles) {
    for (const c of t.checks) {
      if (c.status === 'unknown') gaps.push({ key: 'gap.check_unknown', params: { crop: t.crop.id, y: t.y, years: yrs(c.unknownYears ?? []) } })
    }
  }

  const check: Msg[] = []
  for (const t of p.tiles) {
    if (t.hard) check.push({ key: `check.hard.${t.hard.rule.toLowerCase()}`, params: { crop: t.crop.id, y: t.y, last: t.hard.lastYear ?? '' } })
    for (const h of t.hazards) {
      if (h.years > 0 && h.count / h.years >= RISK_SHARE) check.push({ key: 'check.hazard', params: { crop: t.crop.id, hazard: h.label, count: h.count, years: h.years } })
    }
  }
  for (const l of p.links) for (const c of l.combos) if (c.sign < 0) check.push({ key: 'check.combo', params: { combo: c.label, from: l.from, to: l.to } })
  check.push({ key: 'check.always' })
  return { why, evidence, benefits, gaps, check }
}
