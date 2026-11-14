// Data loading with an in-memory cache. Real data lives under DATA_BASE (GitHub Pages: the lan-data
// site; development: public/data → ../data/out). Fixture fields ("fixture-A") load from public/fixtures.
import { chunkOfId } from '../engine/fieldId'
import type { ClimateCell, CropsFile, CurveChunk, FieldChunk, FieldRecord, RulesFile } from '../engine/types'

const BASE = import.meta.env.BASE_URL
export const DATA_BASE: string = import.meta.env.VITE_DATA_BASE ?? `${BASE}data`
export const FIELD_TILES = `${DATA_BASE}/tiles/fields-71.pmtiles`

const cache = new Map<string, Promise<unknown>>()

function getJson<T>(url: string): Promise<T> {
  let p = cache.get(url)
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${r.status} ${url}`)
      return r.json()
    })
    p.catch(() => cache.delete(url)) // allow a retry after a failure
    cache.set(url, p)
  }
  return p as Promise<T>
}

export const loadCrops = () => getJson<CropsFile>(`${BASE}rules/crops.json`)
export const loadRules = () => getJson<RulesFile>(`${BASE}rules/rules.json`)

export async function loadField(id: string): Promise<FieldRecord | null> {
  if (id.startsWith('fixture-')) {
    const c = await getJson<FieldChunk>(`${BASE}fixtures/fields_557_848.json`)
    return c.fields.find((f) => f.id === id) ?? null
  }
  const ck = chunkOfId(id)
  if (!ck) return null
  const c = await getJson<FieldChunk>(`${DATA_BASE}/fields/${ck}.json`)
  return c.fields.find((f) => f.id === id) ?? null
}

export function loadClimate(cell: string, fixture = false): Promise<ClimateCell> {
  return getJson<ClimateCell>(fixture ? `${BASE}fixtures/climate_${cell}.json` : `${DATA_BASE}/climate/${cell}.json`)
}

/** Greenness curves of one chunk (contract §7.6), loaded only when Evidence opens. */
export function loadCurves(id: string): Promise<CurveChunk | null> {
  if (id.startsWith('fixture-')) return Promise.resolve(null)
  const ck = chunkOfId(id)
  return ck ? getJson<CurveChunk>(`${DATA_BASE}/curves/${ck}.json`) : Promise.resolve(null)
}

/** One field's curves: per year, 36-slot arrays of NDVI (null = no data) placed at their dekads. */
export function decodeCurves(chunk: CurveChunk, id: string): { y: number; v: (number | null)[] }[] | null {
  const s = chunk.curves[id]
  if (!s) return null
  const bin = atob(s)
  const n = chunk.dekads.length
  return chunk.years.map((y, i) => {
    const v: (number | null)[] = Array(36).fill(null)
    chunk.dekads.forEach((d, j) => {
      const b = bin.charCodeAt(i * n + j)
      v[d] = b === 255 ? null : b / 200
    })
    return { y, v }
  })
}
