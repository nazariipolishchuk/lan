// S8 About: method, data, measured accuracy (read from meta.json), limits, glossary, privacy, SI use,
// references and a coverage map drawn from oblasts.json (PLAN §5.8, task 4.4).
import type { Feature, FeatureCollection, Geometry, Position } from 'geojson'
import { useEffect, useState } from 'react'
import { loadMeta, loadOblasts } from '../data/loader'
import type { Meta } from '../engine/types'
import { useT } from '../i18n'
import { ABOUT } from '../i18n/about'
import { oblastName } from '../i18n/oblasts'
import { useStore } from '../state/store'

const REFS_URL = 'https://github.com/nazariipolishchuk/lan/blob/main/docs/REFERENCES.md'

export function About({ onClose, onReplay }: { onClose: () => void; onReplay: () => void }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const a = ABOUT[lang]
  const [meta, setMeta] = useState<Meta | null>(null)
  const [ob, setOb] = useState<FeatureCollection | null>(null)
  useEffect(() => {
    loadMeta().then(setMeta).catch(() => setMeta(null))
    loadOblasts().then(setOb)
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const pct = (v?: number) => (v === undefined ? '—' : `${(v * 100).toLocaleString(lang === 'uk' ? 'uk-UA' : 'en-GB', { maximumFractionDigits: 1 })}%`)
  const num = (v: number) => v.toLocaleString(lang === 'uk' ? 'uk-UA' : 'en-GB')
  const fill = (s: string, vars: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '')
  const acc = meta?.accuracy
  const regions = acc?.ukraine ? Object.values(acc.ukraine) : []
  return (
    <section className="about" role="dialog" aria-modal="true" aria-labelledby="about-title">
      <header className="about-head">
        <h1 id="about-title">{a.title}</h1>
        <button type="button" className="btn ghost small-btn" onClick={onClose}>{t('card.close')}</button>
      </header>
      <div className="about-body">
        <p className="about-lead">{a.intro}</p>
        <button type="button" className="btn small-btn" onClick={onReplay}>{a.replay}</button>

        <h2>{a.steps.h}</h2>
        <ol className="about-steps">
          {a.steps.items.map(([h, p]) => <li key={h}><b>{h}</b><p>{p}</p></li>)}
        </ol>

        <h2>{a.coverage.h}</h2>
        <p>{a.coverage.lead}</p>
        {meta?.oblasts && (
          <p className="about-total">{fill(a.coverage.total, {
            h: num(Object.values(meta.oblasts).reduce((s, o) => s + o.withHistory, 0)),
            n: num(Object.values(meta.oblasts).reduce((s, o) => s + o.fields, 0)),
          })}</p>
        )}
        {ob && <CoverageMap data={ob} lang={lang} legendHist={a.coverage.legendHist} legendNone={a.coverage.legendNone} />}

        <h2>{a.accuracy.h}</h2>
        <p>{a.accuracy.lead}</p>
        {acc && (
          <ul className="about-list">
            <li>{fill(a.accuracy.groupLine, { acc: pct(acc.accuracy), n: num(acc.n), tiles: (acc.testTiles ?? []).join(', '), f1: String(acc.macroF1) })}</li>
            {acc.crop && <li>{fill(a.accuracy.cropLine, { acc: pct(acc.crop.accuracy), f1: String(acc.crop.macroF1) })}</li>}
          </ul>
        )}
        <h3>{a.accuracy.regionsH}</h3>
        {regions.length ? (
          <>
            <p>{a.accuracy.regionsLead}</p>
            <div className="table-wrap">
              <table className="about-table">
                <thead><tr>{a.accuracy.regionCols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                <tbody>
                  {regions.map((r) => (
                    <tr key={r.tile}><td>{lang === 'uk' || !r.zone ? oblastName(r.oblast, lang) : r.zone}</td><td>{r.tile}</td><td>{pct(r.accuracy)}</td><td>{num(r.n)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : <p className="muted">{a.accuracy.noRegions}</p>}
        {acc?.confusion && acc.labels && (
          <>
            <h3>{a.accuracy.confusionH}</h3>
            <div className="table-wrap">
              <table className="about-table confusion">
                <thead><tr><th />{acc.labels.map((l) => <th key={l}>{a.accuracy.classes[l] ?? l}</th>)}</tr></thead>
                <tbody>
                  {acc.confusion.map((row, i) => (
                    <tr key={acc.labels![i]}><th>{a.accuracy.classes[acc.labels![i]] ?? acc.labels![i]}</th>{row.map((v, j) => <td key={j} data-diag={i === j}>{num(v)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted">{a.accuracy.confusionNote}</p>
          </>
        )}

        <h2>{a.data.h}</h2>
        <div className="table-wrap">
          <table className="about-table">
            <thead><tr>{a.data.cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>{a.data.rows.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>

        <h2>{a.cannot.h}</h2>
        <ul className="about-list">{a.cannot.items.map((x) => <li key={x}>{x}</li>)}</ul>

        <h2>{a.ground.h}</h2>
        <ul className="about-list">{a.ground.items.map((x) => <li key={x}>{x}</li>)}</ul>

        <h2>{a.glossary.h}</h2>
        <dl className="glossary">{a.glossary.items.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>

        <h2>{a.agronomist.h}</h2>
        <p>{a.agronomist.p}</p>
        <h2>{a.privacy.h}</h2>
        <p>{a.privacy.p}</p>
        <h2>{a.si.h}</h2>
        <p>{a.si.p}</p>
        <h2>{a.refs.h}</h2>
        <p>{a.refs.p} <a href={REFS_URL} target="_blank" rel="noreferrer">{a.refs.link}</a></p>
        {meta && <p className="muted small">{lang === 'uk' ? 'Дані зібрано' : 'Data built'} {meta.built.slice(0, 16).replace('T', ' ')} UTC</p>}
      </div>
    </section>
  )
}

/** Oblasts shaded by the share of fields with a crop history (equirectangular, scaled by cos 48.5°). */
function CoverageMap({ data, lang, legendHist, legendNone }: { data: FeatureCollection; lang: 'en' | 'uk'; legendHist: string; legendNone: string }) {
  const k = Math.cos((48.5 * Math.PI) / 180)
  const [x0, x1, y0, y1] = [22, 40.3, 44.3, 52.4]
  const W = 600
  const H = Math.round((W * (y1 - y0)) / ((x1 - x0) * k))
  const px = (p: Position) => `${(((p[0] - x0) / (x1 - x0)) * W).toFixed(1)},${(((y1 - p[1]) / (y1 - y0)) * H).toFixed(1)}`
  const ring = (r: Position[]) => `M${r.map(px).join('L')}Z`
  const path = (g: Geometry): string =>
    g.type === 'Polygon' ? g.coordinates.map(ring).join('') : g.type === 'MultiPolygon' ? g.coordinates.flat().map(ring).join('') : ''
  const share = (f: Feature) => {
    const p = f.properties as { fields: number; hist: number }
    return p.fields ? p.hist / p.fields : 0
  }
  return (
    <figure className="coverage">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={legendHist}>
        {data.features.map((f) => {
          const p = f.properties as { code: string; name: string; fields: number; hist: number }
          const s = share(f)
          return (
            <path key={p.code} d={path(f.geometry)} fill={s > 0 ? 'var(--gold)' : 'var(--raise)'} fillOpacity={s > 0 ? 0.25 + 0.7 * s : 1} stroke="var(--line)" strokeWidth={1}>
              <title>{`${oblastName(p.name, lang)}: ${Math.round(s * 100)}%`}</title>
            </path>
          )
        })}
      </svg>
      <figcaption><i className="sw" style={{ background: 'var(--gold)' }} /> {legendHist} · <i className="sw" style={{ background: 'var(--raise)', border: '1px solid var(--line)' }} /> {legendNone}</figcaption>
    </figure>
  )
}
