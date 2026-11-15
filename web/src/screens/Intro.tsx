// S0 Intro (first visit only) and S9 Guide: coach marks that walk a newcomer from the map through a field's
// card to the rotation comparison (PLAN §5.2a, §5.8). The guide is modelled on the MiamiDate onboarding tour:
// a dimmed screen with the current element cut out, a card with progress dots, and a glide between steps.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useT, type Key } from '../i18n'
import type { MapLayer } from '../map/layers'
import { useStore } from '../state/store'
import { placeCard, unionBox, visibleBox, type Box } from './guideLayout'

/** The demo field: Vinnytsia, 101 ha, a clean winter wheat ↔ summer crop rotation over eleven seasons (picked 15 Nov). */
export const DEMO_FIELD = '8a9alcg08c'
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

/** The welcome card. It no longer closes on a stray tap outside it: that hid the guide from people who
 *  touched the map first. Esc and "Skip" still close it. */
export function Intro({ onFind, onTour, onSkip }: { onFind: () => void; onTour: () => void; onSkip: () => void }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const setLang = useStore((s) => s.setLang)
  const start = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    start.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onSkip()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onSkip])
  return (
    <div className="intro" role="dialog" aria-modal="true" aria-labelledby="intro-title">
      <div className="intro-card">
        <p className="intro-brand" id="intro-title">Lan</p>
        <p className="intro-tag">{t('app.tagline')}</p>
        <p className="intro-lead">{t('intro.lead')}</p>
        <ul className="intro-points">
          <li><IntroIcon kind="sat" /><span><b>{t('intro.p1.t')}</b> {t('intro.p1')}</span></li>
          <li><IntroIcon kind="sprout" /><span><b>{t('intro.p2.t')}</b> {t('intro.p2')}</span></li>
          <li><IntroIcon kind="scales" /><span><b>{t('intro.p3.t')}</b> {t('intro.p3')}</span></li>
        </ul>
        <div className="intro-actions">
          <button ref={start} type="button" className="btn primary" onClick={onTour}>{t('intro.tour')}</button>
          <button type="button" className="btn ghost" onClick={onFind}>{t('intro.find')}</button>
        </div>
        <div className="intro-foot">
          <span>{t('intro.nasa')}</span>
          <div className="lang" role="group" aria-label="Language">
            <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button>
            <button type="button" aria-pressed={lang === 'uk'} onClick={() => setLang('uk')}>UA</button>
          </div>
        </div>
        <button type="button" className="intro-skip" onClick={onSkip}>{t('tour.skip')}</button>
      </div>
    </div>
  )
}

/** Line icons for the welcome card (emoji drew differently on every phone). */
function IntroIcon({ kind }: { kind: 'sat' | 'sprout' | 'scales' }) {
  const d = {
    sat: 'M8 8l3 3M5 5l3-3 3 3-3 3zM13 13l3-3 3 3-3 3zM10.5 10.5l3 3M15 4a5 5 0 015 5M15 7a2 2 0 012 2M4 20l4-4',
    sprout: 'M12 21v-9M12 12c0-4 3-7 8-7 0 5-3 7-8 7zM12 15c0-3-2-5-7-5 0 4 3 5 7 5zM7 21h10',
    scales: 'M12 4v16M8 20h8M5 7h14M5 7l-3 6a3 3 0 006 0zM19 7l-3 6a3 3 0 006 0zM12 4a1 1 0 100 .01',
  }[kind]
  return (
    <span className="intro-ico" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
    </span>
  )
}

type Screen = 'map' | 'card' | 'compare'

interface GuideStep {
  /** data-tour values; the spotlight covers all of them that are on screen */
  targets: string[]
  title: Key
  text: Key
  screen: Screen
  /** map layer shown while the step is up (the layer step colours the map so the legend has something to explain) */
  layer?: MapLayer
}

// map: search → layers → (opens a field) card head → history → sow next → avoid → risks → compare → my plan
const GUIDE: GuideStep[] = [
  { targets: ['search'], title: 'tour.search.t', text: 'tour.search', screen: 'map' },
  { targets: ['layers', 'legend'], title: 'tour.layers.t', text: 'tour.layers', screen: 'map', layer: 'last' },
  { targets: ['card-head'], title: 'tour.field.t', text: 'tour.field', screen: 'card' },
  { targets: ['history'], title: 'tour.history.t', text: 'tour.history', screen: 'card' },
  { targets: ['sow'], title: 'tour.sow.t', text: 'tour.sow', screen: 'card' },
  { targets: ['avoid'], title: 'tour.avoid.t', text: 'tour.avoid', screen: 'card' },
  { targets: ['risks'], title: 'tour.risks.t', text: 'tour.risks', screen: 'card' },
  { targets: ['lane-balanced'], title: 'tour.compare.t', text: 'tour.compare', screen: 'compare' },
  { targets: ['myplan'], title: 'tour.myplan.t', text: 'tour.myplan', screen: 'compare' },
]

function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p
  }
  return null
}

const PAD = 6 // spotlight beyond the element

/** Coach marks over the app. The dimmed screen swallows taps; only the card's buttons move the guide. */
export function Tour({ onEnd }: { onEnd: () => void }) {
  const t = useT()
  const [i, setI] = useState(0)
  const [spot, setSpot] = useState<Box | null>(null)
  const [cardSize, setCardSize] = useState({ w: 340, h: 200 })
  const [closing, setClosing] = useState(false)
  const card = useRef<HTMLDivElement>(null)
  const next = useRef<HTMLButtonElement>(null)
  const step = GUIDE[i]
  const last = i === GUIDE.length - 1

  // the field open when the guide started: phones hide the map chips under an open card, so the map steps
  // close it for a moment and the guide puts it back at the end
  const prior = useRef(useStore.getState().selectedId)
  useEffect(() => () => {
    const s = useStore.getState()
    if (prior.current && s.selectedId !== prior.current) s.select(prior.current)
  }, [])

  const finish = useCallback(() => setClosing(true), [])
  useEffect(() => {
    if (!closing) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const timer = window.setTimeout(onEnd, reduce ? 0 : 220)
    return () => window.clearTimeout(timer)
  }, [closing, onEnd])

  // Put the app on the screen the step talks about.
  useEffect(() => {
    const s = useStore.getState()
    const phone = window.innerWidth < 900
    if (step.screen === 'map') {
      if (s.compare) s.setCompare(false)
      if (s.selectedId && phone) s.select(null)
    } else {
      if (!s.selectedId) s.select(prior.current ?? DEMO_FIELD)
      const now = useStore.getState()
      if (now.compare !== (step.screen === 'compare')) now.setCompare(step.screen === 'compare')
      if (step.screen === 'card' && now.panel.kind !== 'card') now.openPanel({ kind: 'card' })
      if (step.screen === 'card' && now.sheet === 'peek') now.setSheet('half')
    }
    if (step.layer) {
      const before = useStore.getState().mapLayer
      if (before !== step.layer) {
        useStore.getState().setMapLayer(step.layer)
        return () => useStore.getState().setMapLayer(before)
      }
    }
  }, [step])

  const measure = useCallback(() => {
    const vw = window.innerWidth, vh = window.innerHeight
    const boxes = step.targets
      .map((k) => document.querySelector(`[data-tour="${k}"]`))
      .map((el) => (el ? visibleBox(el, vw, vh) : null))
      .filter((b): b is Box => !!b)
    const u = unionBox(boxes)
    if (!u) return setSpot(null)
    // pad the spotlight, but keep its ring inside the window
    const x0 = Math.max(2, u.x - PAD), y0 = Math.max(2, u.y - PAD)
    const x1 = Math.min(vw - 2, u.x + u.w + PAD), y1 = Math.min(vh - 2, u.y + u.h + PAD)
    setSpot({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 })
  }, [step])

  // Wait for the step's element (data may still be loading), bring it into view, then measure.
  useLayoutEffect(() => {
    let tries = 0
    let timer = 0
    const settle: number[] = []
    const find = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.targets[0]}"]`)
      if (el) {
        const box = scrollParent(el)
        const tall = box ? el.offsetHeight > box.clientHeight * 0.6 : false
        el.scrollIntoView({ block: tall ? 'start' : 'center', behavior: 'smooth' })
        // measure through the scroll and the sheet's resize; the last one is the resting place
        for (const ms of [60, 200, 400, 700]) settle.push(window.setTimeout(measure, ms))
      } else if (tries++ < 50) timer = window.setTimeout(find, 150)
      else setSpot(null)
    }
    find()
    const onMove = () => measure()
    window.addEventListener('resize', onMove)
    document.addEventListener('scroll', onMove, true)
    return () => {
      window.clearTimeout(timer)
      settle.forEach((s) => window.clearTimeout(s))
      window.removeEventListener('resize', onMove)
      document.removeEventListener('scroll', onMove, true)
    }
  }, [step, measure])

  // The card's real size, for placing it (the text length differs per step and language).
  useLayoutEffect(() => {
    const el = card.current
    if (!el) return
    const ro = new ResizeObserver(() => setCardSize({ w: el.offsetWidth, h: el.offsetHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    next.current?.focus({ preventScroll: true })
  }, [i])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish()
      else if (e.key === 'ArrowRight') setI((v) => Math.min(v + 1, GUIDE.length - 1))
      else if (e.key === 'ArrowLeft') setI((v) => Math.max(v - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finish])

  const vw = window.innerWidth, vh = window.innerHeight
  const pos = placeCard(spot, cardSize.w, cardSize.h, vw, vh)
  const hole = spot ?? { x: vw / 2, y: vh / 2, w: 0, h: 0 }
  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label={t('tour.label')} data-closing={closing}
      onPointerDown={(e) => e.target === e.currentTarget && e.preventDefault()}>
      <div className="tour-hole" data-empty={!spot} style={{ top: hole.y, left: hole.x, width: hole.w, height: hole.h }} />
      <div className="tour-pop" ref={card} style={pos} aria-live="polite">
        <div className="tour-head">
          <span className="tour-dots" aria-hidden="true">
            {GUIDE.map((_, k) => <i key={k} data-on={k <= i} />)}
          </span>
          <span className="tour-count">{t('tour.count', { i: i + 1, n: GUIDE.length })}</span>
        </div>
        <h3>{t(step.title)}</h3>
        <p>{t(step.text)}</p>
        <div className="tour-nav">
          {!last && <button type="button" className="tour-skip" onClick={finish}>{t('tour.skip')}</button>}
          <span>
            {i > 0 && <button type="button" className="tour-back" aria-label={t('tour.back')} title={t('tour.back')} onClick={() => setI(i - 1)}>←</button>}
            <button ref={next} type="button" className="btn primary tour-next" onClick={() => (last ? finish() : setI(i + 1))}>
              {last ? t('tour.done') : t('tour.next')}
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}
