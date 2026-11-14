import { useEffect, useRef, useState } from 'react'
import { useT } from './i18n'
import { MapView } from './map/MapView'
import { Compare } from './screens/Compare'
import { FieldCard } from './screens/FieldCard'
import { parseHash, useStore } from './state/store'

export default function App() {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const setLang = useStore((s) => s.setLang)
  const theme = useStore((s) => s.theme)
  const setTheme = useStore((s) => s.setTheme)
  const selectedId = useStore((s) => s.selectedId)
  const compare = useStore((s) => s.compare)
  const storageOk = useStore((s) => s.storageOk)

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  useEffect(() => {
    const onHash = () => {
      const { id, compare: c } = parseHash(window.location.hash)
      const s = useStore.getState()
      if (id !== s.selectedId) s.select(id)
      if (c !== s.compare) s.setCompare(c)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  return (
    <div className="app" data-card={!!selectedId}>
      <header className="topbar">
        <a className="brand" href="#/" onClick={() => useStore.getState().select(null)}>
          Lan
        </a>
        <p className="tagline">{t('app.tagline')}</p>
        <div className="top-actions">
          <DateChip />
          <button type="button" className="theme-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? t('top.themeLight') : t('top.themeDark')} title={theme === 'dark' ? t('top.themeLight') : t('top.themeDark')}>
            <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
          </button>
          <div className="lang" role="group" aria-label="Language">
            <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button>
            <button type="button" aria-pressed={lang === 'uk'} onClick={() => setLang('uk')}>UK</button>
          </div>
        </div>
      </header>
      {!storageOk && <p className="notice" role="status">{t('notice.storage')}</p>}
      <main className="stage">
        <MapView />
        {selectedId && <FieldCard key={selectedId} id={selectedId} />}
        {selectedId && compare && <Compare key={`c-${selectedId}`} id={selectedId} />}
      </main>
    </div>
  )
}

/** "Today" chip: shows the date the plan is made for; a tap lets you plan as if it were another day (?date=). */
function DateChip() {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const today = useStore((s) => s.today)
  const overridden = useStore((s) => s.dateOverridden)
  const setToday = useStore((s) => s.setToday)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [open])
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return (
    <div className="date-wrap" ref={ref}>
      <button type="button" className="date-chip" data-override={overridden} aria-expanded={open} aria-label={`${t('top.dateChange')}: ${iso}`}
        title={overridden ? t('top.dateOverride') : t('top.dateChange')} onClick={() => setOpen((v) => !v)}>
        {t('top.today')} {today.toLocaleDateString(lang === 'uk' ? 'uk-UA' : 'en-GB', { day: 'numeric', month: 'short', ...(overridden ? { year: 'numeric' } : {}) })}
      </button>
      {open && (
        <div className="date-pop" role="dialog" aria-label={t('top.dateLabel')}>
          <label>
            <span>{t('top.dateLabel')}</span>
            <input type="date" value={iso} min="2017-01-01" max="2030-12-31" onChange={(e) => e.target.value && setToday(e.target.value)} />
          </label>
          {overridden && <button type="button" className="btn ghost small-btn" onClick={() => { setToday(null); setOpen(false) }}>{t('top.dateReset')}</button>}
        </div>
      )}
    </div>
  )
}
