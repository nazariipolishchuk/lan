// The farmer's own inputs, kept only in this browser (PLAN §5.4, §5.5, review focus 5).
// Storage may be missing or throw (private mode, disabled cookies): then everything still works
// for this visit and `ok` is false, so the app can show a one-line notice (state E6).
import { normalisePriorities, type Priorities } from '../engine/prefs'
import type { Overrides } from '../engine/precursors'
import type { CropId } from '../engine/types'

export interface MySlot { crop: CropId | null; cover?: boolean }

export interface UserData {
  overrides: Record<string, Overrides> // per field id
  unsafe: Record<string, true>
  plans: Record<string, Record<number, MySlot>> // per field id, by harvest year
  prefs: Priorities
}

const KEY = 'lan.user.v1'

export interface KV {
  getItem(k: string): string | null
  setItem(k: string, v: string): void
}

export function emptyUserData(): UserData {
  return { overrides: {}, unsafe: {}, plans: {}, prefs: normalisePriorities(null) }
}

export class UserStore {
  ok = true
  data: UserData
  private kv: KV | null

  constructor(kv: KV | null) {
    this.kv = kv
    this.data = emptyUserData()
    try {
      if (!kv) throw new Error('no storage')
      const raw = kv.getItem(KEY)
      if (raw) {
        const v = JSON.parse(raw) as Partial<UserData>
        this.data = {
          overrides: v.overrides ?? {}, unsafe: v.unsafe ?? {}, plans: v.plans ?? {}, prefs: normalisePriorities(v.prefs),
        }
      }
    } catch {
      this.ok = false
    }
  }

  /** Replace the data and try to save it; a failed save keeps the data in memory. */
  save(next: UserData): UserData {
    this.data = next
    try {
      if (!this.kv) throw new Error('no storage')
      this.kv.setItem(KEY, JSON.stringify(next))
    } catch {
      this.ok = false
    }
    return next
  }
}

export function browserStorage(): KV | null {
  try {
    const s = window.localStorage
    const probe = '__lan_probe__'
    s.setItem(probe, '1')
    s.removeItem(probe)
    return s
  } catch {
    return null
  }
}

// ---------- pure updates ----------

export function setOverride(d: UserData, field: string, year: number, v: CropId | 'unknown' | null): UserData {
  const cur = { ...(d.overrides[field] ?? {}) }
  if (v === null) delete cur[year]
  else cur[year] = v
  const overrides = { ...d.overrides }
  if (Object.keys(cur).length) overrides[field] = cur
  else delete overrides[field]
  return { ...d, overrides }
}

export function resetOverrides(d: UserData, field: string): UserData {
  const overrides = { ...d.overrides }
  delete overrides[field]
  return { ...d, overrides }
}

export function setUnsafe(d: UserData, field: string, on: boolean): UserData {
  const unsafe = { ...d.unsafe }
  if (on) unsafe[field] = true
  else delete unsafe[field]
  return { ...d, unsafe }
}

export function setPlanSlot(d: UserData, field: string, year: number, slot: MySlot | null): UserData {
  const cur = { ...(d.plans[field] ?? {}) }
  if (slot) cur[year] = slot
  else delete cur[year]
  return { ...d, plans: { ...d.plans, [field]: cur } }
}

export function setPrefs(d: UserData, prefs: Priorities): UserData {
  return { ...d, prefs }
}
