// What to watch during a crop's season (PLAN §6.1 watchList): dated windows from the cell's calendar.
import { cropCalendar } from './calendar'
import type { ClimateCell, CropDef } from './types'

export interface WatchItem {
  crop: CropDef
  start: number // harvest-year dekads (negative = previous year)
  end: number
  what: string // i18n key
  /** Calendar dates for the season harvested in `year`. */
  from: Date
  to: Date
}

/** First day of a harvest-year dekad (dekad −1 = 21 December of the previous year). */
export function dekadStart(year: number, dekad: number): Date {
  const y = year + Math.floor(dekad / 36)
  const d = ((dekad % 36) + 36) % 36
  return new Date(y, Math.floor(d / 3), 1 + (d % 3) * 10)
}

/** Last day of a harvest-year dekad. */
export function dekadEnd(year: number, dekad: number): Date {
  const y = year + Math.floor(dekad / 36)
  const d = ((dekad % 36) + 36) % 36
  const m = Math.floor(d / 3)
  return d % 3 === 2 ? new Date(y, m + 1, 0) : new Date(y, m, (d % 3) * 10 + 10)
}

export function watchList(crop: CropDef, cell: ClimateCell, year: number): WatchItem[] {
  const cal = cropCalendar(crop, cell)
  if (!cal) return []
  return crop.watch
    .map((w) => {
      const base = w.window.from === 'sow' ? cal.sow.start : cal.harvest.start
      const start = base + w.window.start
      const end = base + w.window.end
      return { crop, start, end, what: w.what, from: dekadStart(year, start), to: dekadEnd(year, end) }
    })
    .sort((a, b) => a.start - b.start)
}
