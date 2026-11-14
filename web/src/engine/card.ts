// The field card's answer (PLAN §5.3): was / now / sow next / avoid / risks / watch / rotation health.
// Candidates for the next open season are ranked by the full four-bar score of that season (score.ts).
import { cropCalendar, planSlots, sowingOpen, type Slot } from './calendar'
import { pairCombos, type ComboHit } from './combos'
import { hazards, type HazardResult } from './hazards'
import { checkRepeat, checkReturn, histToSeasons, type RuleCheck, type Season } from './precursors'
import { rotationHealth, scorePlan, type Bars, type ScoreContext } from './score'
import { LOCAL_CROPS } from './strategies'
import { watchList, type WatchItem } from './watch'
import type { ClimateCell, CropDef, CropId, CropsFile, FieldRecord, RulesFile } from './types'

export const HISTORY_FROM = 2016

export interface Candidate {
  crop: CropDef
  score: number // 0..100, the season's total
  bars: Bars
  effect: number
  combos: ComboHit[]
  checks: RuleCheck[] // non-ok checks only ('unknown' ones: could not check)
}

export interface Avoid {
  crop: CropDef
  check: RuleCheck
}

export type { WatchItem }

export interface CardModel {
  seasons: Season[]
  slots: Slot[]
  target: number // harvest year of the first open slot
  prev: Season | undefined
  sowNext: Candidate[] // crops grown nearby, best first; the farmer chooses
  other: Candidate[] // other crops that are possible (peas, chickpea, sorghum)
  avoid: Avoid[]
  risks: { crop: CropDef; results: HazardResult[] } | null
  watch: WatchItem[]
  health: number // rotation health 0..100 of the last five known seasons, −1 when fewer than three are known
}

const FIELD_CROPS: CropId[] = ['w_wheat', 'w_barley', 's_barley', 'maize', 'sunflower', 'soy', 'sugar_beet', 'w_rape', 'peas', 'chickpea', 'sorghum']

export function buildCard(field: FieldRecord, cell: ClimateCell, crops: CropsFile, rules: RulesFile, today: Date): CardModel {
  const slots = planSlots(field, today)
  const open = slots.find((s) => !s.locked)!
  const target = open.y
  const seasons = histToSeasons(field.hist, HISTORY_FROM, target - 1)
  // an emerged winter crop is a known winter season, not a gap (the farmer confirms which crop)
  for (const sl of slots) {
    const s = sl.locked ? seasons.find((x) => x.y === sl.y) : undefined
    if (s && !s.known) s.group = 'winter'
  }
  const prev = [...seasons].reverse().find((s) => s.y === target - 1)
  const ctx = { crops, rules, cell }
  const sctx: ScoreContext = { crops, rules, cell, field, today }
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
    const sc = scorePlan([{ y: target, crop: id }], seasons, sctx)
    sowNext.push({ crop, score: sc.total, bars: sc.tiles[0].bars, effect, combos, checks: checks.filter((c) => c.status !== 'ok') })
  }
  const rank = (a: Candidate, b: Candidate) => b.score - a.score || a.checks.length - b.checks.length || FIELD_CROPS.indexOf(a.crop.id) - FIELD_CROPS.indexOf(b.crop.id)
  const other = sowNext.filter((c) => !LOCAL_CROPS.includes(c.crop.id)).sort(rank)
  const local = sowNext.filter((c) => LOCAL_CROPS.includes(c.crop.id)).sort(rank)
  sowNext.sort((a, b) => b.score - a.score || a.checks.length - b.checks.length || FIELD_CROPS.indexOf(a.crop.id) - FIELD_CROPS.indexOf(b.crop.id))
  const top = (local[0] ?? other[0])?.crop
  const lastComplete = Math.min(today.getFullYear() - (today.getMonth() < 10 ? 1 : 0), cell.years[cell.years.length - 1]?.y ?? 0)
  const risks = top ? { crop: top, results: hazards(top, cell, lastComplete) } : null
  const watch: WatchItem[] = top ? watchList(top, cell, target) : []
  const health = rotationHealth(seasons, sctx)
  return { seasons, slots, target, prev, sowNext: local, other, avoid, risks, watch, health }
}
