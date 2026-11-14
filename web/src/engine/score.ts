// Four-bar scoring of a rotation plan (PLAN §6.6). Pure: no network, no randomness, no clock.
import { cropCalendar, sowingOpen } from './calendar'
import { pairCombos, type ComboHit } from './combos'
import { hazards, type HazardResult } from './hazards'
import { checkRepeat, checkReturn, type RuleCheck, type Season } from './precursors'
import type { ClimateCell, CropDef, CropId, CropsFile, Family, FieldRecord, HazardDef, Level, RulesFile } from './types'

export type Scenario = 'all' | 'last10' | 'dry'
export interface Weights { water: number; heat: number; soil: number; disease: number }
export interface Bars { water: number; heat: number; soil: number; disease: number }
export const DEFAULT_WEIGHTS: Weights = { water: 0.3, heat: 0.2, soil: 0.25, disease: 0.25 }
export const COMBO_BOUND = 15

export interface PlanSlot { y: number; crop: CropId; locked?: boolean; cover?: boolean }

export interface ScoreContext {
  crops: CropsFile
  rules: RulesFile
  cell: ClimateCell
  field: FieldRecord
  today: Date
  scenario?: Scenario
  weights?: Weights
}

export interface TileScore {
  y: number
  crop: CropDef
  bars: Bars
  hard: RuleCheck | null // a hard violation turns the tile red
  checks: RuleCheck[] // non-ok checks, including 'unknown' (could not check)
  hazards: HazardResult[]
}

export interface Link { from: number; to: number; combos: ComboHit[] }

export interface PlanScore {
  slots: PlanSlot[]
  tiles: TileScore[]
  links: Link[]
  bars: Bars
  comboPoints: number // bounded to ±COMBO_BOUND
  total: number // 0..100
  hard: boolean
}

const WATER_VARS = new Set<HazardDef['variable']>(['rain', 'balance', 'wet', 'et0'])
const HEAT_VARS = new Set<HazardDef['variable']>(['hot30', 'hot35', 'tmin'])
const DEMAND: Record<Level, number> = { low: 10, medium: 20, high: 30 }
const RESIDUE: Record<Level, number> = { low: -5, medium: 0, high: 5 }
const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v))
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

// ---------- climate scenario ----------

/** A year is complete when rain and ET0 have all 36 dekads. */
export function completeYears(cell: ClimateCell, lastYear: number): number[] {
  return cell.years.filter((y) => y.y <= lastYear && y.rain.every((v) => v !== null) && y.et0.every((v) => v !== null)).map((y) => y.y)
}

/** April–September climatic water balance (rain − ET0), mm. */
export function seasonBalance(cell: ClimateCell, year: number): number {
  const y = cell.years.find((v) => v.y === year)
  if (!y) return NaN
  let s = 0
  for (let d = 9; d <= 26; d++) s += (y.rain[d] ?? 0) - (y.et0[d] ?? 0)
  return s
}

/** Years a hazard frequency is computed over: all complete years, the last ten, or the driest third. */
export function scenarioYears(cell: ClimateCell, scenario: Scenario, lastYear: number): number[] {
  const all = completeYears(cell, lastYear)
  if (scenario === 'last10') return all.slice(-10)
  if (scenario === 'dry') {
    const n = Math.max(1, Math.round(all.length / 3))
    return [...all].sort((a, b) => seasonBalance(cell, a) - seasonBalance(cell, b) || a - b).slice(0, n).sort((a, b) => a - b)
  }
  return all
}

/** The last harvest year whose climate is complete on `today`. */
export function lastCompleteYear(cell: ClimateCell, today: Date): number {
  const ys = completeYears(cell, today.getFullYear())
  return ys[ys.length - 1] ?? today.getFullYear() - 1
}

// ---------- per-crop parts that do not depend on the plan (cached) ----------

interface CropClimate { hazards: HazardResult[]; waterFreq: number; heatFreq: number; deficitShare: number; heatReach: number }

const cache = new WeakMap<ClimateCell, Map<string, CropClimate>>()

export function cropClimate(crop: CropDef, cell: ClimateCell, years: number[]): CropClimate {
  const key = `${crop.id}|${years.join(',')}`
  let m = cache.get(cell)
  if (!m) cache.set(cell, (m = new Map()))
  const hit = m.get(key)
  if (hit) return hit
  const hz = hazards(crop, cell, 0, years)
  const freq = (vars: Set<HazardDef['variable']>) => {
    const r = hz.filter((h, i) => vars.has(crop.hazards[i].variable) && h.years > 0)
    return r.length ? mean(r.map((h) => h.count / h.years)) : 0
  }
  const cal = cropCalendar(crop, cell)
  let deficitShare = 0
  let heatReach = 1
  if (cal) {
    const byYear = new Map(cell.years.map((y) => [y.y, y]))
    let deficits = 0
    let n = 0
    let reached = 0
    for (const Y of years) {
      let bal = 0
      let ok = true
      for (let d = Math.max(cal.sow.start, -36); d <= cal.harvest.start; d++) {
        const yr = byYear.get(d < 0 ? Y - 1 : Y)
        const k = ((d % 36) + 36) % 36
        const r = yr?.rain[k]
        const e = yr?.et0[k]
        if (r == null || e == null) { ok = false; break }
        bal += r - e
      }
      if (!ok) continue
      n++
      if (bal < -200) deficits++
      const y = byYear.get(Y)
      if (crop.gdd && y) {
        const g = crop.gdd.base >= 10 ? y.gdd10 : y.gdd5
        if (g >= crop.gdd.sum.v) reached++
      } else reached++
    }
    deficitShare = n ? deficits / n : 0
    heatReach = n ? reached / n : 1
  }
  const res = { hazards: hz, waterFreq: freq(WATER_VARS), heatFreq: freq(HEAT_VARS), deficitShare, heatReach }
  m.set(key, res)
  return res
}

// ---------- plan scoring ----------

const familyOf = (crops: CropsFile, id: CropId | null): Family | null => (id ? crops.crops.find((c) => c.id === id)?.family ?? null : null)

/** History seasons followed by the plan, as one sequence for the rule checks. */
export function withPlan(history: Season[], slots: PlanSlot[]): Season[] {
  const planned = new Map(slots.map((s) => [s.y, s.crop]))
  const out = history.filter((s) => !planned.has(s.y))
  for (const s of slots) out.push({ y: s.y, crop: s.crop, known: true })
  return out.sort((a, b) => a.y - b.y)
}

export function scorePlan(slots: PlanSlot[], history: Season[], ctx: ScoreContext): PlanScore {
  const { crops, rules, cell, field, today } = ctx
  const weights = ctx.weights ?? DEFAULT_WEIGHTS
  const years = scenarioYears(cell, ctx.scenario ?? 'all', lastCompleteYear(cell, today))
  const seq = withPlan(history, slots)
  const at = (y: number) => seq.find((s) => s.y === y)
  const slope = field.terrain?.slope ?? 0
  const tiles: TileScore[] = []
  const links: Link[] = []
  let comboRaw = 0
  const first = slots[0]?.y

  for (const slot of slots) {
    const crop = crops.crops.find((c) => c.id === slot.crop)!
    const prev = at(slot.y - 1)
    const next = at(slot.y + 1)
    const cc = cropClimate(crop, cell, years)
    const checks = slot.locked ? [] : [checkReturn(seq, crop, slot.y), checkRepeat(seq, crop, slot.y)]
    const linkCombos = prev?.crop ? pairCombos(prev.crop, crop.id, { crops, rules, cell }) : []
    if (prev?.crop) links.push({ from: slot.y - 1, to: slot.y, combos: linkCombos })
    comboRaw += linkCombos.reduce((s, c) => s + c.sign * c.points, 0)

    // calendar feasibility: the window of the first slot may have closed; a late predecessor blocks a winter crop
    const cal = cropCalendar(crop, cell)
    const windowClosed = !slot.locked && slot.y === first && (!cal || !sowingOpen(cal, slot.y, today))
    const late = !slot.locked && linkCombos.some((c) => c.id === 'LATE_HARVEST')
    const ret = checks.find((c) => c.status === 'violation')
    let hard: RuleCheck | null = ret ?? null
    if (!hard && (windowClosed || late)) hard = { status: 'violation', rule: 'LATE_HARVEST', lastYear: slot.y - 1, source: null }

    // Water
    let water = 100 - 100 * cc.waterFreq - DEMAND[crop.water] * cc.deficitShare
    if (linkCombos.some((c) => c.id === 'DRY_PROFILE')) water -= 15
    // Heat
    let heat = 100 * cc.heatReach * (1 - cc.heatFreq)
    if (windowClosed || late) heat = 0
    // Soil
    const effect = prev?.crop ? rules.predecessor.find((p) => p.from === prev.crop && p.to === crop.id)?.effect ?? 0 : 0
    const prevDef = prev?.crop ? crops.crops.find((c) => c.id === prev.crop) : undefined
    let soil = 70 + effect * 10 + RESIDUE[crop.residue]
    if (prevDef?.fixesNitrogen) soil += 10
    if (slot.cover && crop.type === 'spring') soil += 10
    if (crop.residue === 'low') soil -= Math.min(20, slope * 2)
    else if (crop.residue === 'medium') soil -= Math.min(10, slope)
    // Disease
    let disease = 100
    for (const c of linkCombos) if (c.sign < 0 && ['CEREAL_REPEAT', 'FUSARIUM', 'WHITE_MOLD'].includes(c.id)) disease -= 25
    const host = rules.sharedHost.find((h) => h.crops.includes(crop.id))
    if (host && next?.crop && next.crop !== crop.id && host.crops.includes(next.crop)) disease -= 15
    for (const fs of rules.familyShareMax) {
      if (crop.family !== fs.family) continue
      const win = seq.filter((s) => s.y > slot.y - fs.window && s.y <= slot.y && s.known)
      const share = win.length ? win.filter((s) => familyOf(crops, s.crop) === fs.family).length / win.length : 0
      if (win.length >= 3 && share > fs.maxShare.v) disease -= 20
    }
    if (ret) disease = 0

    tiles.push({
      y: slot.y, crop, hard, checks: checks.filter((c) => c.status !== 'ok'), hazards: cc.hazards,
      bars: { water: clamp(water), heat: clamp(heat), soil: clamp(soil), disease: clamp(disease) },
    })
  }

  // cover crop between harvest and a spring crop
  for (const s of slots) if (s.cover && crops.crops.find((c) => c.id === s.crop)?.type === 'spring') comboRaw += comboPoints(rules, 'COVER_SHIELD')
  // diversity: three or more families within four seasons that include a planned one
  for (const s of slots) {
    const fams = new Set(seq.filter((x) => x.y > s.y - 4 && x.y <= s.y && x.crop).map((x) => familyOf(crops, x.crop)))
    if (fams.size >= 3) { comboRaw += comboPoints(rules, 'DIVERSITY_3'); break }
  }
  for (const t of tiles) if (t.hard?.rule === 'EARLY_RETURN') comboRaw -= comboPoints(rules, 'EARLY_RETURN')

  const bars: Bars = {
    water: mean(tiles.map((t) => t.bars.water)), heat: mean(tiles.map((t) => t.bars.heat)),
    soil: mean(tiles.map((t) => t.bars.soil)), disease: mean(tiles.map((t) => t.bars.disease)),
  }
  const wsum = weights.water + weights.heat + weights.soil + weights.disease
  const base = wsum > 0 ? (bars.water * weights.water + bars.heat * weights.heat + bars.soil * weights.soil + bars.disease * weights.disease) / wsum : 0
  const comboPts = Math.max(-COMBO_BOUND, Math.min(COMBO_BOUND, comboRaw))
  const total = clamp(base + comboPts)
  return { slots, tiles, links, bars, comboPoints: comboPts, total: Math.round(total * 10) / 10, hard: tiles.some((t) => t.hard) }
}

function comboPoints(rules: RulesFile, id: string): number {
  return rules.combos.find((c) => c.id === id)?.points.v ?? 0
}

/** Rotation health 0..100 of the last five known seasons: the plan score of that history (PLAN §6.1). */
export function rotationHealth(history: Season[], ctx: ScoreContext): number {
  const known = history.filter((s) => s.known && s.crop).slice(-5)
  if (known.length < 3) return -1
  const before = history.filter((s) => s.y < known[0].y)
  const slots = known.map((s) => ({ y: s.y, crop: s.crop!, locked: true }))
  return Math.round(scorePlan(slots, before, { ...ctx, today: new Date(known[known.length - 1].y, 7, 15) }).total)
}
