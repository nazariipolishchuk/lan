import { useEffect } from 'react'
import { useT } from './i18n'
import { MapView } from './map/MapView'
import { FieldCard } from './screens/FieldCard'
import { useStore } from './state/store'

export default function App() {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const setLang = useStore((s) => s.setLang)
  const theme = useStore((s) => s.theme)
  const setTheme = useStore((s) => s.setTheme)
  const selectedId = useStore((s) => s.selectedId)
  const today = useStore((s) => s.today)
  const overridden = useStore((s) => s.dateOverridden)

  useEffect(() => {
    document.documentElement.lang = lang
    const onHash = () => {
      const m = window.location.hash.match(/^#\/f\/([0-9a-z]{10}|fixture-[A-C])/)
      useStore.getState().select(m ? m[1] : null)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [lang])

  return (
    <div className="app" data-card={!!selectedId}>
      <header className="topbar">
        <a className="brand" href="#/" onClick={() => useStore.getState().select(null)}>
          Lan
        </a>
        <p className="tagline">{t('app.tagline')}</p>
        <div className="top-actions">
          <span className="date-chip" title={overridden ? t('top.dateOverride') : undefined} data-override={overridden}>
            {t('top.today')} {today.toLocaleDateString(lang === 'uk' ? 'uk-UA' : 'en-GB', { day: 'numeric', month: 'short' })}
          </span>
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
      <main className="stage">
        <MapView />
        {selectedId && <FieldCard key={selectedId} id={selectedId} />}
      </main>
    </div>
  )
}
