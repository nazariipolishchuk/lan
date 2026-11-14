// Field ids are 10 base36 characters: 5 for round((lat + 90)·1e5), 5 for round((lon + 180)·1e5)
// (pipeline/src/lan/fields.py). Decoding gives the centroid, hence the chunk key, without any index.

export function decodeFieldId(id: string): { lat: number; lon: number } | null {
  if (!/^[0-9a-z]{10}$/.test(id)) return null
  const lat = parseInt(id.slice(0, 5), 36) / 1e5 - 90
  const lon = parseInt(id.slice(5), 36) / 1e5 - 180
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  return { lat, lon }
}

export const chunkKey = (lat: number, lon: number) =>
  `${Math.floor((lat + 90) / 0.25)}_${Math.floor((lon + 180) / 0.25)}`

export function chunkOfId(id: string): string | null {
  const p = decodeFieldId(id)
  return p ? chunkKey(p.lat, p.lon) : null
}
