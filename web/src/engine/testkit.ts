// Synthetic inputs for engine tests. Temperatures follow a smooth Forest-Steppe-like curve:
// tmean(d) = 8 + 13·sin(2π(d − 9.5)/36): −5 °C in early January, 21 °C in early July.
import crops from '../../public/rules/crops.json'
import rules from '../../public/rules/rules.json'
import type { ClimateCell, CropDef, CropId, CropsFile, FieldRecord, RulesFile, YearIndicators } from './types'

export const CROPS = crops as unknown as CropsFile
export const RULES = rules as unknown as RulesFile
export const crop = (id: CropId): CropDef => CROPS.crops.find((c) => c.id === id)!

export const tmeanAt = (d: number) => 8 + 13 * Math.sin((2 * Math.PI * (d - 9.5)) / 36)

export function syntheticCell(firstYear = 2014, lastYear = 2026): ClimateCell {
  const years: YearIndicators[] = []
  for (let y = firstYear; y <= lastYear; y++) {
    const tmean = Array.from({ length: 36 }, (_, d) => Math.round(tmeanAt(d) * 10) / 10)
    years.push({
      y, gdd5: 2900, gdd10: 1500, lastSpringFrostDoy: 105, firstAutumnFrostDoy: 290, heavyRainDays: 3,
      tmean, rain: tmean.map(() => 15), et0: tmean.map((t) => Math.max(1, t * 2)), hot30: tmean.map(() => 0),
      hot35: tmean.map(() => 0), tmin: tmean.map((t) => t - 6), wet: tmean.map(() => 0.6),
    })
  }
  return { v: 1, id: 'test', lat: 49.5, lon: 31.875, years }
}

export function field(over: Partial<FieldRecord> = {}): FieldRecord {
  return {
    id: 'f', c: [32, 49.4], ha: 50, adm: { oblast: 'Cherkasy', raion: '' }, cell: 'test',
    soil: null, terrain: null, hist: [], now: null, bareDays: null, flags: [], ...over,
  }
}
