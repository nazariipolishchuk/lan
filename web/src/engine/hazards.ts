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

/**
 * Evaluate every hazard of `crop` over harvest years: the last `span` years up to `lastYear`,
 * or an explicit list of years (a climate scenario, see score.ts).
 */
export function hazards(crop: CropDef, cell: ClimateCell, lastYear: number, span: number | number[] = 20): HazardResult[] {
  const cal = cropCalendar(crop, cell)
  if (!cal) return []
  const byYear = new Map(cell.years.map((y) => [y.y, y]))
  const list = Array.isArray(span) ? span : Array.from({ length: span }, (_, i) => lastYear - span + 1 + i)
  return crop.hazards.map((h) => {
    const base = h.window.from === 'sow' ? cal.sow.start : cal.harvest.start
    const hitYears: number[] = []
    let years = 0
    for (const Y of list) {
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

/** Per-year values of one hazard's aggregate (for the Evidence charts); null where the window has missing data. */
export function hazardSeries(crop: CropDef, cell: ClimateCell, hazardId: string, years: number[]): { y: number; v: number | null }[] {
  const cal = cropCalendar(crop, cell)
  const h = crop.hazards.find((x) => x.id === hazardId)
  if (!cal || !h) return []
  const byYear = new Map(cell.years.map((y) => [y.y, y]))
  const base = h.window.from === 'sow' ? cal.sow.start : cal.harvest.start
  return years.map((Y) => {
    const vals: number[] = []
    for (let k = h.window.start; k <= h.window.end; k++) {
      const d = base + k
      const yr = byYear.get(d < 0 ? Y - 1 : d >= 36 ? Y + 1 : Y)
      const v = yr ? value(yr, h.variable, ((d % 36) + 36) % 36) : null
      if (v === null) return { y: Y, v: null }
      vals.push(v)
    }
    if (!vals.length) return { y: Y, v: null }
    const v = h.agg === 'sum' ? vals.reduce((a, b) => a + b, 0)
      : h.agg === 'min' ? Math.min(...vals) : h.agg === 'max' ? Math.max(...vals) : vals.reduce((a, b) => a + b, 0) / vals.length
    return { y: Y, v }
  })
}
