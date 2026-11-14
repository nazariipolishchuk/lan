// S7 Evidence, "Why?" (PLAN §5.7): the charts behind every claim, each with a caption, source and resolution.
import { DaysBarChart, FrostSeasonChart, GreennessChart } from './charts2'
import { useEffect, useMemo, useState } from 'react'
import { decodeCurves, loadCurves } from '../data/loader'
import type { CardModel } from '../engine/card'
import { cropCalendar } from '../engine/calendar'
import { hazardSeries } from '../engine/hazards'
import { completeYears, lastCompleteYear, scenarioYears, seasonBalance } from '../engine/score'
import { dekadLabel, useT, type Key } from '../i18n'
import { useStore, type EvidenceTab } from '../state/store'
import { Diverging, StatTiles, TableView, YearBars } from './charts'
import { PanelHead, ScenarioSwitch, useCropName, type Loaded } from './common'

const TABS: EvidenceTab[] = ['green', 'bare', 'rain', 'heat', 'moisture', 'change', 'terrain', 'soil']
const BARE = 0.25

export function Evidence({ data, card, tab: initial }: { data: Loaded; card: CardModel; tab?: EvidenceTab }) {
  const t = useT()
  const openPanel = useStore((s) => s.openPanel)
  const [tab, setTab] = useState<EvidenceTab>(initial ?? 'green')
  return (
    <div className="evidence">
      <PanelHead title={`${t('ev.title')}`} onBack={() => openPanel({ kind: 'card' })} backLabel={t('ev.close')} />
      <div className="tabs" role="tablist" aria-label={t('ev.title')}>
        {TABS.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{t(`ev.tab.${k}` as Key)}</button>
        ))}
      </div>
      <div role="tabpanel" className="tabpanel">
        {tab === 'green' && <Greenness data={data} />}
        {tab === 'bare' && <BareSoil data={data} />}
        {tab === 'rain' && <Rain data={data} card={card} />}
        {tab === 'heat' && <Heat data={data} />}
        {tab === 'moisture' && <Moisture data={data} />}
        {tab === 'change' && <Change data={data} />}
        {tab === 'terrain' && <Terrain data={data} />}
        {tab === 'soil' && <Soil data={data} />}
      </div>
    </div>
  )
}

function Foot({ src, cannot, estimate }: { src: string; cannot: string; estimate?: boolean }) {
  const t = useT()
  return (
    <>
      <p className="src">{src}{estimate ? <> {t('ev.estimate')}</> : null}</p>
      <details className="cannot"><summary>{t('ev.cannot')}</summary><p>{cannot}</p></details>
    </>
  )
}

type Curves = { y: number; v: (number | null)[] }[]

function useCurves(id: string): { state: 'loading' | 'none' | 'ok' | 'error'; curves: Curves | null } {
  const [s, setS] = useState<{ state: 'loading' | 'none' | 'ok' | 'error'; curves: Curves | null }>({ state: 'loading', curves: null })
  useEffect(() => {
    let live = true
    loadCurves(id).then((ch) => {
      const c = ch ? decodeCurves(ch, id) : null
      if (live) setS(c ? { state: 'ok', curves: c } : { state: 'none', curves: null })
    }).catch(() => live && setS({ state: 'error', curves: null }))
    return () => {
      live = false
    }
  }, [id])
  return s
}

const DEKADS = Array.from({ length: 27 }, (_, i) => i + 6) // March to mid-November, as in the curve files

function quantile(xs: number[], q: number): number {
  const s = [...xs].sort((a, b) => a - b)
  const i = (s.length - 1) * q
  const lo = Math.floor(i)
  return s[lo] + (s[Math.min(s.length - 1, lo + 1)] - s[lo]) * (i - lo)
}

function Greenness({ data }: { data: Loaded }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const { state, curves } = useCurves(data.field.id)
  if (state === 'loading') return <p className="muted" aria-busy="true">{t('ev.loading')}</p>
  if (!curves) return <p className="muted">{t('ev.noCurves')}</p>
  const withData = curves.filter((c) => c.v.some((v) => v !== null))
  const cur = withData[withData.length - 1]
  const earlier = withData.filter((c) => c.y < cur.y)
  const band = DEKADS.map((d) => {
    const vs = earlier.map((c) => c.v[d]).filter((v): v is number => v !== null)
    return vs.length >= 3 ? [quantile(vs, 0.25), quantile(vs, 0.75)] as [number, number] : null
  })
  const current = DEKADS.map((d) => cur.v[d])
  const peak = Math.max(...current.filter((v): v is number => v !== null))
  const meanPeak = earlier.length ? earlier.map((c) => Math.max(...c.v.filter((v): v is number => v !== null))).reduce((a, b) => a + b, 0) / earlier.length : NaN
  const pct = Number.isFinite(meanPeak) && meanPeak > 0 ? Math.round(((peak - meanPeak) / meanPeak) * 100) : 0
  return (
    <>
      <h4 className="chart-title">{t('ev.green.title', { y: cur.y })}</h4>
      <p className="caption">{t('ev.green.caption', { y: cur.y, pct: Math.abs(pct), dir: pct >= 0 ? t('ev.green.above') : t('ev.green.below') })} {t('ev.green.what')}</p>
      <GreennessChart dekads={DEKADS} current={current} band={band} year={cur.y} yearsN={earlier.length}
        monthLabel={(m) => monthShort(lang, m)} fmt={(v) => v.toLocaleString(lang === 'uk' ? 'uk-UA' : 'en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
        labels={{ yTitle: t('ev.green.yTitle'), bare: t('ev.green.bare'), range: t('ev.green.usual'), readout: t('ev.green.readout'), peak: t('ev.green.peak') }} />
      <TableView head={['', ...withData.map((c) => String(c.y))]}
        rows={DEKADS.map((d) => [dekadLabel(lang, d), ...withData.map((c) => (c.v[d] === null ? '—' : c.v[d]!.toFixed(2)))])} />
      <Foot src={t('ev.green.src')} cannot={t('ev.green.cannot')} estimate />
    </>
  )
}

function BareSoil({ data }: { data: Loaded }) {
  const t = useT()
  const { state, curves } = useCurves(data.field.id)
  if (state === 'loading') return <p className="muted" aria-busy="true">{t('ev.loading')}</p>
  if (!curves) return <p className="muted">{t('ev.noCurves')}</p>
  const months = [2, 3, 4, 5, 6, 7, 8, 9]
  const share = months.map((m) => {
    let bare = 0
    let n = 0
    for (const c of curves) {
      const vs = [m * 3, m * 3 + 1, m * 3 + 2].map((d) => c.v[d]).filter((v): v is number => v !== null)
      if (!vs.length) continue
      n++
      if (vs.reduce((a, b) => a + b, 0) / vs.length < BARE) bare++
    }
    return { y: m, v: n ? Math.round((100 * bare) / n) : null, hit: n > 0 && bare / n >= 0.5 }
  })
  const monthName = (m: number) => t(`month.${m}` as Key)
  const usual = share.filter((s) => s.hit).map((s) => monthName(s.y))
  return (
    <>
      <p className="caption">{usual.length ? t('ev.bare.caption', { months: usual.join(', ') }) : t('ev.bare.none')}</p>
      <YearBars data={share} unit="%" fmt={(v) => `${Math.round(v)}`} label={t('ev.bare.unit')} xl={(m) => monthName(m).slice(0, 3)} />
      <Foot src={t('ev.bare.src')} cannot={t('ev.bare.cannot')} />
    </>
  )
}

function Rain({ data, card }: { data: Loaded; card: CardModel }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const scenario = useStore((s) => s.scenario)
  const today = useStore((s) => s.today)
  const name = useCropName(data.crops)
  const { cell } = data
  const crop = card.risks?.crop ?? card.sowNext[0]?.crop
  // prefer a drought hazard (rain or water balance below a threshold); fall back to a wet one
  const h = crop?.hazards.find((x) => x.variable === 'rain' && x.cmp === '<') ?? crop?.hazards.find((x) => x.variable === 'balance' && x.cmp === '<')
    ?? crop?.hazards.find((x) => x.variable === 'rain' || x.variable === 'balance')
  const years = scenarioYears(cell, scenario, lastCompleteYear(cell, today))
  const series = useMemo(() => (crop && h ? hazardSeries(crop, cell, h.id, years) : []), [crop, h, cell, years])
  if (!crop || !h) return <p className="muted">{t('ev.rain.none')}</p>
  const cal = cropCalendar(crop, cell)!
  const base = h.window.from === 'sow' ? cal.sow.start : cal.harvest.start
  const window = `${dekadLabel(lang, base + h.window.start)} – ${dekadLabel(lang, base + h.window.end)}`
  const hit = (v: number | null) => v !== null && (h.cmp === '<' ? v < h.threshold.v : v > h.threshold.v)
  const rows = series.map((s) => ({ ...s, hit: hit(s.v) }))
  const count = rows.filter((r) => r.hit).length
  return (
    <>
      <ScenarioSwitch cell={cell} />
      <p className="caption">{t('ev.rain.caption', { crop: name(crop.id), what: t(h.label as Key).toLowerCase(), window, dir: h.cmp === '<' ? t('ev.rain.below') : t('ev.rain.above'), thr: h.threshold.v, count, years: rows.filter((r) => r.v !== null).length })}</p>
      <YearBars data={rows} threshold={h.threshold.v} unit={h.variable === 'balance' ? t('ev.rain.unitBalance') : t('ev.rain.unit')} fmt={(v) => `${Math.round(v)}`} label={`${t(h.label as Key)} · ${t('ev.rain.unit')}`} />
      <Foot src={t('ev.rain.src')} cannot={t('ev.rain.cannot')} />
    </>
  )
}

function Heat({ data }: { data: Loaded }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const today = useStore((s) => s.today)
  const { cell } = data
  const years = completeYears(cell, lastCompleteYear(cell, today))
  const rows = years.map((y) => {
    const yr = cell.years.find((x) => x.y === y)!
    return { y, v: yr.hot30.reduce((a: number, b) => a + (b ?? 0), 0), last: yr.lastSpringFrostDoy, first: yr.firstAutumnFrostDoy }
  })
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : 0)
  const recent = avg(rows.slice(-10).map((r) => r.v))
  const base = avg(rows.slice(0, -10).map((r) => r.v))
  const fmtDoy = (d: number) => new Date(2021, 0, d).toLocaleDateString(lang === 'uk' ? 'uk-UA' : 'en-GB', { day: 'numeric', month: 'short' })
  return (
    <>
      <h4 className="chart-title">{t('ev.heat.title')}</h4>
      <p className="caption">{t('ev.heat.caption', { recent, base })} {t('ev.heat.what')}</p>
      <DaysBarChart rows={rows.map((r) => ({ y: r.y, v: r.v }))} split={years[years.length - 1] - 9}
        labels={{ yTitle: t('ev.heat.yTitle'), early: t('ev.heat.early'), recent: t('ev.heat.recent'), readout: t('ev.heat.readout') }} />
      <h4 className="chart-title">{t('ev.frost.title')}</h4>
      <p className="caption">{t('ev.frost.what')}</p>
      <FrostSeasonChart rows={rows.map((r) => ({ y: r.y, last: r.last, first: r.first }))} monthLabel={(m) => monthShort(lang, m)} fmtDoy={fmtDoy}
        labels={{ title: '', last: t('ev.frost.usualLast'), first: t('ev.frost.usualFirst'), readout: t('ev.frost.readout'), median: '' }} />
      <TableView head={['', t('ev.heat.unit'), t('ev.frost.last'), t('ev.frost.first')]}
        rows={rows.map((r) => [r.y, Math.round(r.v), r.last ? fmtDoy(r.last) : '—', r.first ? fmtDoy(r.first) : '—'])} />
      <Foot src={t('ev.heat.src')} cannot={t('ev.heat.cannot')} />
    </>
  )
}

function Moisture({ data }: { data: Loaded }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const today = useStore((s) => s.today)
  const { cell } = data
  const ys = completeYears(cell, lastCompleteYear(cell, today))
  const last = cell.years.filter((y) => y.wet.some((v) => v !== null)).slice(-1)[0]
  if (!last) return <p className="muted">{t('ev.none')}</p>
  const normal = Array.from({ length: 36 }, (_, d) => {
    const vs = ys.filter((y) => y !== last.y).map((y) => cell.years.find((x) => x.y === y)!.wet[d]).filter((v): v is number => v !== null)
    return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null
  })
  const anom = last.wet.map((v, d) => (v === null || normal[d] === null ? null : v - normal[d]!))
  const n = anom.filter((v) => v !== null).length
  const dry = anom.filter((v) => v !== null && v < 0).length
  const labels = Array.from({ length: 36 }, (_, d) => d)
  return (
    <>
      <p className="caption">{t('ev.moist.caption', { y: last.y, dry, n })}</p>
      <Diverging values={anom} labels={labels} xLabel={(d) => dekadLabel(lang, d)} unit={t('ev.moist.unit')}
        words={{ pos: t('ev.moist.wetter'), neg: t('ev.moist.drier') }} />
      <TableView head={['', t('ev.moist.unit')]} rows={anom.map((v, d) => [dekadLabel(lang, d), v === null ? '—' : v.toFixed(2)])} />
      <Foot src={t('ev.moist.src')} cannot={t('ev.moist.cannot')} />
    </>
  )
}

function Change({ data }: { data: Loaded }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const today = useStore((s) => s.today)
  const { cell } = data
  const ys = completeYears(cell, lastCompleteYear(cell, today))
  const recent = ys.slice(-10)
  const base = ys.slice(0, -10)
  if (!base.length) return <p className="muted">{t('ev.none')}</p>
  const yr = (y: number) => cell.years.find((x) => x.y === y)!
  const metrics: [Key, (y: number) => number | null, number][] = [
    ['ev.change.rain', (y) => yr(y).rain.slice(9, 27).reduce((a: number, b) => a + (b ?? 0), 0), 0],
    ['ev.change.balance', (y) => seasonBalance(cell, y), 0],
    ['ev.change.gdd', (y) => yr(y).gdd5, 0],
    ['ev.change.hot', (y) => yr(y).hot30.reduce((a: number, b) => a + (b ?? 0), 0), 1],
    ['ev.change.frostfree', (y) => {
      const a = yr(y).lastSpringFrostDoy
      const b = yr(y).firstAutumnFrostDoy
      return a !== null && b !== null ? b - a : null
    }, 0],
  ]
  const avg = (f: (y: number) => number | null, list: number[]) => {
    const v = list.map(f).filter((x): x is number => x !== null)
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN
  }
  const nf = (v: number, d: number) => (Number.isFinite(v) ? v.toLocaleString(lang === 'uk' ? 'uk-UA' : 'en-GB', { maximumFractionDigits: d, minimumFractionDigits: d }) : '—')
  const range = (l: number[]) => ({ from: l[0], to: l[l.length - 1] })
  return (
    <>
      <p className="caption">{t('ev.change.caption', range(base))}</p>
      <table className="change">
        <thead>
          <tr><th scope="col">{t('ev.change.metric')}</th><th scope="col">{t('ev.change.base', range(base))}</th><th scope="col">{t('ev.change.recent', range(recent))}</th><th scope="col">{t('ev.change.delta')}</th></tr>
        </thead>
        <tbody>
          {metrics.map(([k, f, d]) => {
            const a = avg(f, base)
            const b = avg(f, recent)
            const delta = b - a
            return (
              <tr key={k}>
                <th scope="row">{t(k)}</th><td>{nf(a, d)}</td><td>{nf(b, d)}</td>
                <td className="delta">{delta > 0 ? '▲ +' : delta < 0 ? '▼ ' : ''}{nf(delta, d)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <Foot src={t('ev.change.src')} cannot={t('ev.change.cannot')} />
    </>
  )
}

function Terrain({ data }: { data: Loaded }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const tr = data.field.terrain
  if (!tr) return <p className="muted">{t('ev.none')}</p>
  const nf = (v: number, d = 1) => v.toLocaleString(lang === 'uk' ? 'uk-UA' : 'en-GB', { maximumFractionDigits: d })
  const verdict = tr.slopeP90 < 2 ? 'ev.terrain.flat' : tr.slopeP90 < 5 ? 'ev.terrain.gentle' : 'ev.terrain.steep'
  return (
    <>
      <p className="caption">{t('ev.terrain.caption', { s: nf(tr.slope), p: nf(tr.slopeP90), e: nf(tr.elev, 0) })}</p>
      <StatTiles items={[
        { label: t('ev.terrain.slope'), value: `${nf(tr.slope)} %` },
        { label: t('ev.terrain.p90'), value: `${nf(tr.slopeP90)} %` },
        { label: t('ev.terrain.elev'), value: `${nf(tr.elev, 0)} m` },
      ]} />
      <p className="note">{t(verdict as Key)}</p>
      <Foot src={t('ev.terrain.src')} cannot={t('ev.terrain.cannot')} />
    </>
  )
}

function Soil({ data }: { data: Loaded }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const s = data.field.soil
  if (!s) return <p className="muted">{t('ev.none')}</p>
  const nf = (v: number, d = 0) => v.toLocaleString(lang === 'uk' ? 'uk-UA' : 'en-GB', { maximumFractionDigits: d })
  const silt = Math.max(0, 100 - s.clay - s.sand)
  const parts = [
    { k: 'clay', label: t('ev.soil.clay'), v: s.clay },
    { k: 'silt', label: t('ev.soil.silt'), v: silt },
    { k: 'sand', label: t('ev.soil.sand'), v: s.sand },
  ]
  return (
    <>
      <p className="caption">{t('ev.soil.caption', { clay: nf(s.clay), silt: nf(silt), sand: nf(s.sand), soc: nf(s.soc, 1), ph: nf(s.ph, 1) })}</p>
      <div className="texture" role="img" aria-label={parts.map((p) => `${p.label} ${nf(p.v)} %`).join(', ')}>
        {parts.map((p) => (
          <span key={p.k} className={`tex tex-${p.k}`} style={{ flexGrow: Math.max(1, p.v) }}>
            <span>{p.label} {nf(p.v)} %</span>
          </span>
        ))}
      </div>
      <StatTiles items={[
        { label: t('ev.soil.soc'), value: `${nf(s.soc, 1)} %` },
        { label: t('ev.soil.ph'), value: nf(s.ph, 1) },
      ]} />
      <Foot src={t('ev.soil.src')} cannot={t('ev.soil.cannot')} />
    </>
  )
}

/** Short month name for chart axes (0 = January). */
function monthShort(lang: 'en' | 'uk', m: number): string {
  return new Date(2021, m, 1).toLocaleDateString(lang === 'uk' ? 'uk-UA' : 'en-GB', { month: 'short' }).replace('.', '')
}
