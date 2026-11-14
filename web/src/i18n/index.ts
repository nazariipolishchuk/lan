import { useStore } from '../state/store'
import { en, type Key } from './en'
import { uk } from './uk'

export type Lang = 'en' | 'uk'
const dicts: Record<Lang, Record<Key, string>> = { en, uk }

export function translate(lang: Lang, key: Key, vars: Record<string, string | number> = {}): string {
  const s = dicts[lang][key] ?? en[key] ?? key
  return s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`))
}

export function useT() {
  const lang = useStore((s) => s.lang)
  return (key: Key, vars?: Record<string, string | number>) => translate(lang, key, vars)
}

/** "early May" / "на початку травня" for a dekad in harvest-year coordinates. */
export function dekadLabel(lang: Lang, d: number): string {
  const dd = ((d % 36) + 36) % 36
  const part = (['part.early', 'part.mid', 'part.late'] as const)[dd % 3]
  return translate(lang, part, { m: translate(lang, `month.${Math.floor(dd / 3)}` as Key) })
}

export type { Key }
