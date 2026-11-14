import { create } from 'zustand'
import type { Lang } from '../i18n'
import type { Theme } from '../map/style'

export type Sheet = 'peek' | 'half' | 'full'

interface State {
  lang: Lang
  theme: Theme
  selectedId: string | null
  sheet: Sheet
  /** "Today", or the ?date= override for demos and tests */
  today: Date
  dateOverridden: boolean
  setLang: (l: Lang) => void
  setTheme: (t: Theme) => void
  select: (id: string | null) => void
  setSheet: (s: Sheet) => void
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
  const d = q.get('date')
  const parsed = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T12:00:00`) : null
  let stored: string | null = null
  try {
    stored = localStorage.getItem('lan.theme')
  } catch {
    /* storage disabled */
  }
  const theme: Theme = stored === 'light' || stored === 'dark' ? stored
    : window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  document.documentElement.dataset.theme = theme
  const m = window.location.hash.match(/^#\/f\/([0-9a-z]{10}|fixture-[A-C])/)
  return { lang: lang as Lang, theme, today: parsed ?? new Date(), dateOverridden: !!parsed, selectedId: m ? m[1] : null }
}

export const useStore = create<State>((set) => ({
  ...initial(),
  sheet: 'half',
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
    const hash = selectedId ? `#/f/${selectedId}` : '#/'
    if (window.location.hash !== hash) history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`)
    set({ selectedId, sheet: 'half' })
  },
  setSheet: (sheet) => set({ sheet }),
}))
