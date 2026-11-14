import { create } from 'zustand'
import type { Scenario } from '../engine/score'
import type { CropId } from '../engine/types'
import type { Lang } from '../i18n'
import type { MapLayer } from '../map/layers'
import type { Theme } from '../map/style'
import { UserStore, browserStorage, type UserData } from './persist'

export type Sheet = 'peek' | 'half' | 'full'

/** What the side panel shows for the selected field. */
export type Panel =
  | { kind: 'card' }
  | { kind: 'history' }
  | { kind: 'priorities' }
  | { kind: 'evidence'; tab?: EvidenceTab }
  | { kind: 'crop'; crop: CropId; year: number }

export type EvidenceTab = 'green' | 'bare' | 'rain' | 'heat' | 'moisture' | 'change' | 'terrain' | 'soil'

interface State {
  lang: Lang
  theme: Theme
  selectedId: string | null
  /** Route #/f/{id}/compare */
  compare: boolean
  panel: Panel
  sheet: Sheet
  /** "Today", or the ?date= override for demos and tests */
  today: Date
  dateOverridden: boolean
  scenario: Scenario
  user: UserData
  /** Active map layer (PLAN 4.2) */
  mapLayer: MapLayer
  /** A place the map should fly to (search result or "locate me"); the map clears it after flying. */
  flyTo: { lon: number; lat: number; zoom: number } | null
  /** False when browser storage is unavailable: inputs last for this visit only (state E6). */
  storageOk: boolean
  setLang: (l: Lang) => void
  setTheme: (t: Theme) => void
  select: (id: string | null) => void
  setCompare: (on: boolean) => void
  openPanel: (p: Panel) => void
  setSheet: (s: Sheet) => void
  setScenario: (s: Scenario) => void
  /** null = back to the real today */
  setToday: (iso: string | null) => void
  updateUser: (fn: (d: UserData) => UserData) => void
  setMapLayer: (l: MapLayer) => void
  setFlyTo: (t: State['flyTo']) => void
}

const HASH = /^#\/f\/([0-9a-z]{10}|fixture-[A-C])(\/compare)?/
const userStore = new UserStore(browserStorage())

export function parseHash(hash: string): { id: string | null; compare: boolean } {
  const m = hash.match(HASH)
  return { id: m ? m[1] : null, compare: !!m?.[2] }
}

function writeUrl(id: string | null, compare: boolean, date?: string | null) {
  const q = new URLSearchParams(window.location.search)
  if (date === null) q.delete('date')
  else if (date) q.set('date', date)
  const qs = q.toString()
  const hash = id ? `#/f/${id}${compare ? '/compare' : ''}` : '#/'
  const url = `${window.location.pathname}${qs ? `?${qs}` : ''}${hash}`
  if (url !== `${window.location.pathname}${window.location.search}${window.location.hash}`) history.replaceState(null, '', url)
}

function parseDate(d: string | null): Date | null {
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(new Date(`${d}T12:00:00`).getTime()) ? new Date(`${d}T12:00:00`) : null
}

function initial() {
  const q = new URLSearchParams(window.location.search)
  let storedLang: string | null = null
  try {
    storedLang = localStorage.getItem('lan.lang')
  } catch {
    /* storage disabled */
  }
  const lang = (q.get('lang') ?? storedLang ?? 'en') === 'uk' ? 'uk' : 'en'
  const parsed = parseDate(q.get('date'))
  let stored: string | null = null
  try {
    stored = localStorage.getItem('lan.theme')
  } catch {
    /* storage disabled */
  }
  const theme: Theme = stored === 'light' || stored === 'dark' ? stored
    : window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  document.documentElement.dataset.theme = theme
  const { id, compare } = parseHash(window.location.hash)
  return { lang: lang as Lang, theme, today: parsed ?? new Date(), dateOverridden: !!parsed, selectedId: id, compare: compare && !!id }
}

export const useStore = create<State>((set, get) => ({
  ...initial(),
  panel: { kind: 'card' },
  sheet: 'half',
  scenario: 'all',
  mapLayer: 'none',
  flyTo: null,
  user: userStore.data,
  storageOk: userStore.ok,
  setLang: (lang) => {
    try {
      localStorage.setItem('lan.lang', lang)
    } catch {
      /* storage disabled: the choice lasts for this visit */
    }
    document.documentElement.lang = lang
    set({ lang })
  },
  setTheme: (theme) => {
    try {
      localStorage.setItem('lan.theme', theme)
    } catch {
      /* storage disabled: the choice lasts for this visit */
    }
    document.documentElement.dataset.theme = theme
    set({ theme })
  },
  select: (selectedId) => {
    const same = selectedId === get().selectedId
    writeUrl(selectedId, false)
    set({ selectedId, compare: false, sheet: 'half', ...(same ? {} : { panel: { kind: 'card' } as Panel }) })
  },
  setCompare: (on) => {
    const id = get().selectedId
    writeUrl(id, on && !!id)
    set({ compare: on && !!id })
  },
  openPanel: (panel) => set((s) => ({ panel, sheet: s.sheet === 'peek' ? 'half' : s.sheet })),
  setSheet: (sheet) => set({ sheet }),
  setScenario: (scenario) => set({ scenario }),
  setToday: (iso) => {
    const d = parseDate(iso)
    writeUrl(get().selectedId, get().compare, d ? iso : null)
    set({ today: d ?? new Date(), dateOverridden: !!d })
  },
  setMapLayer: (mapLayer) => set({ mapLayer }),
  setFlyTo: (flyTo) => set({ flyTo }),
  updateUser: (fn) => {
    const next = userStore.save(fn(get().user))
    set({ user: next, storageOk: userStore.ok })
  },
}))
