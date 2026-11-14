// The field card's answer (PLAN §5.3): was / now / sow next / avoid / risks / watch / rotation health.
// Candidates for the next open season are ranked by the full four-bar score of that season (score.ts).
import { cropCalendar, planSlots, sowingOpen, type Slot } from './calendar'
import { pairCombos, type ComboHit } from './combos'
import { hazards, type HazardResult } from './hazards'
import { blockReason, toWeights, type BlockReason, type Priorities } from './prefs'
import { checkRepeat, checkReturn, histToSeasons, type Overrides, type RuleCheck, type Season } from './precursors'
import { lastCompleteYear, rotationHealth, scenarioYears, scorePlan, type Bars, type Scenario, type ScoreContext } from './score'
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
  pinned?: boolean
}

/** What the farmer set in this browser (S3, S4, scenario). Everything optional: defaults change nothing. */
export interface CardOptions {
  overrides?: Overrides
  prefs?: Priorities
  scenario?: Scenario
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
  /** Crops ruled out by the farmer's own constraints (ban, no buyer, no machine), greyed out with the reason. */
  blocked: { crop: CropDef; reason: BlockReason }[]
  /** Seasons and scoring context, shared with Compare and the crop detail. */
  ctx: ScoreContext
  risks: { crop: CropDef; results: HazardResult[] } | null
  watch: WatchItem[]
  health: number // rotation health 0..100 of the last five known seasons, −1 when fewer than three are known
}

const FIELD_CROPS: CropId[] = ['w_wheat', 'w_barley', 's_barley', 'maize', 'sunflower', 'soy', 'sugar_beet', 'w_rape', 'peas', 'chickpea', 'sorghum']

/** The field's seasons up to the year before the first open slot, with the farmer's corrections. */
export function fieldSeasons(field: FieldRecord, today: Date, overrides: Overrides = {}): { seasons: Season[]; slots: Slot[]; target: number } {
  const slots = planSlots(field, today)
  const target = slots.find((s) => !s.locked)!.y
  const seasons = histToSeasons(field.hist, HISTORY_FROM, target - 1, undefined, overrides)
  // an emerged winter crop is a known winter season, not a gap (the farmer confirms which crop)
  for (const sl of slots) {
    const s = sl.locked ? seasons.find((x) => x.y === sl.y) : undefined
    if (s && !s.known && !s.farmer) s.group = 'winter'
  }
  return { seasons, slots, target }
}

export function scoreContext(field: FieldRecord, cell: ClimateCell, crops: CropsFile, rules: RulesFile, today: Date, opts: CardOptions = {}): ScoreContext {
  return { crops, rules, cell, field, today, scenario: opts.scenario, prefs: opts.prefs, weights: opts.prefs ? toWeights(opts.prefs) : undefined }
}

export function buildCard(field: FieldRecord, cell: ClimateCell, crops: CropsFile, rules: RulesFile, today: Date, opts: CardOptions = {}): CardModel {
  const { seasons, slots, target } = fieldSeasons(field, today, opts.overrides)
  const prev = [...seasons].reverse().find((s) => s.y === target - 1)
  const ctx = { crops, rules, cell }
  const sctx = scoreContext(field, cell, crops, rules, today, opts)
  const sowNext: Candidate[] = []
  const avoid: Avoid[] = []
  const blocked: CardModel['blocked'] = []
  for (const id of FIELD_CROPS) {
    const crop = crops.crops.find((c) => c.id === id)
    if (!crop) continue
    const cal = cropCalendar(crop, cell)
    if (!cal || !sowingOpen(cal, target, today)) continue
    const reason = opts.prefs ? blockReason(id, opts.prefs) : null
    if (reason) {
      blocked.push({ crop, reason })
      continue
    }
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
    sowNext.push({ crop, score: sc.total, bars: sc.tiles[0].bars, effect, combos, checks: checks.filter((c) => c.status !== 'ok'), pinned: opts.prefs?.pin.includes(id) })
  }
  const rank = (a: Candidate, b: Candidate) => b.score - a.score || a.checks.length - b.checks.length || FIELD_CROPS.indexOf(a.crop.id) - FIELD_CROPS.indexOf(b.crop.id)
  const other = sowNext.filter((c) => !LOCAL_CROPS.includes(c.crop.id)).sort(rank)
  const local = sowNext.filter((c) => LOCAL_CROPS.includes(c.crop.id)).sort(rank)
  sowNext.sort((a, b) => b.score - a.score || a.checks.length - b.checks.length || FIELD_CROPS.indexOf(a.crop.id) - FIELD_CROPS.indexOf(b.crop.id))
  const top = (local[0] ?? other[0])?.crop
  const lastComplete = Math.min(today.getFullYear() - (today.getMonth() < 10 ? 1 : 0), cell.years[cell.years.length - 1]?.y ?? 0)
  // the default card counts the last 20 years; a chosen climate scenario counts its own years
  const span = opts.scenario ? scenarioYears(cell, opts.scenario, lastCompleteYear(cell, today)) : 20
  const risks = top ? { crop: top, results: hazards(top, cell, lastComplete, span) } : null
  const watch: WatchItem[] = top ? watchList(top, cell, target) : []
  const health = rotationHealth(seasons, sctx)
  return { seasons, slots, target, prev, sowNext: local, other, avoid, blocked, ctx: sctx, risks, watch, health }
}
