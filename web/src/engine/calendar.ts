// Crop calendars derived from the field's climate cell, and date awareness (PLAN §6.5, §6.8).
// Dekads are counted in "harvest-year coordinates": 0..35 are the dekads of the harvest year,
// negative values are dekads of the previous year (−11 = dekad 25 of the previous year).
import type { ClimateCell, CropDef, FieldRecord } from './types'

export interface Window {
  start: number
  end: number
}

export interface CropCalendar {
  crop: CropDef['id']
  sow: Window
  harvest: Window
}

/** Mean temperature per dekad over the last `years` complete years of the cell. */
export function tmeanClimatology(cell: ClimateCell, years = 10): number[] {
  const full = cell.years.filter((y) => y.tmean.every((v) => v !== null)).slice(-years)
  return Array.from({ length: 36 }, (_, d) => {
    const vals = full.map((y) => y.tmean[d] as number)
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : NaN
  })
}

const AUGUST = 21 // first dekad of August: winter crops are sown after it
const MARCH = 6 // first dekad of March: spring crops are sown from it

export function cropCalendar(crop: CropDef, cell: ClimateCell, years = 10): CropCalendar | null {
  if (!crop.sowing || !crop.seasonDekads) return null
  const t = tmeanClimatology(cell, years)
  const thr = crop.sowing.tempC.v
  const len = crop.sowing.lengthDekads.v
  let start: number
  if (crop.type === 'winter') {
    const d = t.findIndex((v, i) => i >= AUGUST && v <= thr)
    if (d < 0) return null
    start = d - 36
  } else {
    const d = t.findIndex((v, i) => i >= MARCH && v >= thr)
    if (d < 0) return null
    start = d
  }
  const sow = { start, end: start + len - 1 }
  const hStart = start + crop.seasonDekads.v
  const hLen = crop.harvestLengthDekads?.v ?? 2
  return { crop: crop.id, sow, harvest: { start: hStart, end: hStart + hLen - 1 } }
}

export function dekadOf(d: Date): { year: number; dekad: number } {
  return { year: d.getFullYear(), dekad: d.getMonth() * 3 + Math.min(2, Math.floor((d.getDate() - 1) / 10)) }
}

const abs = (year: number, dekad: number) => year * 36 + dekad

/** Can this crop still be sown for the season harvested in `harvestYear`? */
export function sowingOpen(cal: CropCalendar, harvestYear: number, today: Date): boolean {
  const t = dekadOf(today)
  return abs(t.year, t.dekad) <= abs(harvestYear, cal.sow.end)
}

export interface Slot {
  y: number
  locked?: 'winter_crop'
}

/**
 * Seasons to plan. From August on, this year's harvest is history and planning starts next year.
 * An emerged winter crop locks the first season; the horizon is three seasons after it.
 */
export function planSlots(field: FieldRecord, today: Date, horizon = 3): Slot[] {
  const { year, dekad } = dekadOf(today)
  const first = dekad >= AUGUST ? year + 1 : year
  const slots: Slot[] = []
  if (field.now?.state === 'winter_crop') {
    slots.push({ y: first, locked: 'winter_crop' })
    for (let i = 1; i <= horizon; i++) slots.push({ y: first + i })
  } else {
    for (let i = 0; i < horizon; i++) slots.push({ y: first + i })
  }
  return slots
}
