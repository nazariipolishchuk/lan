// Design board (#/design, development only): the redesign proposals on the demo field's real data,
// shown side by side so N can choose before they replace the live components.
import { completeYears, lastCompleteYear, DEFAULT_WEIGHTS, type Bars } from '../engine/score'
import type { CropId } from '../engine/types'
import { useT } from '../i18n'
import { useStore } from '../state/store'
import { DaysBarChart, FrostSeasonChart, GreennessChart } from './charts2'
import { useCard, useFieldData, type Loaded } from './common'
import { CROP_ICON_IDS, CropIcon, GroupIcon } from './CropIcon'
import { DEMO_FIELD } from './Intro'
import { decodeCurves, loadCurves } from '../data/loader'
import { useEffect, useState } from 'react'
import type { CardModel, Candidate } from '../engine/card'

const BARS: (keyof Bars)[] = ['water', 'heat', 'soil', 'disease']

export function DesignBoard() {
  const { status } = useFieldData(DEMO_FIELD)
  const lang = useStore((s) => s.lang)
  if (status.kind !== 'ok') return <div className="board"><p>{status.kind}</p></div>
  return <Board data={status.data} lang={lang} />
}

function Board({ data, lang }: { data: Loaded; lang: 'en' | 'uk' }) {
  const card = useCard(data)
  const name = (id: string) => data.crops.crops.find((c) => c.id === id)?.name[lang] ?? id
  const colour = (id: string) => data.crops.crops.find((c) => c.id === id)?.colour ?? '#ccc'
  return (
    <div className="board">
      <h1>Lan · redesign proposals</h1>
      <p className="board-note">Demo field {DEMO_FIELD}, real data. Choose one variant per block.</p>

      <section>
        <h2>1. Crop pictograms (line, field-guide style)</h2>
        <div className="icon-grid">
          {CROP_ICON_IDS.map((id) => (
            <figure key={id} style={{ color: colour(id) }}>
              <CropIcon id={id} size={56} />
              <figcaption>{name(id)}</figcaption>
            </figure>
          ))}
          <figure><GroupIcon group="winter" size={56} /><figcaption>{lang === 'uk' ? 'озимі (невідомо, що саме)' : 'winter crop (unconfirmed)'}</figcaption></figure>
          <figure><GroupIcon group="summer" size={56} /><figcaption>{lang === 'uk' ? 'ярі (невідомо, що саме)' : 'summer crop (unconfirmed)'}</figcaption></figure>
        </div>
        <p className="board-note">At text size:</p>
        <p className="icon-line">
          {CROP_ICON_IDS.map((id) => <span key={id} style={{ color: colour(id) }}><CropIcon id={id} size={20} /> {name(id)}</span>)}
        </p>
        <div className="icon-grid light">
          {CROP_ICON_IDS.slice(0, 7).map((id) => <figure key={id}><CropIcon id={id} size={40} /><figcaption>{name(id)}</figcaption></figure>)}
        </div>
      </section>

      <section>
        <h2>2. Sow next</h2>
        <div className="variants">
          <div><h3>A1 · ledger with four bars</h3><SowA1 card={card} name={name} colour={colour} lang={lang} /></div>
          <div><h3>A2 · one stacked bar per crop</h3><SowA2 card={card} name={name} colour={colour} lang={lang} /></div>
        </div>
      </section>

      <section>
        <h2>3. Evidence charts</h2>
        <div className="variants">
          <div className="chart-panel"><GreenBoard data={data} lang={lang} /></div>
          <div className="chart-panel"><HeatBoard data={data} lang={lang} /></div>
        </div>
      </section>
    </div>
  )
}

/**
 * One plain line on why a crop ranks where it does: a good predecessor or combo first; otherwise its
 * strongest and weakest bar compared with the other candidates (a bar every crop shares says nothing).
 */
function reason(c: Candidate, card: CardModel, name: (id: string) => string, lang: 'en' | 'uk'): { text: string; tone: 'go' | 'warn' | 'muted' } {
  const prev = [...card.seasons].reverse().find((s) => s.y === card.target - 1)
  const bn: Record<keyof Bars, [string, string]> = { water: ['water', 'вода'], heat: ['heat', 'спека'], soil: ['soil', 'ґрунт'], disease: ['disease', 'хвороби'] }
  const L = lang === 'uk' ? 1 : 0
  if (c.effect > 0 && prev?.crop) return { text: L ? `Добрий попередник: після «${name(prev.crop).toLowerCase()}» +${c.effect}` : `Good after ${name(prev.crop).toLowerCase()}: +${c.effect}`, tone: 'go' }
  const all = card.sowNext
  const mean = (b: keyof Bars) => all.reduce((a, x) => a + x.bars[b], 0) / Math.max(1, all.length)
  const dev = BARS.map((b) => ({ b, d: c.bars[b] - mean(b), v: Math.round(c.bars[b]) }))
  const best = dev.reduce((a, x) => (x.d > a.d ? x : a))
  const worst = dev.reduce((a, x) => (x.d < a.d ? x : a))
  const parts: string[] = []
  if (best.d > 3) parts.push(L ? `краще за інших: ${bn[best.b][1]} ${best.v}` : `better than the rest: ${bn[best.b][0]} ${best.v}`)
  if (worst.d < -3) parts.push(L ? `гірше: ${bn[worst.b][1]} ${worst.v}` : `worse: ${bn[worst.b][0]} ${worst.v}`)
  if (parts.length) return { text: parts.join('; ').replace(/^./, (ch) => ch.toUpperCase()), tone: worst.d < -10 && best.d < 5 ? 'warn' : 'go' }
  return { text: L ? 'Без помітних відмінностей від інших' : 'No clear difference from the rest', tone: 'muted' }
}

function SowA1({ card, name, colour, lang }: { card: CardModel; name: (id: string) => string; colour: (id: string) => string; lang: 'en' | 'uk' }) {
  const t = useT()
  return (
    <table className="ledger">
      <thead>
        <tr><th scope="col">{lang === 'uk' ? 'Культура' : 'Crop'}</th><th scope="col" className="num">{lang === 'uk' ? 'Бал' : 'Score'}</th>
          {BARS.map((b) => <th key={b} scope="col" className="barh">{t(`bar.${b}` as never)}</th>)}</tr>
      </thead>
      <tbody>
        {card.sowNext.map((c) => {
          const r = reason(c, card, name, lang)
          return (
            <tr key={c.crop.id}>
              <th scope="row">
                <span className="ledger-crop" style={{ color: colour(c.crop.id) }}><CropIcon id={c.crop.id as CropId} size={22} /></span>
                <span className="ledger-name">{name(c.crop.id)}</span>
                <span className={`ledger-why ${r.tone}`}>{r.text}</span>
              </th>
              <td className="num"><b>{Math.round(c.score)}</b></td>
              {BARS.map((b) => (
                <td key={b} className="barcell" title={`${t(`bar.${b}` as never)}: ${Math.round(c.bars[b])}`}>
                  <span className="minibar"><i style={{ width: `${c.bars[b]}%` }} data-low={c.bars[b] < 50} /></span>
                </td>
              ))}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function SowA2({ card, name, colour, lang }: { card: CardModel; name: (id: string) => string; colour: (id: string) => string; lang: 'en' | 'uk' }) {
  const t = useT()
  return (
    <div className="ladder">
      <p className="ladder-key">{BARS.map((b) => <span key={b}><i className={`seg-${b}`} />{t(`bar.${b}` as never)}</span>)}</p>
      <ol>
        {card.sowNext.map((c) => {
          const r = reason(c, card, name, lang)
          return (
            <li key={c.crop.id}>
              <span className="ladder-icon" style={{ color: colour(c.crop.id) }}><CropIcon id={c.crop.id as CropId} size={26} /></span>
              <span className="ladder-main">
                <span className="ladder-top"><b>{name(c.crop.id)}</b><span className="ladder-score">{Math.round(c.score)}</span></span>
                <span className="stack">
                  {BARS.map((b) => <i key={b} className={`seg-${b}`} style={{ width: `${c.bars[b] * DEFAULT_WEIGHTS[b]}%` }} title={`${t(`bar.${b}` as never)} ${Math.round(c.bars[b])}`} />)}
                </span>
                <span className={`ladder-why ${r.tone}`}>{r.text}</span>
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

const MONTHS: Record<'en' | 'uk', string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  uk: ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'],
}

function GreenBoard({ data, lang }: { data: Loaded; lang: 'en' | 'uk' }) {
  const [curves, setCurves] = useState<{ y: number; v: (number | null)[] }[] | null>(null)
  useEffect(() => {
    loadCurves(data.field.id).then((ch) => setCurves(ch ? decodeCurves(ch, data.field.id) : null))
  }, [data.field.id])
  if (!curves) return <p>…</p>
  const dekads = Array.from({ length: 27 }, (_, i) => i + 6)
  const withData = curves.filter((c) => c.v.some((v) => v !== null))
  const cur = withData[withData.length - 1]
  const earlier = withData.filter((c) => c.y < cur.y)
  const q = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))] }
  const band = dekads.map((d) => { const vs = earlier.map((c) => c.v[d]).filter((v): v is number => v !== null); return vs.length >= 3 ? [q(vs, 0.25), q(vs, 0.75)] as [number, number] : null })
  const fmt = (v: number) => v.toLocaleString(lang === 'uk' ? 'uk-UA' : 'en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 2 })
  return (
    <>
      <h3>{lang === 'uk' ? `Як зеленіло поле у ${cur.y}` : `How green the field was in ${cur.y}`}</h3>
      <p className="caption">{lang === 'uk' ? 'Зеленість — частка зеленого листя, яку бачить супутник: 0 — голий ґрунт, 0,8 — густий посів.' : 'Greenness is the share of green leaf a satellite sees: 0 = bare soil, 0.8 = a dense crop.'}</p>
      <GreennessChart dekads={dekads} current={dekads.map((d) => cur.v[d])} band={band} year={cur.y} yearsN={earlier.length}
        monthLabel={(m) => MONTHS[lang][m]} fmt={fmt}
        labels={lang === 'uk'
          ? { yTitle: 'Зеленість (NDVI, 0–1)', bare: 'голий ґрунт, нижче 0,25', range: 'звично для поля ({n} сезонів)', readout: '{when}: {v} (звично {lo}–{hi})', peak: 'пік {v}' }
          : { yTitle: 'Greenness (NDVI, 0–1)', bare: 'bare soil, below 0.25', range: 'usual for this field ({n} seasons)', readout: '{when}: {v} (usual {lo}–{hi})', peak: 'peak {v}' }} />
      <p className="src">NASA HLS (Landsat + Sentinel-2), 30 m, {lang === 'uk' ? 'одне значення на 10 днів' : 'one value per 10 days'}.</p>
    </>
  )
}

function HeatBoard({ data, lang }: { data: Loaded; lang: 'en' | 'uk' }) {
  const today = useStore((s) => s.today)
  const { cell } = data
  const years = completeYears(cell, lastCompleteYear(cell, today))
  const rows = years.map((y) => {
    const yr = cell.years.find((x) => x.y === y)!
    return { y, v: yr.hot30.reduce((a: number, b) => a + (b ?? 0), 0), last: yr.lastSpringFrostDoy, first: yr.firstAutumnFrostDoy }
  })
  const split = years[years.length - 1] - 9
  const fmtDoy = (d: number) => new Date(2021, 0, d).toLocaleDateString(lang === 'uk' ? 'uk-UA' : 'en-GB', { day: 'numeric', month: 'short' })
  return (
    <>
      <h3>{lang === 'uk' ? 'Скільки спекотних днів на рік' : 'How many hot days a year'}</h3>
      <p className="caption">{lang === 'uk' ? 'Днів, коли максимум сягав 30 °C і вище, за кожен рік.' : 'Days when the maximum reached 30 °C or more, each year.'}</p>
      <DaysBarChart rows={rows.map((r) => ({ y: r.y, v: r.v }))} split={split}
        labels={lang === 'uk'
          ? { yTitle: 'Днів за рік ≥ 30 °C', early: '{v} днів у {a}', recent: '{v} днів у {b}', readout: '{y}: {v} днів ≥ 30 °C' }
          : { yTitle: 'Days a year ≥ 30 °C', early: '{v} days in {a}', recent: '{v} days in {b}', readout: '{y}: {v} days ≥ 30 °C' }} />
      <h3>{lang === 'uk' ? 'Безморозний період' : 'Frost-free season'}</h3>
      <p className="caption">{lang === 'uk' ? 'Кожен рядок — рік: від останнього весняного до першого осіннього заморозку (мінімум нижче 0 °C).' : 'Each row is a year: from the last spring frost to the first autumn frost (minimum below 0 °C).'}</p>
      <FrostSeasonChart rows={rows.map((r) => ({ y: r.y, last: r.last, first: r.first }))} monthLabel={(m) => MONTHS[lang][m]} fmtDoy={fmtDoy}
        labels={lang === 'uk'
          ? { title: '', last: 'зазвичай до {d}', first: 'зазвичай з {d}', readout: '{y}: без заморозків з {a} до {b} ({n} днів)', median: '' }
          : { title: '', last: 'usually until {d}', first: 'usually from {d}', readout: '{y}: frost-free from {a} to {b} ({n} days)', median: '' }} />
      <p className="src">NASA POWER, {lang === 'uk' ? 'щоденна температура, клітинка близько 50 км' : 'daily temperature, a cell of about 50 km'}.</p>
    </>
  )
}
