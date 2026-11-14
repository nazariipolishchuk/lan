// Hazards as "x of N years" (PLAN §6.5): a condition inside a crop's critical window, per year.
import { cropCalendar } from './calendar'
import type { ClimateCell, CropDef, HazardDef, YearIndicators } from './types'

export interface HazardResult {
  id: string
  label: string
  count: number
  years: number
  hitYears: number[]
}

function value(y: YearIndicators, variable: HazardDef['variable'], d: number): number | null {
  if (variable === 'balance') {
    const r = y.rain[d]
    const e = y.et0[d]
    return r === null || e === null ? null : r - e
  }
  return y[variable][d]
}

/** Evaluate every hazard of `crop` over the last `span` complete harvest years of the cell. */
export function hazards(crop: CropDef, cell: ClimateCell, lastYear: number, span = 20): HazardResult[] {
  const cal = cropCalendar(crop, cell)
  if (!cal) return []
  const byYear = new Map(cell.years.map((y) => [y.y, y]))
  return crop.hazards.map((h) => {
    const base = h.window.from === 'sow' ? cal.sow.start : cal.harvest.start
    const hitYears: number[] = []
    let years = 0
    for (let Y = lastYear - span + 1; Y <= lastYear; Y++) {
      const vals: number[] = []
      let missing = false
      for (let k = h.window.start; k <= h.window.end; k++) {
        const d = base + k // harvest-year coordinates; negative = previous year
        const yr = byYear.get(d < 0 ? Y - 1 : d >= 36 ? Y + 1 : Y)
        const v = yr ? value(yr, h.variable, ((d % 36) + 36) % 36) : null
        if (v === null) missing = true
        else vals.push(v)
      }
      if (missing || !vals.length) continue
      years++
      const agg = h.agg === 'sum' ? vals.reduce((a, b) => a + b, 0)
        : h.agg === 'min' ? Math.min(...vals) : h.agg === 'max' ? Math.max(...vals) : vals.reduce((a, b) => a + b, 0) / vals.length
      if (h.cmp === '<' ? agg < h.threshold.v : agg > h.threshold.v) hitYears.push(Y)
    }
    return { id: h.id, label: h.label, count: hitYears.length, years, hitYears }
  })
}
