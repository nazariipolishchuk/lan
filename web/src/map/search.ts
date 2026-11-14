// Client-side settlement search (PLAN 4.3, §5.3): GeoNames places in English and Ukrainian spelling.
// Nothing is sent anywhere; the index is one static file (~0.6 MB gzip) loaded on the first keystroke.

/** [English name, Ukrainian name, lon, lat, oblast code, population] */
export type Place = [string, string, number, number, string, number]

export interface PlaceIndex {
  places: Place[]
  keys: { en: string; uk: string }[]
}

/** Lower case, no apostrophes or accents, ё→е, Latin/Cyrillic look-alike variants folded. */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’ʼ`"«»]/g, '')
    .replace(/ё/g, 'е')
    .replace(/[-\s]+/g, ' ')
    .trim()
}

export function buildIndex(places: Place[]): PlaceIndex {
  return { places, keys: places.map((p) => ({ en: norm(p[0]), uk: norm(p[1]) })) }
}

/**
 * Best matches for a query in either language: a name that starts with the query first, then a word of
 * the name that starts with it, then any substring; bigger places first inside each rank (the index is
 * sorted by population). Empty or one-letter queries return nothing.
 */
export function searchPlaces(ix: PlaceIndex, query: string, limit = 8): Place[] {
  const q = norm(query)
  if (q.length < 2) return []
  const ranks: Place[][] = [[], [], []]
  for (let i = 0; i < ix.places.length; i++) {
    const { en, uk } = ix.keys[i]
    let r = -1
    if (en.startsWith(q) || uk.startsWith(q)) r = 0
    else if (en.includes(` ${q}`) || uk.includes(` ${q}`)) r = 1
    else if (en.includes(q) || uk.includes(q)) r = 2
    if (r >= 0 && ranks[r].length < limit) ranks[r].push(ix.places[i])
    if (ranks[0].length >= limit) break
  }
  return ranks.flat().slice(0, limit)
}
