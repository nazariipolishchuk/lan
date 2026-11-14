// Data contract v1 (PLAN.md §7.6), frozen at task 0.6. The pipeline writes these shapes; the app reads them.

export type CropId =
  | 'w_wheat' | 'w_barley' | 's_barley' | 'maize' | 'sunflower' | 'soy'
  | 'sugar_beet' | 'w_rape' | 'peas' | 'chickpea' | 'sorghum' | 'fallow' | 'cover'

export type HistClass =
  | 'winter_cereal' | 'spring_cereal' | 'rapeseed' | 'maize' | 'sunflower'
  | 'soy' | 'sugar_beet' | 'other' | 'unknown'

/** Where a history item came from: our HLS model, the KPI winter/summer map, or the farmer. */
export type HistSource = 'model' | 'map' | 'farmer'

/**
 * One season of a field's history. `y` is the harvest year. `p` is the confidence 0..1.
 * Path B+ adds the group-level label `g` from the KPI winter/summer map when the class is unknown.
 */
export interface HistoryItem {
  y: number
  k: HistClass
  p: number
  src: HistSource
  g?: 'winter' | 'summer' | 'uncultivated'
}

export type FieldFlag = 'small' | 'low_conf' | 'no_history'

export interface FieldRecord {
  id: string // stable field id (FTW 2025 id)
  c: [number, number] // centroid [lon, lat]
  ha: number
  adm: { oblast: string; raion: string }
  cell: string // climate cell id
  soil: { clay: number; sand: number; soc: number; ph: number } | null
  terrain: { slope: number; slopeP90: number; elev: number } | null
  hist: HistoryItem[] // seasons 2016..2026; may be empty
  now: { state: 'winter_crop' | 'bare' | 'green_cover' | 'unknown'; asOf: string } | null
  bareDays: number | null // mean days per year with greenness < 0.25
  flags: FieldFlag[]
}

export interface FieldChunk {
  v: 1
  ck: string
  fields: FieldRecord[]
}

/** Greenness curves, loaded only when Evidence opens. Each curve: base64 of uint8, value = round(ndvi * 200), 255 = no data. */
export interface CurveChunk {
  v: 1
  ck: string
  years: number[]
  dekads: number[]
  curves: Record<string, string>
}

export interface YearIndicators {
  y: number
  gdd5: number
  gdd10: number
  lastSpringFrostDoy: number | null
  firstAutumnFrostDoy: number | null
  heavyRainDays: number
  // 36 dekads each
  rain: number[]
  et0: number[]
  hot30: number[]
  hot35: number[]
  tmin: number[]
  wet: number[]
}

export interface ClimateCell {
  v: 1
  id: string
  lat: number
  lon: number
  years: YearIndicators[]
  smap?: { y: number; anom: number[] }[] // 12 months
}

export interface SourceRef {
  id: string
  name: string
  version: string
  licence: string
}

export interface Meta {
  v: 1
  built: string
  coverage: { historyTiles: string[]; climateOnly: boolean }
  accuracy: { macroF1: number; perClass: Record<string, number>; n: number; labelSource: string } | null
  sources: SourceRef[]
}

/** Vector tile feature properties. `k` last crop code, `rh` rotation health 0..100 (−1 unknown), `f` flag bits. */
export interface TileProps {
  id: string
  ck: string
  ha: number
  k: number
  rh: number
  f: number
}

// ---------- rules (crops.json, rules.json) ----------

/** A number with its provenance. `source` resolves to docs/REFERENCES.md; null = unsourced (shown as unverified). */
export interface Sourced<T> {
  v: T
  source: string | null
}

export type CropType = 'winter' | 'spring' | 'cover' | 'fallow'
export type Family = 'poaceae' | 'asteraceae' | 'fabaceae' | 'brassicaceae' | 'amaranthaceae' | 'none'
export type Level = 'low' | 'medium' | 'high'

export interface HazardDef {
  id: string
  /** Window relative to the crop calendar: dekad offsets from the sowing start ('sow') or from the harvest start ('harvest'). */
  window: { from: 'sow' | 'harvest'; start: number; end: number }
  variable: 'rain' | 'et0' | 'hot30' | 'hot35' | 'tmin' | 'wet' | 'balance'
  agg: 'sum' | 'min' | 'max' | 'mean'
  cmp: '<' | '>'
  threshold: Sourced<number>
  label: string // i18n key
}

export interface WatchDef {
  window: { from: 'sow' | 'harvest'; start: number; end: number }
  what: string // i18n key
}

export interface CropDef {
  id: CropId
  name: { en: string; uk: string }
  icon: string
  colour: string
  family: Family
  type: CropType
  /** Sowing window: opens when smoothed daily mean temperature crosses `tempC` (rising for spring crops, falling for winter crops). */
  sowing: { tempC: Sourced<number>; lengthDekads: Sourced<number> } | null
  /** Typical season length in dekads from sowing to the start of harvest. */
  seasonDekads: Sourced<number> | null
  harvestLengthDekads: Sourced<number> | null
  gdd: { base: number; sum: Sourced<number> } | null
  water: Level
  rooting: Level
  fixesNitrogen: boolean
  residue: Level
  /** Minimum number of full seasons between two crops of this kind on the same field. 0 = may repeat. */
  returnGap: Sourced<number>
  /** Maximum seasons in a row (for crops that may repeat, e.g. maize). */
  maxInRow: Sourced<number> | null
  hazards: HazardDef[]
  watch: WatchDef[]
}

export type ComboId =
  | 'N_BONUS' | 'BREAK_CROP' | 'CLASSIC_BEET' | 'FALLOW_MOISTURE' | 'COVER_SHIELD' | 'DIVERSITY_3'
  | 'CEREAL_REPEAT' | 'FUSARIUM' | 'EARLY_RETURN' | 'WHITE_MOLD' | 'DRY_PROFILE' | 'LATE_HARVEST'

export interface ComboDef {
  id: ComboId
  sign: 1 | -1
  points: Sourced<number>
  label: string // i18n key
  /** For pair combos: predecessor and follower crop sets. Others are computed in code (diversity, return, calendar). */
  from?: CropId[]
  to?: CropId[]
  source: string | null
}

export interface RulesFile {
  v: 1
  /** Predecessor effect of A on the following B, −2..+2, with a reason code. Missing pairs are 0. */
  predecessor: { from: CropId; to: CropId; effect: number; reason: string; source: string | null }[]
  sharedHost: { crops: CropId[]; disease: string; source: string | null }[]
  familyShareMax: { family: Family; window: number; maxShare: Sourced<number> }[]
  regionShareMax: { crop: CropId; region: string; maxShare: Sourced<number> }[]
  combos: ComboDef[]
}

export interface CropsFile {
  v: 1
  crops: CropDef[]
}
