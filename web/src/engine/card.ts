// The field card's answer (PLAN §5.3): was / now / sow next / avoid / risks / watch.
// P1 version: candidates are ranked by predecessor effect and combos; full scoring arrives in P2.
import { cropCalendar, planSlots, sowingOpen, type Slot } from './calendar'
import { pairCombos, type ComboHit } from './combos'
import { hazards, type HazardResult } from './hazards'
import { checkRepeat, checkReturn, histToSeasons, type RuleCheck, type Season } from './precursors'
import type { ClimateCell, CropDef, CropId, CropsFile, FieldRecord, RulesFile } from './types'

export const HISTORY_FROM = 2016

export interface Candidate {
  crop: CropDef
  score: number
  effect: number
  combos: ComboHit[]
  checks: RuleCheck[] // non-ok checks only ('unknown' ones: could not check)
}

export interface Avoid {
  crop: CropDef
  check: RuleCheck
}

export interface WatchItem {
  crop: CropDef
  start: number // harvest-year dekads
  end: number
  what: string
}

export interface CardModel {
  seasons: Season[]
  slots: Slot[]
  target: number // harvest year of the first open slot
  prev: Season | undefined
  sowNext: Candidate[]
  avoid: Avoid[]
  risks: { crop: CropDef; results: HazardResult[] } | null
  watch: WatchItem[]
}

const FIELD_CROPS: CropId[] = ['w_wheat', 'w_barley', 's_barley', 'maize', 'sunflower', 'soy', 'sugar_beet', 'w_rape', 'peas', 'chickpea', 'sorghum']

export function buildCard(field: FieldRecord, cell: ClimateCell, crops: CropsFile, rules: RulesFile, today: Date): CardModel {
  const slots = planSlots(field, today)
  const open = slots.find((s) => !s.locked)!
  const target = open.y
  const seasons = histToSeasons(field.hist, HISTORY_FROM, target - 1)
  const prev = [...seasons].reverse().find((s) => s.y === target - 1)
  const ctx = { crops, rules, cell }
  const sowNext: Candidate[] = []
  const avoid: Avoid[] = []
  for (const id of FIELD_CROPS) {
    const crop = crops.crops.find((c) => c.id === id)
    if (!crop) continue
    const cal = cropCalendar(crop, cell)
    if (!cal || !sowingOpen(cal, target, today)) continue
    const checks = [checkReturn(seasons, crop, target), checkRepeat(seasons, crop, target)]
    const violation = checks.find((c) => c.status === 'violation')
    if (violation) {
      avoid.push({ crop, check: violation })
      continue
    }
    const effect = prev?.crop ? rules.predecessor.find((p) => p.from === prev.crop && p.to === id)?.effect ?? 0 : 0
    const combos = prev?.crop ? pairCombos(prev.crop, id, ctx) : []
    if (combos.some((c) => c.id === 'LATE_HARVEST')) {
      avoid.push({ crop, check: { status: 'violation', rule: 'LATE_HARVEST', source: null, lastYear: target - 1 } })
      continue
    }
    const score = effect * 3 + combos.reduce((s, c) => s + c.sign * c.points, 0)
    sowNext.push({ crop, score, effect, combos, checks: checks.filter((c) => c.status !== 'ok') })
  }
  sowNext.sort((a, b) => b.score - a.score || a.checks.length - b.checks.length || FIELD_CROPS.indexOf(a.crop.id) - FIELD_CROPS.indexOf(b.crop.id))
  const top = sowNext[0]?.crop
  const lastComplete = Math.min(today.getFullYear() - (today.getMonth() < 10 ? 1 : 0), cell.years[cell.years.length - 1]?.y ?? 0)
  const risks = top ? { crop: top, results: hazards(top, cell, lastComplete) } : null
  const watch: WatchItem[] = []
  if (top) {
    const cal = cropCalendar(top, cell)!
    for (const w of top.watch) {
      const base = w.window.from === 'sow' ? cal.sow.start : cal.harvest.start
      watch.push({ crop: top, start: base + w.window.start, end: base + w.window.end, what: w.what })
    }
  }
  return { seasons, slots, target, prev, sowNext: sowNext.slice(0, 3), avoid, risks, watch }
}
