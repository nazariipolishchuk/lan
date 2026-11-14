// Farmer priorities and constraints (PLAN §5.5, S4). Pure: turns the farmer's settings into
// scoring weights and into reasons a crop cannot be offered. Defaults change nothing.
import type { Weights } from './score'
import type { CropId } from './types'

export interface Priorities {
  /** Four sliders, 0..100; 50 is neutral. */
  weights: { water: number; soil: number; risk: number; cash: number }
  equipment: { beetHarvester: boolean; rowPlanter: boolean; dryer: boolean }
  /** "I can sell": false = no buyer for this crop. Missing = yes. */
  sell: Partial<Record<CropId, boolean>>
  irrigation: boolean
  pin: CropId[]
  ban: CropId[]
}

export const DEFAULT_PRIORITIES: Priorities = {
  weights: { water: 50, soil: 50, risk: 50, cash: 50 },
  equipment: { beetHarvester: true, rowPlanter: true, dryer: true },
  sell: {},
  irrigation: false,
  pin: [],
  ban: [],
}

/** Crops that bring cash in this region (LOCAL_KNOWLEDGE.md): the "keep cash crops" slider rewards them. */
export const CASH_CROPS: CropId[] = ['sunflower', 'w_rape', 'soy', 'maize']
/** Row crops need a row-crop (precision) planter. */
const ROW_CROPS: CropId[] = ['maize', 'sunflower', 'sugar_beet']

export type BlockReason = 'ban' | 'no_sell' | 'no_beet_harvester' | 'no_row_planter' | 'no_dryer'

/** Why this crop cannot be offered on this farm, or null. Checked in this order. */
export function blockReason(crop: CropId, p: Priorities): BlockReason | null {
  if (p.ban.includes(crop)) return 'ban'
  if (p.sell[crop] === false) return 'no_sell'
  if (crop === 'sugar_beet' && !p.equipment.beetHarvester) return 'no_beet_harvester'
  if (ROW_CROPS.includes(crop) && !p.equipment.rowPlanter) return 'no_row_planter'
  if (crop === 'maize' && !p.equipment.dryer) return 'no_dryer'
  return null
}

const BASE = { water: 0.3, heat: 0.2, soil: 0.25, disease: 0.25 }

/**
 * Sliders → weights. 50 keeps the default weight, 0 removes it, 100 doubles it. "Lower risk" scales heat
 * and disease together. "Keep cash crops" only acts above the middle: it adds the share of cash crops.
 */
export function toWeights(p: Priorities): Weights {
  const f = (v: number) => Math.max(0, Math.min(100, v)) / 50
  return {
    water: BASE.water * f(p.weights.water),
    heat: BASE.heat * f(p.weights.risk),
    soil: BASE.soil * f(p.weights.soil),
    disease: BASE.disease * f(p.weights.risk),
    cash: 0.25 * Math.max(0, f(p.weights.cash) - 1),
  }
}

/** Irrigation removes most of the water shortfall of a tile (70 %). */
export const IRRIGATION_RELIEF = 0.7

export function isDefault(p: Priorities): boolean {
  return JSON.stringify(p) === JSON.stringify(DEFAULT_PRIORITIES)
}

/** Fill missing parts of a stored value (older versions, hand edits) from the defaults. */
export function normalisePriorities(v: unknown): Priorities {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<Priorities>
  return {
    weights: { ...DEFAULT_PRIORITIES.weights, ...(o.weights ?? {}) },
    equipment: { ...DEFAULT_PRIORITIES.equipment, ...(o.equipment ?? {}) },
    sell: { ...(o.sell ?? {}) },
    irrigation: !!o.irrigation,
    pin: Array.isArray(o.pin) ? o.pin : [],
    ban: Array.isArray(o.ban) ? o.ban : [],
  }
}
