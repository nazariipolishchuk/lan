// Rotation strategies (PLAN §6.7): As now, Balanced, Drought-proof; "My plan" is scored by scorePlan.
import { cropCalendar, planSlots, sowingOpen } from './calendar'
import { blockReason } from './prefs'
import type { Season } from './precursors'
import { scorePlan, type PlanScore, type PlanSlot, type ScoreContext } from './score'
import type { ClimateCell, CropId, CropsFile } from './types'

/** Dekads between a harvest and the next sowing that leave room for a cover crop (about two months). */
export const COVER_GAP = 6

/** A cover crop fits between `prev` (harvested the year before) and a spring crop `next`. */
export function coverFits(prev: CropId | null, next: CropId, crops: CropsFile, cell: ClimateCell): boolean {
  const n = crops.crops.find((c) => c.id === next)
  const p = prev ? crops.crops.find((c) => c.id === prev) : undefined
  if (!n || n.type !== 'spring' || !p || p.type === 'fallow' || p.type === 'cover') return false
  const nc = cropCalendar(n, cell)
  const pc = cropCalendar(p, cell)
  if (!nc || !pc) return false
  return nc.sow.start + 36 - pc.harvest.end >= COVER_GAP
}

/** Put a cover crop before every spring crop where the calendar allows it, and re-score. */
export function withCovers(p: PlanScore, history: Season[], ctx: ScoreContext): PlanScore {
  const prevOf = (y: number) => p.slots.find((s) => s.y === y - 1)?.crop ?? history.find((s) => s.y === y - 1)?.crop ?? null
  const slots = p.slots.map((s) => (s.locked ? s : { ...s, cover: coverFits(prevOf(s.y), s.crop, ctx.crops, ctx.cell) }))
  if (!slots.some((s) => s.cover)) return p
  return scorePlan(slots, history, ctx)
}

export type StrategyId = 'as_now' | 'balanced' | 'drought'

export interface Strategy {
  id: StrategyId
  score: PlanScore
  /** Years whose crop in "As now" was assumed rather than known (e.g. a summer season of unknown crop). */
  assumed: number[]
  /** How "As now" was built. */
  basis?: 'cycle' | 'repeat_last3' | 'regional_default'
}

/** Crops the planner may place in a slot. */
export const PLAN_CROPS: CropId[] = ['w_wheat', 'w_barley', 's_barley', 'maize', 'sunflower', 'soy', 'sugar_beet', 'w_rape', 'peas', 'chickpea', 'sorghum']
/**
 * Crops actually grown nearby (LOCAL_KNOWLEDGE.md; confirmed by N on 14 Nov). The card's "Sow next" and the
 * Balanced plan use only these; other crops (peas, chickpea, sorghum) appear as other options and in the
 * Drought-proof plan, where a less familiar but drought-tolerant crop is a fair idea.
 */
export const LOCAL_CROPS: CropId[] = ['w_wheat', 'w_barley', 's_barley', 'maize', 'sunflower', 'soy', 'sugar_beet', 'w_rape']
/** Used when a field has no usable history. Local knowledge: wheat, maize and sunflower dominate (LOCAL_KNOWLEDGE.md). */
export const REGIONAL_DEFAULT: CropId[] = ['w_wheat', 'maize', 'sunflower']
/** The same for the USA: the corn–soybean rotation that dominates the Corn Belt (USDA CDL). */
export const REGIONAL_DEFAULT_US: CropId[] = ['maize', 'soy']
/** Stand-in crop for a season known only at group level, for "As now" only (marked as assumed). */
const GROUP_STANDIN: Record<'winter' | 'summer', CropId> = { winter: 'w_wheat', summer: 'maize' }

/** The shortest cycle (2–4 seasons) that the whole sequence repeats, or null. */
export function findCycle<T>(seq: T[]): T[] | null {
  for (let len = 2; len <= 4; len++) {
    if (seq.length < len * 2) continue
    const cyc = seq.slice(0, len)
    if (seq.every((c, i) => c === cyc[i % len])) return cyc
  }
  return null
}

type Group = NonNullable<Season['group']>

export interface AsNowOptions {
  crops: CropsFile
  /** How badly the plan breaks hard rules (closed sowing window, return interval, late harvest); 0 = not at all. */
  hardCount?: (plan: CropId[]) => number
  /** The first slot holds an emerged winter crop. */
  locked?: CropId
  /** The local pattern for a field without usable history (default: Ukraine's). */
  regional?: CropId[]
}

/** The two winter cereals look the same from space: the history's "winter cereal" may be either. */
const SAME_FROM_SPACE: Partial<Record<CropId, CropId>> = { w_wheat: 'w_barley', w_barley: 'w_wheat' }

/**
 * "As now": continue what the field has been doing.
 * The pattern is the shortest cycle of crop names, else of groups (winter / summer: summer names are often
 * only hints that change every year), else the last three seasons. Its continuation is shifted so that
 * the first open season can still be sown, and each season may take another crop seen in the same group
 * of this field's history, so the baseline is the nearest pattern a farmer could actually follow.
 */
export function asNow(history: Season[], slotYears: number[], opts?: AsNowOptions): { crops: CropId[]; assumed: number[]; basis: Strategy['basis'] } {
  const groupOf = (id: CropId): Group => {
    const t = opts?.crops.crops.find((c) => c.id === id)?.type
    return t === 'winter' ? 'winter' : t === 'spring' ? 'summer' : 'uncultivated'
  }
  const recent = history.slice(-6)
  const assumed: number[] = []
  const seq: { name: CropId; group: Group }[] = []
  for (const s of recent) {
    if (s.crop) seq.push({ name: s.crop, group: s.group ?? groupOf(s.crop) })
    // an uncultivated season (pasture, hay, set-aside) says nothing about which crops the field follows
    else if (s.group && s.group !== 'uncultivated') { seq.push({ name: s.hint ?? GROUP_STANDIN[s.group], group: s.group }); assumed.push(s.y) }
  }
  const usable = seq.length >= 3 && assumed.length <= recent.length / 2 + 1

  // the pattern: per position, crop names in order of preference
  let pattern: CropId[][]
  let start: number
  let basis: Strategy['basis']
  const byFrequency = (names: CropId[]) => {
    const n = new Map<CropId, number>()
    names.forEach((c, i) => n.set(c, (n.get(c) ?? 0) + 1 + i / 100)) // ties: the most recent first
    return [...n.keys()].sort((a, b) => n.get(b)! - n.get(a)!)
  }
  if (!usable) {
    // the local pattern; a season may take the other local crop of its group, or the other winter cereal
    const regional = opts?.regional ?? REGIONAL_DEFAULT
    pattern = regional.map((c) => {
      const twin = SAME_FROM_SPACE[c]
      return [c, ...(twin ? [twin] : []), ...regional.filter((x) => x !== c && groupOf(x) === groupOf(c))]
    })
    start = 0
    basis = 'regional_default'
  } else {
    const names = seq.map((s) => s.name)
    const cyc = findCycle(names)
    const gcyc = cyc ? null : findCycle(seq.map((s) => s.group))
    if (cyc) {
      pattern = cyc.map((c) => [c])
      basis = 'cycle'
    } else if (gcyc) {
      // a cycle of groups: each position offers the names seen at that position, most frequent first
      pattern = gcyc.map((_, p) => byFrequency(names.filter((_, i) => i % gcyc.length === p)))
      basis = 'cycle'
    } else {
      pattern = names.slice(-3).map((c) => [c])
      basis = 'repeat_last3'
    }
    start = basis === 'repeat_last3' ? 0 : seq.length
    // alternatives seen in the same group of this field's history
    const seen = (g: Group) => byFrequency(names.filter((_, i) => seq[i].group === g))
    pattern = pattern.map((cands) => {
      const out = [...cands]
      for (const c of cands) { const twin = SAME_FROM_SPACE[c]; if (twin) out.push(twin) }
      for (const c of seen(groupOf(cands[0]))) out.push(c)
      return [...new Set(out)]
    })
  }

  const len = pattern.length
  const plans = function* (): Generator<CropId[]> {
    // every shift of the continuation, the straight one first; within a shift, preferred names first
    for (let k = 0; k < len; k++) {
      const cands = slotYears.map((_, i) => (i === 0 && opts?.locked ? [opts.locked] : pattern[(start + k + i) % len]))
      if (opts?.locked && groupOf(pattern[(start + k) % len][0]) !== 'winter' && k < len - 1 && pattern.some((c) => groupOf(c[0]) === 'winter')) continue
      const rec = function* (i: number, acc: CropId[]): Generator<CropId[]> {
        if (i === cands.length) { yield acc; return }
        for (const c of cands[i]) yield* rec(i + 1, [...acc, c])
      }
      yield* rec(0, [])
    }
  }
  // the first plan without a hard violation; if there is none, the one with the fewest
  let chosen: CropId[] | null = null
  let fewest = Infinity
  for (const p of plans()) {
    const n = opts?.hardCount ? opts.hardCount(p) : 0
    if (n < fewest) { chosen = p; fewest = n }
    if (n === 0) break
  }
  const crops = chosen ?? slotYears.map((_, i) => (opts?.regional ?? REGIONAL_DEFAULT)[i % len])
  return { crops, assumed: basis === 'regional_default' ? [...slotYears] : assumed, basis }
}

function slotsOf(years: number[], crops: CropId[], lockedFirst: boolean): PlanSlot[] {
  return years.map((y, i) => ({ y, crop: crops[i], locked: lockedFirst && i === 0 }))
}

const differ = (a: PlanSlot[], b: PlanSlot[]) => a.reduce((n, s, i) => n + (s.crop !== b[i].crop ? 1 : 0), 0)

/** The three strategies, always distinct. Exhaustive search over the open slots (≤ 11³ plans). */
export function suggestRotations(history: Season[], ctx: ScoreContext): Strategy[] {
  const { field, today, crops, cell } = ctx
  const plan = planSlots(field, today)
  const years = plan.map((s) => s.y)
  const lockedFirst = !!plan[0]?.locked
  // emerged winter crop: wheat unless the farmer says which one in the history editor
  const lockedCrop: CropId = history.find((s) => s.y === years[0] && s.farmer && s.crop)?.crop ?? 'w_wheat'
  const now = asNow(history, years, {
    crops,
    locked: lockedFirst ? lockedCrop : undefined,
    regional: field.c[0] < -30 ? REGIONAL_DEFAULT_US : REGIONAL_DEFAULT, // west of 30° W is the USA
    // a missed sowing window in the first open season is the least believable baseline: it weighs more
    hardCount: (p) => scorePlan(slotsOf(years, p, lockedFirst), history, ctx).tiles
      .reduce((n, t, i) => n + (t.hard ? (i === (lockedFirst ? 1 : 0) ? 1.5 : 1) : 0), 0),
  })
  const allowed = (id: CropId) => !ctx.prefs || !blockReason(id, ctx.prefs)
  const pins = ctx.prefs?.pin ?? []
  const asNowSlots = slotsOf(years, now.crops, lockedFirst)
  const asNowScore = scorePlan(asNowSlots, history, ctx)

  // candidates per open slot: the first open slot only offers crops whose sowing window is still open
  const open = (list: CropId[]) => years.map((y, i) => {
    if (lockedFirst && i === 0) return [lockedCrop]
    const firstOpen = lockedFirst ? 1 : 0
    const fits = list.filter((id) => {
      const def = crops.crops.find((c) => c.id === id)
      const cal = def && cropCalendar(def, cell)
      return !!cal && (i !== firstOpen || sowingOpen(cal, y, today))
    })
    // the farmer's bans and missing equipment remove crops; if nothing is left, the slot keeps all (and the UI says why)
    const ok = fits.filter(allowed)
    return ok.length ? ok : fits
  })
  const search = (cands: CropId[][]) => {
    const all: PlanScore[] = []
    const rec = (i: number, acc: CropId[]) => {
      if (i === years.length) {
        all.push(scorePlan(slotsOf(years, acc, lockedFirst), history, ctx))
        return
      }
      for (const c of cands[i]) rec(i + 1, [...acc, c])
    }
    rec(0, [])
    const feasible = all.filter((p) => !p.hard)
    const base = feasible.length ? feasible : all
    // pinned crops: prefer plans that keep every one of them
    const pinned = pins.length ? base.filter((p) => pins.every((c) => p.slots.some((s) => s.crop === c))) : []
    return pinned.length ? pinned : base
  }
  const localPool = search(open(LOCAL_CROPS))
  const pool = search(open(PLAN_CROPS))
  const byTotal = [...localPool].sort((a, b) => b.total - a.total || key(a).localeCompare(key(b)))
  const balanced = byTotal.find((p) => differ(p.slots, asNowSlots) >= 1) ?? byTotal[0]
  const best = balanced.total
  const near = (minDiff: number) => pool
    .filter((p) => p.total >= best * 0.85 && differ(p.slots, balanced.slots) >= minDiff && differ(p.slots, asNowSlots) >= 1)
    .sort((a, b) => b.bars.water - a.bars.water || b.total - a.total || key(a).localeCompare(key(b)))[0]
  const drought = near(2) ?? near(1) ?? [...pool].sort((a, b) => b.total - a.total || key(a).localeCompare(key(b))).find((p) => differ(p.slots, balanced.slots) >= 1 && differ(p.slots, asNowSlots) >= 1)!
  return [
    { id: 'as_now', score: asNowScore, assumed: now.assumed, basis: now.basis },
    { id: 'balanced', score: withCovers(balanced, history, ctx), assumed: [] },
    { id: 'drought', score: withCovers(drought, history, ctx), assumed: [] },
  ]
}

const key = (p: PlanScore) => p.slots.map((s) => s.crop).join(',')
