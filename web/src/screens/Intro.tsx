// S0 Intro (first visit only; any tap outside the buttons skips it) and S9 Demo tour (PLAN §5.2a, §5.8, 4.6 B).
import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { useT, type Key } from '../i18n'
import { useStore } from '../state/store'

/** The curated demo field and its story (N: P2 showcase fields). */
export const DEMO_FIELD = '894u6cj46a'
const SEEN_KEY = 'lan.intro'

export function introSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}

export function markIntroSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1')
  } catch {
    /* storage disabled: the intro shows again next visit */
  }
}

export function Intro({ onFind, onDemo, onSkip }: { onFind: () => void; onDemo: () => void; onSkip: () => void }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const setLang = useStore((s) => s.setLang)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onSkip()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onSkip])
  return (
    <div className="intro" role="dialog" aria-modal="true" aria-labelledby="intro-title" onClick={onSkip}>
      <div className="intro-card" onClick={(e) => e.stopPropagation()}>
        <p className="intro-brand" id="intro-title">Lan</p>
        <p className="intro-tag">{t('app.tagline')}</p>
        <p className="intro-lead">{t('intro.lead')}</p>
        <div className="intro-actions">
          <button type="button" className="btn primary" onClick={onFind}>{t('intro.find')}</button>
          <button type="button" className="btn ghost" onClick={onDemo}>{t('intro.demo')}</button>
        </div>
        <ol className="intro-steps">
          <li><b>1</b> {t('intro.step1')}</li>
          <li><b>2</b> {t('intro.step2')}</li>
          <li><b>3</b> {t('intro.step3')}</li>
        </ol>
        <div className="intro-foot">
          <span>{t('intro.nasa')}</span>
          <div className="lang" role="group" aria-label="Language">
            <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button>
            <button type="button" aria-pressed={lang === 'uk'} onClick={() => setLang('uk')}>UK</button>
          </div>
        </div>
        <button type="button" className="intro-skip" onClick={onSkip}>{t('tour.skip')}</button>
      </div>
    </div>
  )
}

interface Step {
  target: string // data-tour value
  title: Key
  text: Key
  compare: boolean // the step lives on the comparison screen
}

// history strip → sow next → avoid → risks → compare → combos → My plan
const STEPS: Step[] = [
  { target: 'history', title: 'tour.history.t', text: 'tour.history', compare: false },
  { target: 'sow', title: 'tour.sow.t', text: 'tour.sow', compare: false },
  { target: 'avoid', title: 'tour.avoid.t', text: 'tour.avoid', compare: false },
  { target: 'risks', title: 'tour.risks.t', text: 'tour.risks', compare: false },
  { target: 'lane-balanced', title: 'tour.compare.t', text: 'tour.compare', compare: true },
  { target: 'combos-balanced', title: 'tour.combos.t', text: 'tour.combos', compare: true },
  { target: 'myplan', title: 'tour.myplan.t', text: 'tour.myplan', compare: true },
]

/** Coach marks over the demo field. Every step has "Skip"; the tour waits for its target to render. */
export function Tour({ onEnd }: { onEnd: () => void }) {
  const t = useT()
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const step = STEPS[i]

  useEffect(() => {
    const s = useStore.getState()
    if (s.compare !== step.compare) s.setCompare(step.compare)
    if (!step.compare && s.panel.kind !== 'card') s.openPanel({ kind: 'card' })
    if (!step.compare && s.sheet === 'peek') s.setSheet('half')
  }, [step])

  const measure = useCallback(() => {
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
    if (!el) return setRect(null)
    setRect(el.getBoundingClientRect())
  }, [step])

  useLayoutEffect(() => {
    let tries = 0
    let timer = 0
    const find = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        window.setTimeout(measure, 350)
      } else if (tries++ < 40) timer = window.setTimeout(find, 150) // data still loading
      else setRect(null)
    }
    find()
    const onMove = () => measure()
    window.addEventListener('resize', onMove)
    document.addEventListener('scroll', onMove, true)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('resize', onMove)
      document.removeEventListener('scroll', onMove, true)
    }
  }, [step, measure])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEnd()
      else if (e.key === 'ArrowRight') setI((v) => Math.min(v + 1, STEPS.length - 1))
      else if (e.key === 'ArrowLeft') setI((v) => Math.max(v - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onEnd])

  const last = i === STEPS.length - 1
  const vw = window.innerWidth
  const vh = window.innerHeight
  // popover below the target if there is room, otherwise above; on phones pinned to the top or bottom edge
  const below = rect ? rect.bottom + 190 < vh : true
  const style: React.CSSProperties = rect
    ? vw < 640
      ? (below ? { top: Math.min(rect.bottom + 10, vh - 200), left: 8, right: 8 } : { top: Math.max(8, rect.top - 200), left: 8, right: 8 })
      : { top: below ? rect.bottom + 10 : Math.max(8, rect.top - 190), left: Math.min(Math.max(8, rect.left), vw - 348) }
    : { top: vh / 2 - 90, left: Math.max(8, vw / 2 - 170) }
  return (
    <div className="tour" role="dialog" aria-live="polite" aria-label={t('tour.label')}>
      {rect && <div className="tour-ring" style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }} />}
      <div className="tour-pop" style={style}>
        <p className="tour-count">{t('tour.count', { i: i + 1, n: STEPS.length })}</p>
        <h3>{t(step.title)}</h3>
        <p>{t(step.text)}</p>
        <div className="tour-nav">
          <button type="button" className="btn ghost small-btn" onClick={onEnd}>{t('tour.skip')}</button>
          <span>
            {i > 0 && <button type="button" className="btn ghost small-btn" onClick={() => setI(i - 1)}>{t('tour.back')}</button>}
            <button type="button" className="btn primary small-btn" onClick={() => (last ? onEnd() : setI(i + 1))}>{last ? t('tour.done') : t('tour.next')}</button>
          </span>
        </div>
      </div>
    </div>
  )
}
