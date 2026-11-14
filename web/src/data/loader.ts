// Data loading with an in-memory cache. Real data lives under DATA_BASE (GitHub Pages: the lan-data
// site; development: public/data → ../data/out). Fixture fields ("fixture-A") load from public/fixtures.
// Field and curve chunks are stored gzip-compressed ({ck}.json.gz, P4) to fit all of Ukraine into one Pages
// site; the browser unpacks them with DecompressionStream. Plain {ck}.json (older data) is the fallback.
import type { FeatureCollection } from 'geojson'
import { chunkOfId } from '../engine/fieldId'
import type { ClimateCell, CropsFile, CurveChunk, FieldChunk, FieldRecord, Meta, RulesFile } from '../engine/types'

const BASE = import.meta.env.BASE_URL
export const DATA_BASE: string = import.meta.env.VITE_DATA_BASE ?? `${BASE}data`
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

export const loadCrops = () => get<CropsFile>(`${BASE}rules/crops.json`)
export const loadRules = () => get<RulesFile>(`${BASE}rules/rules.json`)
export const loadMeta = () => get<Meta>(`${DATA_BASE}/meta.json`)

/** Oblast outlines with the map layers summarised (P4); null when the data has none yet. */
export const loadOblasts = () =>
  get<FeatureCollection>(`${DATA_BASE}/oblasts.json`).catch(() => null)

/** Field tile files to draw: one per oblast from meta.json, or the single file of the first deploy. */
export async function loadTileSets(): Promise<{ code: string; url: string; bbox?: [number, number, number, number] }[]> {
  const abs = (p: string) => new URL(`${DATA_BASE}/${p}`, window.location.href).href
  try {
    const m = await loadMeta()
    if (m.oblasts && Object.keys(m.oblasts).length) {
      return Object.entries(m.oblasts).map(([code, o]) => ({ code, url: abs(o.tiles), bbox: o.bbox }))
    }
  } catch {
    // no meta: fall through to the first deploy's single file
  }
  return [{ code: '71', url: abs(LEGACY_TILES) }]
}

export async function loadField(id: string): Promise<FieldRecord | null> {
  if (id.startsWith('fixture-')) {
    const c = await get<FieldChunk>(`${BASE}fixtures/fields_557_848.json`)
    return c.fields.find((f) => f.id === id) ?? null
  }
  const ck = chunkOfId(id)
  if (!ck) return null
  const c = await getChunk<FieldChunk>(`${DATA_BASE}/fields/${ck}`)
  return c.fields.find((f) => f.id === id) ?? null
}

export function loadClimate(cell: string, fixture = false): Promise<ClimateCell> {
  return get<ClimateCell>(fixture ? `${BASE}fixtures/climate_${cell}.json` : `${DATA_BASE}/climate/${cell}.json`)
}

/** Greenness curves of one chunk (contract §7.6), loaded only when Evidence opens. */
export function loadCurves(id: string): Promise<CurveChunk | null> {
  if (id.startsWith('fixture-')) return Promise.resolve(null)
  const ck = chunkOfId(id)
  // small fields (< 2 ha) carry no curves: a missing chunk is "no curves", not an error
  return ck ? getChunk<CurveChunk>(`${DATA_BASE}/curves/${ck}`).catch((e) => (e instanceof NotFound ? null : Promise.reject(e))) : Promise.resolve(null)
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
