// Data loading with an in-memory cache. Real data lives under DATA_BASE (GitHub Pages: the lan-data
// site; development: public/data → ../data/out). Fixture fields ("fixture-A") load from public/fixtures.
// Field and curve chunks are stored gzip-compressed ({ck}.json.gz, P4) to fit all of Ukraine into one Pages
// site; the browser unpacks them with DecompressionStream. Plain {ck}.json (older data) is the fallback.
import type { FeatureCollection } from 'geojson'
import { chunkOfId, decodeFieldId } from '../engine/fieldId'
import { modelGroupsOnly } from '../engine/precursors'
import type { ClimateCell, CropsFile, CurveChunk, FieldChunk, FieldRecord, Meta, RulesFile } from '../engine/types'

const BASE = import.meta.env.BASE_URL
export const DATA_BASE: string = import.meta.env.VITE_DATA_BASE ?? `${BASE}data`
/** USA data (Cloudflare R2, public): fields, curves, climate and tiles of the US build. Empty = no USA. */
export const US_DATA_BASE: string = import.meta.env.VITE_US_DATA_BASE ?? ''

export type Region = 'ua' | 'us'
/** A field's region from its id (the id encodes the centroid): west of 30° W is the USA. */
export function regionOfId(id: string): Region {
  const c = decodeFieldId(id)
  return c && c.lon < -30 ? 'us' : 'ua'
}
const baseOf = (r: Region) => (r === 'us' && US_DATA_BASE ? US_DATA_BASE : DATA_BASE)

/** Field tiles of the first deploy (Cherkasy only); used when meta.json lists no oblasts. */
export const LEGACY_TILES = 'tiles/fields-71.pmtiles'

const cache = new Map<string, Promise<unknown>>()

class NotFound extends Error {}

/** Parse a response body that may be gzip bytes (magic 1f 8b) or plain JSON text. */
export async function parseMaybeGzip(buf: ArrayBuffer): Promise<unknown> {
  const head = new Uint8Array(buf, 0, Math.min(2, buf.byteLength))
  if (head[0] === 0x1f && head[1] === 0x8b) {
    const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))
    return JSON.parse(await new Response(stream).text())
  }
  return JSON.parse(new TextDecoder().decode(buf))
}

function get<T>(url: string): Promise<T> {
  let p = cache.get(url)
  if (!p) {
    p = fetch(url).then(async (r) => {
      if (r.status === 404) throw new NotFound(url)
      if (!r.ok) throw new Error(`${r.status} ${url}`)
      return parseMaybeGzip(await r.arrayBuffer())
    })
    p.catch(() => cache.delete(url)) // allow a retry after a failure
    cache.set(url, p)
  }
  return p as Promise<T>
}

/** `{base}.json.gz`, or `{base}.json` when the compressed file does not exist. */
async function getChunk<T>(base: string): Promise<T> {
  try {
    return await get<T>(`${base}.json.gz`)
  } catch (e) {
    if (e instanceof NotFound) return get<T>(`${base}.json`)
    throw e
  }
}

/** Crop catalogue and rules: Ukrainian by default, the USA set (US extension sources) for US fields. */
export const loadCrops = (r: Region = 'ua') => get<CropsFile>(`${BASE}rules/${r === 'us' ? 'us/' : ''}crops.json`)
export const loadRules = (r: Region = 'ua') => get<RulesFile>(`${BASE}rules/${r === 'us' ? 'us/' : ''}rules.json`)
export const loadMeta = () => get<Meta>(`${DATA_BASE}/meta.json`)
export const loadUsMeta = () => (US_DATA_BASE ? get<Meta>(`${US_DATA_BASE}/meta.json`) : Promise.reject(new Error('no USA data')))

/** Oblast outlines with the map layers summarised (P4); null when the data has none yet. */
export const loadOblasts = async (): Promise<FeatureCollection | null> => {
  const [ua, us] = await Promise.all([
    get<FeatureCollection>(`${DATA_BASE}/oblasts.json`).catch(() => null),
    US_DATA_BASE ? get<FeatureCollection>(`${US_DATA_BASE}/oblasts.json`).catch(() => null) : Promise.resolve(null),
  ])
  if (!ua && !us) return null
  return { type: 'FeatureCollection', features: [...(ua?.features ?? []), ...(us?.features ?? []).map((f) => ({ ...f, properties: { ...f.properties, code: `us${f.properties?.code}` } }))] }
}

/** Field tile files to draw: one per oblast from meta.json, or the single file of the first deploy. */
export async function loadTileSets(): Promise<{ code: string; url: string; bbox?: [number, number, number, number] }[]> {
  const abs = (base: string, p: string) => new URL(`${base}/${p}`, window.location.href).href
  let ua: { code: string; url: string; bbox?: [number, number, number, number] }[] = [{ code: '71', url: abs(DATA_BASE, LEGACY_TILES) }]
  try {
    const m = await loadMeta()
    if (m.oblasts && Object.keys(m.oblasts).length) ua = Object.entries(m.oblasts).map(([code, o]) => ({ code, url: abs(DATA_BASE, o.tiles), bbox: o.bbox }))
  } catch {
    // no meta: the first deploy's single file
  }
  let us: typeof ua = []
  try {
    const m = await loadUsMeta()
    us = Object.entries(m.oblasts ?? {}).map(([code, o]) => ({ code: `us${code}`, url: abs(US_DATA_BASE, o.tiles), bbox: o.bbox }))
  } catch {
    // no USA data in this build
  }
  return [...ua, ...us]
}

export async function loadField(id: string): Promise<FieldRecord | null> {
  if (id.startsWith('fixture-')) {
    const c = await get<FieldChunk>(`${BASE}fixtures/fields_557_848.json`)
    return c.fields.find((f) => f.id === id) ?? null
  }
  const ck = chunkOfId(id)
  if (!ck) return null
  const region = regionOfId(id)
  const c = await getChunk<FieldChunk>(`${baseOf(region)}/fields/${ck}`)
  const f = c.fields.find((x) => x.id === id) ?? null
  // USA: the 2026 model season gives only its group (winter / summer), never a crop name
  return f && region === 'us' ? { ...f, hist: modelGroupsOnly(f.hist) } : f
}

export function loadClimate(cell: string, fixture = false, r: Region = 'ua'): Promise<ClimateCell> {
  return get<ClimateCell>(fixture ? `${BASE}fixtures/climate_${cell}.json` : `${baseOf(r)}/climate/${cell}.json`)
}

/** The eight POWER cells around `cell` (0.5° × 0.625° grid), nearest first: north, east, west, south, then corners. */
export function neighbourCells(cell: string): string[] {
  const [la, lo] = cell.split('_').map(Number)
  const steps = [[0.5, 0], [0, 0.625], [0, -0.625], [-0.5, 0], [0.5, 0.625], [0.5, -0.625], [-0.5, 0.625], [-0.5, -0.625]]
  return steps.map(([a, b]) => `${(la + a).toFixed(1)}_${(lo + b).toFixed(3)}`)
}

const missing = (e: unknown) => e instanceof NotFound || e instanceof SyntaxError // dev server answers a missing file with the app page

/**
 * The field's climate cell. A few coastal cells have no file (POWER put them over the sea); such a field
 * borrows the nearest neighbouring cell, whose id the Why? charts then show.
 */
export async function loadClimateNear(cell: string, fixture = false, r: Region = 'ua'): Promise<ClimateCell> {
  try {
    return await loadClimate(cell, fixture, r)
  } catch (e) {
    if (fixture || !missing(e)) throw e
    for (const n of neighbourCells(cell)) {
      try {
        return await loadClimate(n, false, r)
      } catch (e2) {
        if (!missing(e2)) throw e2
      }
    }
    throw e
  }
}

/** Greenness curves of one chunk (contract §7.6), loaded only when Evidence opens. */
export function loadCurves(id: string): Promise<CurveChunk | null> {
  if (id.startsWith('fixture-')) return Promise.resolve(null)
  const ck = chunkOfId(id)
  // small fields (< 2 ha) carry no curves: a missing chunk is "no curves", not an error
  return ck ? getChunk<CurveChunk>(`${baseOf(regionOfId(id))}/curves/${ck}`).catch((e) => (e instanceof NotFound ? null : Promise.reject(e))) : Promise.resolve(null)
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
