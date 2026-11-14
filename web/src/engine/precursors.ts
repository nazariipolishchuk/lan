// Field history as seasons, and the return-interval rules of Resolution No. 164 (PLAN §6.1, §6.3).
import type { CropDef, CropId, HistClass, HistoryItem } from './types'

export interface Season {
  y: number
  crop: CropId | null
  known: boolean
}

/** History classes map onto crops for rule checks; `other` and `unknown` never satisfy a check. */
const CLASS_TO_CROP: Record<HistClass, CropId | null> = {
  winter_cereal: 'w_wheat', // winter wheat unless the farmer says barley
  spring_cereal: 's_barley',
  rapeseed: 'w_rape',
  maize: 'maize',
  sunflower: 'sunflower',
  soy: 'soy',
  sugar_beet: 'sugar_beet',
  other: null,
  unknown: null,
}

export const CONFIDENCE_THRESHOLD = 0.6

/** One season per year from..to. A farmer's item wins; model items below the threshold are unknown. */
export function histToSeasons(hist: HistoryItem[], from: number, to: number,
  threshold = CONFIDENCE_THRESHOLD, farmerCrops: Partial<Record<number, CropId>> = {}): Season[] {
  const out: Season[] = []
  for (let y = from; y <= to; y++) {
    if (farmerCrops[y]) {
      out.push({ y, crop: farmerCrops[y]!, known: true })
      continue
    }
    const items = hist.filter((h) => h.y === y)
    const item = items.find((h) => h.src === 'farmer') ?? items.find((h) => h.src !== 'farmer')
    const crop = item && (item.src === 'farmer' || item.p >= threshold) ? CLASS_TO_CROP[item.k] : null
    out.push({ y, crop, known: crop !== null })
  }
  return out
}

export interface RuleCheck {
  status: 'ok' | 'violation' | 'unknown'
  rule: 'EARLY_RETURN' | 'MAX_IN_ROW' | 'LATE_HARVEST'
  lastYear?: number
  allowedFrom?: number
  unknownYears?: number[]
  source: string | null
}

const seasonAt = (seasons: Season[], y: number) => seasons.find((s) => s.y === y)

/**
 * "Not earlier than after N years": at least `returnGap` full seasons between two crops of this kind.
 * A known repeat inside the gap is a violation; otherwise any unknown season in the gap means
 * the check could not be made.
 */
export function checkReturn(seasons: Season[], crop: CropDef, year: number): RuleCheck {
  const gap = crop.returnGap.v
  const source = crop.returnGap.source
  if (gap <= 0) return { status: 'ok', rule: 'EARLY_RETURN', source }
  const unknownYears: number[] = []
  for (let y = year - 1; y >= year - gap; y--) {
    const s = seasonAt(seasons, y)
    if (s?.crop === crop.id) return { status: 'violation', rule: 'EARLY_RETURN', lastYear: y, allowedFrom: y + gap + 1, source }
    if (!s || !s.known) unknownYears.push(y)
  }
  if (unknownYears.length) return { status: 'unknown', rule: 'EARLY_RETURN', unknownYears, source }
  return { status: 'ok', rule: 'EARLY_RETURN', source }
}

/** Crops that may repeat (maize) may do so at most `maxInRow` seasons in a row. */
export function checkRepeat(seasons: Season[], crop: CropDef, year: number): RuleCheck {
  const max = crop.maxInRow?.v
  const source = crop.maxInRow?.source ?? null
  if (!max) return { status: 'ok', rule: 'MAX_IN_ROW', source }
  for (let i = 1; i <= max; i++) {
    const s = seasonAt(seasons, year - i)
    if (!s || !s.known) return { status: i === 1 ? 'ok' : 'unknown', rule: 'MAX_IN_ROW', unknownYears: [year - i], source }
    if (s.crop !== crop.id) return { status: 'ok', rule: 'MAX_IN_ROW', source }
  }
  return { status: 'violation', rule: 'MAX_IN_ROW', lastYear: year - 1, allowedFrom: year + 1, source }
}
