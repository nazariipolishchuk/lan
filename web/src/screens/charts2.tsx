// Evidence charts, second edition (P4 redesign; N: "the charts do not say what they show, no units, no steps").
// Every chart states: what is plotted (axis title with unit), regular labelled steps on both axes, the
// reference it is compared with, and direct labels on the marks instead of a separate legend box.
// Colours: gold = this field / this season; frost = the usual range of the same field or cell; warn = over
// a threshold. Hover or tap shows the exact value in the readout line above the chart.
import { useState } from 'react'

const W = 380

function niceTicks(lo: number, hi: number, n = 5): number[] {
  const span = hi - lo || 1
  const raw = span / n
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const out: number[] = []
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000 || 0)
  return out
}

interface Frame { l: number; r: number; t: number; b: number; h: number }

function Axes({ f, yTicks, y, yFmt, yTitle, xTicks }: {
  f: Frame; yTicks: number[]; y: (v: number) => number; yFmt: (v: number) => string; yTitle: string
  xTicks: { x: number; label: string; major?: boolean }[]
}) {
  return (
    <g className="ax2">
      <text className="ax2-title" x={f.l - 30} y={f.t - 10}>{yTitle}</text>
      {yTicks.map((v) => (
        <g key={v}>
          <line className="ax2-grid" x1={f.l} x2={W - f.r} y1={y(v)} y2={y(v)} />
          <text className="ax2-y" x={f.l - 6} y={y(v) + 3.5} textAnchor="end">{yFmt(v)}</text>
        </g>
      ))}
      <line className="ax2-base" x1={f.l} x2={W - f.r} y1={f.h - f.b} y2={f.h - f.b} />
      {xTicks.map((tk, i) => (
        <g key={i}>
          <line className={tk.major ? 'ax2-tick major' : 'ax2-tick'} x1={tk.x} x2={tk.x} y1={f.h - f.b} y2={f.h - f.b + (tk.major ? 5 : 3)} />
          {tk.label && <text className="ax2-x" x={tk.x} y={f.h - f.b + 16} textAnchor="middle">{tk.label}</text>}
        </g>
      ))}
    </g>
  )
}

/** Greenness through the season: this year against the field's own usual range, with the bare-soil line. */
export function GreennessChart({ dekads, current, band, year, yearsN, monthLabel, labels, fmt }: {
  dekads: number[]; current: (number | null)[]; band: ([number, number] | null)[]; year: number; yearsN: number
  monthLabel: (m: number) => string; fmt: (v: number) => string
  labels: { yTitle: string; bare: string; range: string; readout: string; peak: string }
}) {
  const f: Frame = { l: 38, r: 64, t: 26, b: 26, h: 230 }
  const [hover, setHover] = useState<number | null>(null)
  const d0 = dekads[0]
  const d1 = dekads[dekads.length - 1]
  const x = (d: number) => f.l + ((d - d0) / (d1 - d0)) * (W - f.l - f.r)
  const lo = 0
  const hi = 0.9
  const y = (v: number) => f.t + (1 - (v - lo) / (hi - lo)) * (f.h - f.t - f.b)
  const pts = dekads.map((d, i) => [d, current[i]] as const).filter((p): p is readonly [number, number] => p[1] !== null)
  const line = pts.map(([d, v], i) => `${i ? 'L' : 'M'}${x(d).toFixed(1)} ${y(v).toFixed(1)}`).join('')
  const top: string[] = []
  const bot: string[] = []
  dekads.forEach((d, i) => {
    const b = band[i]
    if (b) {
      top.push(`${x(d).toFixed(1)} ${y(b[1]).toFixed(1)}`)
      bot.unshift(`${x(d).toFixed(1)} ${y(b[0]).toFixed(1)}`)
    }
  })
  const peak = pts.reduce((a, b) => (b[1] > a[1] ? b : a), pts[0] ?? [d0, 0])
  const last = pts[pts.length - 1]
  const xTicks = dekads.filter((d) => d % 3 === 0).map((d) => ({ x: x(d), label: monthLabel(Math.floor(d / 3)), major: true }))
  const h = hover !== null ? hover : null
  const bandTop = band.reduce((a, b, i) => (b && (a < 0 || b[1] > band[a]![1]) ? i : a), -1)
  return (
    <figure className="chart2">
      <p className="readout" aria-live="polite">{h !== null ? labels.readout
        .replace('{when}', `${monthLabel(Math.floor(dekads[h] / 3))} ${(dekads[h] % 3) * 10 + 1}–${(dekads[h] % 3) * 10 + 10}`)
        .replace('{v}', current[h] === null ? '—' : fmt(current[h]!))
        .replace('{lo}', band[h] ? fmt(band[h]![0]) : '—').replace('{hi}', band[h] ? fmt(band[h]![1]) : '—') : ' '}</p>
      <svg viewBox={`0 0 ${W} ${f.h}`} role="img" aria-label={labels.yTitle} onPointerLeave={() => setHover(null)}>
        <rect className="bare-zone" x={f.l} y={y(0.25)} width={W - f.l - f.r} height={y(0) - y(0.25)} />
        <text className="zone-label" x={f.l + 4} y={y(0.25) + 11}>{labels.bare}</text>
        <Axes f={f} yTicks={niceTicks(lo, hi, 4)} y={y} yFmt={fmt} yTitle={labels.yTitle} xTicks={xTicks} />
        {top.length > 1 && <path className="range" d={`M${top.join('L')}L${bot.join('L')}Z`} />}
        {bandTop >= 0 && (
          <text className="direct frost label-bg" x={x(dekads[bandTop])} y={y((band[bandTop]![0] + band[bandTop]![1]) / 2) + 4} textAnchor="middle">{labels.range.replace('{n}', String(yearsN))}</text>
        )}
        <path className="cur" d={line} />
        {pts.length > 0 && (
          <>
            <circle className="cur-dot" cx={x(peak[0])} cy={y(peak[1])} r="3.2" />
            <text className="direct gold label-bg" x={x(peak[0]) + 7} y={y(peak[1]) - 4}>{labels.peak.replace('{v}', fmt(peak[1]))}</text>
            <text className="direct gold strong" x={x(last[0]) + 6} y={y(last[1]) + 4}>{year}</text>
          </>
        )}
        {h !== null && <line className="hover-line" x1={x(dekads[h])} x2={x(dekads[h])} y1={f.t} y2={f.h - f.b} />}
        {dekads.map((d, i) => (
          <rect key={d} x={x(d) - (W - f.l - f.r) / dekads.length / 2} y={f.t} width={(W - f.l - f.r) / dekads.length} height={f.h - f.t - f.b}
            fill="transparent" onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)} />
        ))}
      </svg>
    </figure>
  )
}

/** Days per year at or above a temperature, with the earlier and recent averages drawn and labelled. */
export function DaysBarChart({ rows, split, labels }: {
  rows: { y: number; v: number }[]; split: number
  labels: { yTitle: string; early: string; recent: string; readout: string }
}) {
  const f: Frame = { l: 38, r: 10, t: 26, b: 26, h: 220 }
  const [hover, setHover] = useState<number | null>(null)
  const hi = Math.max(10, ...rows.map((r) => r.v)) * 1.08
  const ticks = niceTicks(0, hi, 4)
  const top = ticks[ticks.length - 1]
  const y = (v: number) => f.t + (1 - v / top) * (f.h - f.t - f.b)
  const bw = (W - f.l - f.r) / rows.length
  const x = (i: number) => f.l + i * bw
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
  const early = rows.filter((r) => r.y < split)
  const recent = rows.filter((r) => r.y >= split)
  const ea = avg(early.map((r) => r.v))
  const ra = avg(recent.map((r) => r.v))
  const xTicks = rows.map((r, i) => ({ x: x(i) + bw / 2, label: r.y % 5 === 0 ? String(r.y) : '', major: r.y % 5 === 0 }))
  const h = hover !== null ? rows[hover] : null
  return (
    <figure className="chart2">
      <p className="readout" aria-live="polite">{h ? labels.readout.replace('{y}', String(h.y)).replace('{v}', String(Math.round(h.v))) : ' '}</p>
      <svg viewBox={`0 0 ${W} ${f.h}`} role="img" aria-label={labels.yTitle} onPointerLeave={() => setHover(null)}>
        <Axes f={f} yTicks={ticks} y={y} yFmt={(v) => String(v)} yTitle={labels.yTitle} xTicks={xTicks} />
        {rows.map((r, i) => (
          <rect key={r.y} className={r.y >= split ? 'bar recent' : 'bar'} x={x(i) + 1} y={y(r.v)} width={Math.max(1, bw - 2)} height={y(0) - y(r.v)}
            data-on={hover === i} onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)} />
        ))}
        {early.length > 0 && (
          <>
            <line className="avg frost" x1={x(0)} x2={x(early.length)} y1={y(ea)} y2={y(ea)} />
            <text className="direct frost label-bg" x={x(0) + 4} y={y(ea) - 6}>{labels.early.replace('{v}', String(Math.round(ea))).replace('{a}', `${early[0].y}–${early[early.length - 1].y}`)}</text>
          </>
        )}
        {recent.length > 0 && (
          <>
            <line className="avg gold" x1={x(early.length)} x2={x(rows.length)} y1={y(ra)} y2={y(ra)} />
            <text className="direct gold strong" x={x(rows.length)} y={y(Math.max(...recent.map((r) => r.v))) - 6} textAnchor="end">{labels.recent.replace('{v}', String(Math.round(ra))).replace('{b}', `${recent[0].y}–${recent[recent.length - 1].y}`)}</text>
          </>
        )}
      </svg>
    </figure>
  )
}

/** Frost-free season per year as a bar from the last spring frost to the first autumn frost, on a month axis. */
export function FrostSeasonChart({ rows, monthLabel, fmtDoy, labels }: {
  rows: { y: number; last: number | null; first: number | null }[]
  monthLabel: (m: number) => string; fmtDoy: (doy: number) => string
  labels: { title: string; last: string; first: string; readout: string; median: string }
}) {
  const rowH = 5.2
  const f: Frame = { l: 40, r: 14, t: 34, b: 26, h: 34 + rows.length * rowH + 26 }
  const [hover, setHover] = useState<number | null>(null)
  const d0 = 60 // 1 Mar
  const d1 = 335 // 1 Dec
  const x = (doy: number) => f.l + ((doy - d0) / (d1 - d0)) * (W - f.l - f.r)
  const yRow = (i: number) => f.t + i * rowH
  const monthStarts = [60, 91, 121, 152, 182, 213, 244, 274, 305, 335]
  const med = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b)
    return s.length ? s[Math.floor(s.length / 2)] : null
  }
  const mLast = med(rows.map((r) => r.last).filter((v): v is number => v !== null))
  const mFirst = med(rows.map((r) => r.first).filter((v): v is number => v !== null))
  const h = hover !== null ? rows[hover] : null
  return (
    <figure className="chart2">
      <p className="readout" aria-live="polite">{h ? labels.readout.replace('{y}', String(h.y))
        .replace('{a}', h.last ? fmtDoy(h.last) : '—').replace('{b}', h.first ? fmtDoy(h.first) : '—')
        .replace('{n}', h.last && h.first ? String(h.first - h.last) : '—') : ' '}</p>
      <svg viewBox={`0 0 ${W} ${f.h}`} role="img" aria-label={labels.title} onPointerLeave={() => setHover(null)}>
        <text className="ax2-title" x={f.l - 32} y={f.t - 18}>{labels.title}</text>
        {monthStarts.map((d, i) => (
          <g key={d}>
            <line className="ax2-grid" x1={x(d)} x2={x(d)} y1={f.t - 4} y2={f.h - f.b} />
            {i < monthStarts.length - 1 && <text className="ax2-x" x={(x(d) + x(monthStarts[i + 1])) / 2} y={f.h - f.b + 16} textAnchor="middle">{monthLabel(2 + i)}</text>}
          </g>
        ))}
        {rows.map((r, i) => (
          <g key={r.y} onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)}>
            <rect x={f.l} y={yRow(i) - 1} width={W - f.l - f.r} height={rowH} fill="transparent" />
            {r.last !== null && r.first !== null && <line className="season" data-on={hover === i} x1={x(r.last)} x2={x(r.first)} y1={yRow(i) + rowH / 2 - 1} y2={yRow(i) + rowH / 2 - 1} />}
            {r.y % 5 === 0 && <text className="ax2-y" x={f.l - 6} y={yRow(i) + rowH / 2 + 2} textAnchor="end">{r.y}</text>}
          </g>
        ))}
        {mLast !== null && (
          <>
            <line className="avg frost" x1={x(mLast)} x2={x(mLast)} y1={f.t - 4} y2={f.h - f.b} />
            <text className="direct frost" x={x(mLast) - 4} y={f.t - 8} textAnchor="end">{labels.last.replace('{d}', fmtDoy(mLast))}</text>
          </>
        )}
        {mFirst !== null && (
          <>
            <line className="avg frost" x1={x(mFirst)} x2={x(mFirst)} y1={f.t - 4} y2={f.h - f.b} />
            <text className="direct frost" x={x(mFirst) + 4} y={f.t - 8}>{labels.first.replace('{d}', fmtDoy(mFirst))}</text>
          </>
        )}
      </svg>
    </figure>
  )
}
