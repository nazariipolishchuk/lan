// Runtime checks of the data contract (§7.6). Used by tests on fixtures and on real pipeline output.
import type { ClimateCell, CropsFile, FieldChunk, Meta, RulesFile } from './types'

const HIST = new Set(['winter_cereal', 'spring_cereal', 'rapeseed', 'maize', 'sunflower', 'soy', 'sugar_beet', 'other', 'unknown'])
const CROPS = new Set(['w_wheat', 'w_barley', 's_barley', 'maize', 'sunflower', 'soy', 'sugar_beet', 'w_rape', 'peas', 'chickpea', 'sorghum', 'fallow', 'cover'])
const COMBOS = new Set(['N_BONUS', 'BREAK_CROP', 'CLASSIC_BEET', 'FALLOW_MOISTURE', 'COVER_SHIELD', 'DIVERSITY_3', 'CEREAL_REPEAT', 'FUSARIUM', 'EARLY_RETURN', 'WHITE_MOLD', 'DRY_PROFILE', 'LATE_HARVEST'])

type Obj = Record<string, unknown>
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x)
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
const isNumArr = (x: unknown, len?: number) => Array.isArray(x) && x.every(isNum) && (len === undefined || x.length === len)

export function fieldChunkErrors(x: unknown): string[] {
  const e: string[] = []
  if (!isObj(x) || x.v !== 1 || typeof x.ck !== 'string' || !Array.isArray(x.fields)) return ['chunk header']
  const ids = new Set<string>()
  x.fields.forEach((f: unknown, i) => {
    const at = `fields[${i}]`
    if (!isObj(f)) return e.push(`${at} not an object`)
    if (typeof f.id !== 'string' || !f.id) e.push(`${at}.id`)
    else if (ids.has(f.id)) e.push(`${at}.id duplicate`)
    else ids.add(f.id)
    if (!isNumArr(f.c, 2)) e.push(`${at}.c`)
    if (!isNum(f.ha) || f.ha <= 0) e.push(`${at}.ha`)
    if (!isObj(f.adm) || typeof f.adm.oblast !== 'string' || typeof f.adm.raion !== 'string') e.push(`${at}.adm`)
    if (typeof f.cell !== 'string') e.push(`${at}.cell`)
    if (f.soil !== null && !(isObj(f.soil) && ['clay', 'sand', 'soc', 'ph'].every((k) => isNum((f.soil as Obj)[k])))) e.push(`${at}.soil`)
    if (f.terrain !== null && !(isObj(f.terrain) && ['slope', 'slopeP90', 'elev'].every((k) => isNum((f.terrain as Obj)[k])))) e.push(`${at}.terrain`)
    if (!Array.isArray(f.hist)) e.push(`${at}.hist`)
    else f.hist.forEach((h: unknown, j) => {
      if (!isObj(h) || !isNum(h.y) || !HIST.has(h.k as string) || !isNum(h.p) || h.p < 0 || h.p > 1
        || !['model', 'map', 'farmer'].includes(h.src as string)
        || (h.g !== undefined && !['winter', 'summer', 'uncultivated'].includes(h.g as string))) e.push(`${at}.hist[${j}]`)
    })
    if (f.now !== null && !(isObj(f.now) && ['winter_crop', 'bare', 'green_cover', 'unknown'].includes(f.now.state as string) && typeof f.now.asOf === 'string')) e.push(`${at}.now`)
    if (f.bareDays !== null && !isNum(f.bareDays)) e.push(`${at}.bareDays`)
    if (!Array.isArray(f.flags) || !f.flags.every((g) => ['small', 'low_conf', 'no_history'].includes(g))) e.push(`${at}.flags`)
  })
  return e
}

export function climateCellErrors(x: unknown): string[] {
  const e: string[] = []
  if (!isObj(x) || x.v !== 1 || typeof x.id !== 'string' || !isNum(x.lat) || !isNum(x.lon) || !Array.isArray(x.years)) return ['cell header']
  x.years.forEach((y: unknown, i) => {
    const at = `years[${i}]`
    if (!isObj(y) || !isNum(y.y)) return e.push(at)
    for (const k of ['gdd5', 'gdd10', 'heavyRainDays']) if (!isNum(y[k])) e.push(`${at}.${k}`)
    for (const k of ['lastSpringFrostDoy', 'firstAutumnFrostDoy']) if (y[k] !== null && !isNum(y[k])) e.push(`${at}.${k}`)
    for (const k of ['rain', 'et0', 'hot30', 'hot35', 'tmin', 'wet']) if (!isNumArr(y[k], 36)) e.push(`${at}.${k}`)
  })
  return e
}

export function metaErrors(x: unknown): string[] {
  if (!isObj(x) || x.v !== 1 || typeof x.built !== 'string' || !isObj(x.coverage) || !Array.isArray(x.sources)) return ['meta header']
  return []
}

const sourced = (x: unknown) => isObj(x) && isNum(x.v) && (x.source === null || typeof x.source === 'string')

export function cropsErrors(x: unknown): string[] {
  const e: string[] = []
  if (!isObj(x) || x.v !== 1 || !Array.isArray(x.crops)) return ['crops header']
  const seen = new Set<string>()
  x.crops.forEach((c: unknown, i) => {
    const at = `crops[${i}]`
    if (!isObj(c) || !CROPS.has(c.id as string)) return e.push(`${at}.id`)
    seen.add(c.id as string)
    if (!sourced(c.returnGap)) e.push(`${at}.returnGap`)
    if (c.sowing !== null && !(isObj(c.sowing) && sourced(c.sowing.tempC) && sourced(c.sowing.lengthDekads))) e.push(`${at}.sowing`)
    if (!Array.isArray(c.hazards) || !c.hazards.every((h) => isObj(h) && sourced(h.threshold))) e.push(`${at}.hazards`)
  })
  for (const id of CROPS) if (!seen.has(id)) e.push(`missing crop ${id}`)
  return e
}

export function rulesErrors(x: unknown): string[] {
  const e: string[] = []
  if (!isObj(x) || x.v !== 1 || !Array.isArray(x.combos) || !Array.isArray(x.predecessor)) return ['rules header']
  const seen = new Set<string>()
  x.combos.forEach((c: unknown, i) => {
    if (!isObj(c) || !COMBOS.has(c.id as string) || !sourced(c.points)) return e.push(`combos[${i}]`)
    seen.add(c.id as string)
  })
  for (const id of COMBOS) if (!seen.has(id)) e.push(`missing combo ${id}`)
  x.predecessor.forEach((p: unknown, i) => {
    if (!isObj(p) || !CROPS.has(p.from as string) || !CROPS.has(p.to as string) || !isNum(p.effect) || Math.abs(p.effect) > 2) e.push(`predecessor[${i}]`)
  })
  return e
}

// Type guards for callers that already validated.
export const asFieldChunk = (x: unknown) => x as FieldChunk
export const asClimateCell = (x: unknown) => x as ClimateCell
export const asMeta = (x: unknown) => x as Meta
export const asCrops = (x: unknown) => x as CropsFile
export const asRules = (x: unknown) => x as RulesFile
