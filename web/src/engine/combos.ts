// Combos and anti-combos between neighbouring seasons (PLAN §6.4).
import { cropCalendar } from './calendar'
import type { ClimateCell, ComboId, CropId, CropsFile, RulesFile } from './types'

export interface ComboHit {
  id: ComboId
  sign: 1 | -1
  points: number
  label: string
  source: string | null
}

export interface ComboContext {
  crops: CropsFile
  rules: RulesFile
  cell: ClimateCell
}

/** Previous season's harvest ends after the next (winter) crop's sowing window closes. */
export function lateHarvest(prev: CropId, next: CropId, ctx: ComboContext): boolean {
  const p = ctx.crops.crops.find((c) => c.id === prev)
  const n = ctx.crops.crops.find((c) => c.id === next)
  if (!p || !n || n.type !== 'winter') return false
  const pc = cropCalendar(p, ctx.cell)
  const nc = cropCalendar(n, ctx.cell)
  if (!pc || !nc) return false
  // the previous crop is harvested in the year before the next harvest: shift by one year
  const prevHarvestEnd = pc.harvest.end - 36
  return prevHarvestEnd > nc.sow.end
}

/** Combos for one pair of neighbouring seasons, in rules.json order. Diversity and return are scored elsewhere. */
export function pairCombos(prev: CropId, next: CropId, ctx: ComboContext): ComboHit[] {
  const hits: ComboHit[] = []
  for (const c of ctx.rules.combos) {
    let hit = false
    switch (c.id) {
      case 'LATE_HARVEST':
        hit = lateHarvest(prev, next, ctx)
        break
      case 'DRY_PROFILE':
        hit = !!c.from?.includes(prev)
        break
      case 'COVER_SHIELD':
        hit = prev === 'cover'
        break
      case 'DIVERSITY_3':
      case 'EARLY_RETURN':
        hit = false // need more than two seasons; see scoring
        break
      default:
        hit = !!c.from?.includes(prev) && !!c.to?.includes(next)
    }
    if (hit) hits.push({ id: c.id, sign: c.sign, points: c.points.v, label: c.label, source: c.source })
  }
  return hits
}
