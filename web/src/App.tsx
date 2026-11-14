import { useCallback, useEffect, useRef, useState } from 'react'
import { useT } from './i18n'
import { MapControls } from './map/MapControls'
import { MapView } from './map/MapView'
import { About } from './screens/About'
import { Compare } from './screens/Compare'
import { DesignBoard } from './screens/DesignBoard'
import { FieldCard } from './screens/FieldCard'
import { DEMO_FIELD, Intro, Tour, introSeen, markIntroSeen } from './screens/Intro'
import { parseHash, useStore } from './state/store'

export default function App() {
  if (import.meta.env.DEV && window.location.hash.startsWith('#/design')) return <DesignBoard />
  return <Main />
}

function Main() {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const setLang = useStore((s) => s.setLang)
  const theme = useStore((s) => s.theme)
  const setTheme = useStore((s) => s.setTheme)
  const selectedId = useStore((s) => s.selectedId)
  const compare = useStore((s) => s.compare)
  const storageOk = useStore((s) => s.storageOk)
  const [about, setAbout] = useState(() => window.location.hash.startsWith('#/about'))
  const demoParam = new URLSearchParams(window.location.search).get('demo') === '1'
  // S0 on the first visit to the bare map; ?demo=1 goes straight to the tour (S9)
  const [intro, setIntro] = useState(() => !demoParam && !introSeen() && !parseHash(window.location.hash).id && !window.location.hash.startsWith('#/about'))
  const [tour, setTour] = useState(demoParam)
  const [focusSearch, setFocusSearch] = useState(0)

  useEffect(() => {
    if (demoParam) useStore.getState().select(DEMO_FIELD)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const closeAbout = useCallback(() => {
    setAbout(false)
    if (window.location.hash.startsWith('#/about')) history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/`)
  }, [])
  const openAbout = () => {
    setAbout(true)
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/about`)
  }
  const startDemo = () => {
    markIntroSeen()
    setIntro(false)
    setAbout(false)
    useStore.getState().select(DEMO_FIELD)
    setTour(true)
  }
  const skipIntro = useCallback(() => {
    markIntroSeen()
    setIntro(false)
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  useEffect(() => {
    const onHash = () => {
      setAbout(window.location.hash.startsWith('#/about'))
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
          <button type="button" className="about-btn" onClick={openAbout} aria-label={t('top.about')} title={t('top.about')}>
            <span aria-hidden="true">ⓘ</span><span className="about-label">{t('top.aboutShort')}</span>
          </button>
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
        <MapControls focusSearch={focusSearch} />
        {selectedId && <FieldCard key={selectedId} id={selectedId} />}
        {selectedId && compare && <Compare key={`c-${selectedId}`} id={selectedId} />}
        {about && <About onClose={closeAbout} onReplay={() => { closeAbout(); setIntro(true) }} />}
      </main>
      {intro && <Intro onSkip={skipIntro} onDemo={startDemo} onFind={() => { skipIntro(); setFocusSearch((n) => n + 1) }} />}
      {tour && selectedId && <Tour onEnd={() => { setTour(false); useStore.getState().setCompare(false) }} />}
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
        <span className="date-word">{t('top.today')} </span>{today.toLocaleDateString(lang === 'uk' ? 'uk-UA' : 'en-GB', { day: 'numeric', month: 'short', ...(overridden ? { year: 'numeric' } : {}) })}
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
