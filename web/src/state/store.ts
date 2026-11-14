import { create } from 'zustand'
import type { Lang } from '../i18n'

export type Sheet = 'peek' | 'half' | 'full'

interface State {
  lang: Lang
  selectedId: string | null
  sheet: Sheet
  /** "Today", or the ?date= override for demos and tests */
  today: Date
  dateOverridden: boolean
  setLang: (l: Lang) => void
  select: (id: string | null) => void
  setSheet: (s: Sheet) => void
}

function initial() {
  const q = new URLSearchParams(window.location.search)
  const lang = (q.get('lang') ?? localStorage.getItem('lan.lang') ?? 'en') === 'uk' ? 'uk' : 'en'
  const d = q.get('date')
  const parsed = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T12:00:00`) : null
  const m = window.location.hash.match(/^#\/f\/([0-9a-z]{10}|fixture-[A-C])/)
  return { lang: lang as Lang, today: parsed ?? new Date(), dateOverridden: !!parsed, selectedId: m ? m[1] : null }
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
  select: (selectedId) => {
    const hash = selectedId ? `#/f/${selectedId}` : '#/'
    if (window.location.hash !== hash) history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`)
    set({ selectedId, sheet: 'half' })
  },
  setSheet: (sheet) => set({ sheet }),
}))
