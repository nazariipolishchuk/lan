// Small SVG charts for Evidence (S7). One axis each, thin marks, recessive grid, a hover/tap readout,
// and a table view. Colours: gold = this field / this season, frost = its usual range (a neutral
// reference), warn = a year over a hazard threshold (always with a marker and a count in the caption).
import { useState, type ReactNode } from 'react'
import { useT } from '../i18n'

const W = 360
const H = 170
const PAD = { l: 34, r: 8, t: 10, b: 22 }
const iw = W - PAD.l - PAD.r
const ih = H - PAD.t - PAD.b

function ticks(lo: number, hi: number, n = 4): number[] {
  const span = hi - lo || 1
  const step0 = span / n
  const mag = 10 ** Math.floor(Math.log10(step0))
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? step0
  const out: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000)
  return out
}

function Readout({ text, hint }: { text: string | null; hint: string }) {
  return <p className="readout" aria-live="polite">{text ?? hint}</p>
}

function YAxis({ lo, hi, y, fmt }: { lo: number; hi: number; y: (v: number) => number; fmt: (v: number) => string }) {
  return (
    <g className="ax">
      {ticks(lo, hi).map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="grid" />
          <text x={PAD.l - 4} y={y(v) + 3} textAnchor="end">{fmt(v)}</text>
        </g>
      ))}
    </g>
  )
}

export function TableView({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  const t = useT()
  return (
    <details className="tableview">
      <summary>{t('ev.table')}</summary>
      <table>
        <thead><tr>{head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => j ? <td key={j}>{c}</td> : <th key={j} scope="row">{c}</th>)}</tr>)}</tbody>
      </table>
    </details>
  )
}

/** Bars per year with an optional threshold line; `hit` years carry a marker above the bar. */
export function YearBars({ data, threshold, unit, fmt, label, xl }: {
  data: { y: number; v: number | null; hit?: boolean }[]; threshold?: number; unit: string; fmt: (v: number) => string; label: string
  /** Category labels instead of years (every bar labelled) */
  xl?: (y: number) => string
}) {
  const t = useT()
  const [hover, setHover] = useState<number | null>(null)
  const vals = data.map((d) => d.v).filter((v): v is number => v !== null)
  const lo = Math.min(0, ...vals, threshold ?? 0)
  const hi = Math.max(1, ...vals, threshold ?? 0) * 1.08
  const y = (v: number) => PAD.t + ih - ((v - lo) / (hi - lo)) * ih
  const bw = iw / Math.max(1, data.length)
  const h = hover !== null ? data[hover] : null
  return (
    <figure className="chart">
      <Readout text={h ? `${xl ? xl(h.y) : h.y}: ${h.v === null ? '—' : `${fmt(h.v)} ${unit}`}${h.hit ? ' ▲' : ''}` : null} hint={label} />
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} onPointerLeave={() => setHover(null)}>
        <YAxis lo={lo} hi={hi} y={y} fmt={fmt} />
        {data.map((d, i) => {
          const x = PAD.l + i * bw
          const top = d.v === null ? y(0) : y(Math.max(0, d.v))
          const bottom = d.v === null ? y(0) : y(Math.min(0, d.v))
          return (
            <g key={d.y} onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)}>
              <rect x={x} y={PAD.t} width={bw} height={ih} fill="transparent" />
              {d.v !== null && <rect x={x + 1} y={top} width={Math.max(1, bw - 2)} height={Math.max(1, bottom - top)} rx={Math.min(3, bw / 3)} className={d.hit ? 'mark warn' : 'mark'} data-on={hover === i} />}
              {d.hit && <text x={x + bw / 2} y={top - 3} textAnchor="middle" className="hitmark">▲</text>}
              {(xl || i === 0 || i === data.length - 1 || d.y % 5 === 0) && <text x={x + bw / 2} y={H - 6} textAnchor="middle" className="xl">{xl ? xl(d.y) : d.y}</text>}
            </g>
          )
        })}
        {threshold !== undefined && (
          <g>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(threshold)} y2={y(threshold)} className="thr" />
            <text x={W - PAD.r} y={y(threshold) - 3} textAnchor="end" className="thr-label">{t('ev.rain.thr')} {fmt(threshold)}</text>
          </g>
        )}
      </svg>
      <TableView head={['', unit]} rows={data.map((d) => [xl ? xl(d.y) : d.y, d.v === null ? '—' : `${fmt(d.v)}${d.hit ? ' ▲' : ''}`])} />
    </figure>
  )
}

/** This season's curve against the middle half of earlier seasons and their mean, by dekad. */
export function CurveBand({ dekads, band, mean, current, labels, xLabel }: {
  dekads: number[]; band: ([number, number] | null)[]; mean: (number | null)[]; current: (number | null)[]
  labels: { current: string; mean: string; band: string }; xLabel: (d: number) => string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const all = [...band.flat(), ...mean, ...current].filter((v): v is number => v !== null && v !== undefined)
  const lo = 0
  const hi = Math.max(0.5, ...all) * 1.05
  const x = (i: number) => PAD.l + (i / Math.max(1, dekads.length - 1)) * iw
  const y = (v: number) => PAD.t + ih - ((v - lo) / (hi - lo)) * ih
  const path = (vs: (number | null)[]) => vs.map((v, i) => (v === null ? null : `${x(i)},${y(v)}`))
    .reduce((acc: string, p, i, arr) => (p ? acc + (i && arr[i - 1] ? ' L' : ' M') + p : acc), '')
  const bandPath = (() => {
    const segs: string[] = []
    let cur: number[] = []
    const flush = () => {
      if (cur.length > 1) segs.push(`M${cur.map((i) => `${x(i)},${y(band[i]![1])}`).join(' L')} L${[...cur].reverse().map((i) => `${x(i)},${y(band[i]![0])}`).join(' L')} Z`)
      cur = []
    }
    band.forEach((b, i) => (b ? cur.push(i) : flush()))
    flush()
    return segs.join(' ')
  })()
  const fmt = (v: number | null) => (v === null ? '—' : v.toFixed(2))
  const h = hover
  return (
    <figure className="chart">
      <Readout text={h !== null ? `${xLabel(dekads[h])}: ${labels.current} ${fmt(current[h])} · ${labels.mean} ${fmt(mean[h])}` : null} hint={`${labels.current} · ${labels.band}`} />
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${labels.current}, ${labels.band}`} onPointerLeave={() => setHover(null)}>
        <YAxis lo={lo} hi={hi} y={y} fmt={(v) => v.toFixed(1)} />
        <path d={bandPath} className="band" />
        <path d={path(mean)} className="line mean" />
        <path d={path(current)} className="line now" />
        {h !== null && <line x1={x(h)} x2={x(h)} y1={PAD.t} y2={PAD.t + ih} className="cross" />}
        {h !== null && current[h] !== null && <circle cx={x(h)} cy={y(current[h]!)} r={4} className="dot now" />}
        {dekads.map((d, i) => (
          <g key={d}>
            <rect x={x(i) - iw / dekads.length / 2} y={PAD.t} width={iw / dekads.length} height={ih} fill="transparent"
              onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)} />
            {d % 3 === 0 && <text x={x(i)} y={H - 6} textAnchor="middle" className="xl">{xLabel(d).split(' ').pop()!.slice(0, 3)}</text>}
          </g>
        ))}
      </svg>
      <ul className="legend">
        <li><i className="sw now" />{labels.current}</li>
        <li><i className="sw mean" />{labels.mean}</li>
        <li><i className="sw band" />{labels.band}</li>
      </ul>
    </figure>
  )
}

/** Above/below normal per period: two directions, a neutral zero line; words name the directions. */
export function Diverging({ values, labels, xLabel, words, unit }: {
  values: (number | null)[]; labels: number[]; xLabel: (d: number) => string; words: { pos: string; neg: string }; unit: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const vals = values.filter((v): v is number => v !== null)
  const m = Math.max(0.05, ...vals.map(Math.abs)) * 1.1
  const y = (v: number) => PAD.t + ih / 2 - (v / m) * (ih / 2)
  const bw = iw / Math.max(1, values.length)
  const h = hover !== null ? values[hover] : null
  return (
    <figure className="chart">
      <Readout text={hover !== null ? `${xLabel(labels[hover])}: ${h === null ? '—' : `${h > 0 ? '+' : ''}${h.toFixed(2)} (${h >= 0 ? words.pos : words.neg})`}` : null} hint={unit} />
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={unit} onPointerLeave={() => setHover(null)}>
        {ticks(-m, m, 4).filter((v) => v !== 0).map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="grid" />
            <text x={PAD.l - 4} y={y(v) + 3} textAnchor="end" className="xl">{v > 0 ? '+' : '−'}{Math.abs(v).toFixed(2)}</text>
          </g>
        ))}
        <text x={W - PAD.r} y={PAD.t + 8} textAnchor="end" className="xl">▲ {words.pos}</text>
        <text x={W - PAD.r} y={PAD.t + ih - 2} textAnchor="end" className="xl">▼ {words.neg}</text>
        <line x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} className="zero" />
        <text x={PAD.l - 4} y={y(0) + 3} textAnchor="end" className="xl">0</text>
        {values.map((v, i) => {
          const x = PAD.l + i * bw
          return (
            <g key={i} onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)}>
              <rect x={x} y={PAD.t} width={bw} height={ih} fill="transparent" />
              {v !== null && <rect x={x + 1} y={Math.min(y(0), y(v))} width={Math.max(1, bw - 2)} height={Math.max(1, Math.abs(y(v) - y(0)))} rx={2} className={v < 0 ? 'mark warn' : 'mark cool'} data-on={hover === i} />}
              {labels[i] % 3 === 0 && <text x={x + bw / 2} y={H - 6} textAnchor="middle" className="xl">{xLabel(labels[i]).split(' ').pop()!.slice(0, 3)}</text>}
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

/** Frost-free season per year: a bar from the last spring frost to the first autumn frost (day of year). */
export function FrostRange({ data, fmtDoy, labels }: { data: { y: number; last: number | null; first: number | null }[]; fmtDoy: (d: number) => string; labels: { last: string; first: string; title: string } }) {
  const [hover, setHover] = useState<number | null>(null)
  const vals = data.flatMap((d) => [d.last, d.first]).filter((v): v is number => v !== null)
  const lo = Math.max(1, Math.min(...vals) - 10)
  const hi = Math.min(366, Math.max(...vals) + 10)
  const y = (v: number) => PAD.t + ((v - lo) / (hi - lo)) * ih // later dates lower
  const bw = iw / Math.max(1, data.length)
  const h = hover !== null ? data[hover] : null
  return (
    <figure className="chart">
      <Readout text={h ? `${h.y}: ${labels.last} ${h.last ? fmtDoy(h.last) : '—'} · ${labels.first} ${h.first ? fmtDoy(h.first) : '—'}` : null} hint={labels.title} />
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={labels.title} onPointerLeave={() => setHover(null)}>
        <g className="ax">
          {ticks(lo, hi, 4).map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="grid" />
              <text x={PAD.l - 4} y={y(v) + 3} textAnchor="end">{fmtDoy(v).split(' ')[0]}</text>
            </g>
          ))}
        </g>
        {data.map((d, i) => {
          const x = PAD.l + i * bw + bw / 2
          return (
            <g key={d.y} onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)}>
              <rect x={x - bw / 2} y={PAD.t} width={bw} height={ih} fill="transparent" />
              {d.last !== null && d.first !== null && <line x1={x} x2={x} y1={y(d.last)} y2={y(d.first)} className="range" data-on={hover === i} />}
              {d.last !== null && <circle cx={x} cy={y(d.last)} r={2.5} className="dot cool" />}
              {d.first !== null && <circle cx={x} cy={y(d.first)} r={2.5} className="dot warmdot" />}
              {(i === 0 || i === data.length - 1 || d.y % 5 === 0) && <text x={x} y={H - 6} textAnchor="middle" className="xl">{d.y}</text>}
            </g>
          )
        })}
      </svg>
      <ul className="legend">
        <li><i className="sw cool" />{labels.last}</li>
        <li><i className="sw warmdot" />{labels.first}</li>
      </ul>
    </figure>
  )
}

export function StatTiles({ items }: { items: { label: string; value: string; note?: ReactNode }[] }) {
  return (
    <dl className="stattiles">
      {items.map((it) => (
        <div key={it.label}><dt>{it.label}</dt><dd>{it.value}</dd>{it.note}</div>
      ))}
    </dl>
  )
}
