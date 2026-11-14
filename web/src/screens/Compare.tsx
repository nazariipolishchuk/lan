// S5 Compare rotations (PLAN §5.6): lanes on a month scale, combo links, stat bars, five-item details,
// and the editable "My plan" with instant re-scoring.
//
// Layout rules (fixed after the first review): the timeline holds only pictures (tiles, cover strips,
// link markers) in three separate rows so nothing overlaps; every control (pickers, chips, buttons)
// lives in normal page flow below it. The scale fits the screen on desktop; on a phone each lane's
// timeline scrolls sideways and opens at the plan.
import { CropIcon, GroupIcon } from './CropIcon'
import { Fragment, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { cropCalendar, dekadOf, sowingOpen } from '../engine/calendar'
import type { CardModel } from '../engine/card'
import type { ComboHit } from '../engine/combos'
import { pairCombos } from '../engine/combos'
import { Info } from './Info'
import { explain, type Explanation } from '../engine/explain'
import { blockReason } from '../engine/prefs'
import { checkRepeat, checkReturn, type Season } from '../engine/precursors'
import { scorePlan, withPlan, type PlanScore, type PlanSlot } from '../engine/score'
import { coverFits, suggestRotations, type Strategy } from '../engine/strategies'
import type { CropDef, CropId } from '../engine/types'
import { useT, type Key } from '../i18n'
import { setPlanSlot, type MySlot } from '../state/persist'
import { useStore } from '../state/store'
import { CROP_ORDER, ScenarioSwitch, StatBars, useCard, useCropName, useFieldData, useMsg, useSourceName, type Loaded } from './common'
import { CropDetail } from './CropDetail'

const PAST = 2 // past seasons shown before the plan
const DK_MIN = 7 // pixels per dekad below which the timeline scrolls instead of shrinking
const DK_MAX = 11
const PAD = 8 // inner padding of the timeline, px

export function Compare({ id }: { id: string }) {
  const t = useT()
  const { status, retry } = useFieldData(id)
  const setCompare = useStore((s) => s.setCompare)
  return (
    <section className="compare" aria-label={t('cmp.title')}>
      {status.kind === 'loading' && <div className="card-state" aria-busy="true"><span className="pulse" /></div>}
      {status.kind === 'missing' && <p className="card-state">{t('card.notFound')}</p>}
      {status.kind === 'error' && (
        <div className="card-state">
          <p>{t('card.loadError')}</p>
          <button type="button" className="btn" onClick={retry}>{t('card.retry')}</button>
        </div>
      )}
      {status.kind === 'ok' && <CompareBody data={status.data} />}
      {status.kind !== 'ok' && <button type="button" className="btn ghost" onClick={() => setCompare(false)}>{t('cmp.back')}</button>}
    </section>
  )
}

type LaneId = Strategy['id'] | 'mine'

/** Horizontal scale shared by every lane: absolute dekads (year × 36 + dekad) → pixels. */
interface Scale {
  start: number
  end: number
  dk: number
  width: number
  planFrom: number
  /** x of today's date: the line between past and plan */
  todayX: number
  years: number[]
  x: (y: number, d: number) => number
}

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    setW(el.clientWidth)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

function CompareBody({ data }: { data: Loaded }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const today = useStore((s) => s.today)
  const setCompare = useStore((s) => s.setCompare)
  const openPanel = useStore((s) => s.openPanel)
  const unsafe = useStore((s) => !!s.user.unsafe[data.field.id])
  const card = useCard(data)
  const { field, crops, cell } = data
  const history = card.seasons
  const strategies = useMemo(() => (unsafe ? [] : suggestRotations(history, card.ctx)), [history, card.ctx, unsafe])
  const mine = useMyPlan(data, card)
  const [detail, setDetail] = useState<{ crop: CropId; year: number } | null>(null)
  const [ref, avail] = useWidth<HTMLDivElement>()
  const nf = (v: number) => v.toLocaleString(lang === 'uk' ? 'uk-UA' : 'en-GB', { maximumFractionDigits: 1 })

  const planYears = card.slots.map((s) => s.y)
  const y0 = planYears[0] - PAST
  const yLast = planYears[planYears.length - 1]
  const scale = useMemo<Scale>(() => {
    const start = (y0 - 1) * 36 + 24 // early September before the first past season
    const end = yLast * 36 + 31 // early November of the last planned season
    const inner = Math.max(0, avail - 2 * PAD - 6) // lane borders and rounding
    const dk = Math.min(DK_MAX, Math.max(DK_MIN, Math.floor((inner / (end - start)) * 20) / 20))
    const years: number[] = []
    for (let y = y0; y <= yLast; y++) years.push(y)
    const x = (y: number, d: number) => PAD + (y * 36 + d - start) * dk
    const td = dekadOf(today)
    const width = (end - start) * dk + 2 * PAD
    return { start, end, dk, width, planFrom: planYears[0], todayX: Math.min(width - PAD, Math.max(PAD, x(td.year, td.dekad))), years, x }
  }, [avail, y0, yLast, planYears, today])
  const past = history.filter((s) => s.y >= y0 && s.y < planYears[0])

  return (
    <div className="cmp" ref={ref}>
      <header className="cmp-head">
        <div className="cmp-titlerow">
          <button type="button" className="back-btn" onClick={() => setCompare(false)} aria-label={t('cmp.back')}>←</button>
          <h2 className="cmp-title">{t('cmp.title')} <span className="muted">· {nf(field.ha)} {t('card.ha')}</span> <Info k="info.compare" /></h2>
        </div>
        <div className="cmp-controls">
          <ScenarioSwitch cell={cell} />
          <button type="button" className="btn ghost small-btn" onClick={() => { setCompare(false); openPanel({ kind: 'priorities' }) }}>⚙ {t('card.priorities')}</button>
        </div>
        <p className="muted small cmp-note">{t('cmp.scaleNote')}</p>
      </header>
      {unsafe ? <p className="note">{t('card.unsafeNote')}</p> : avail > 0 && (
        <div className="lanes" data-tour="lanes">
          {strategies.map((s) => (
            <Lane key={s.id} lane={s.id} score={s.score} strategy={s} history={history} past={past} data={data} scale={scale}
              onTile={(crop, year) => setDetail({ crop, year })} />
          ))}
          <Lane lane="mine" score={mine.score} history={history} past={past} data={data} scale={scale}
            onTile={(crop, year) => setDetail({ crop, year })}>
            <MyPicker mine={mine} data={data} history={history} fillFrom={strategies.find((s) => s.id === 'balanced')?.score.slots} />
          </Lane>
        </div>
      )}
      {detail && (
        <div className="drawer" role="dialog" aria-modal="false" aria-label={crops.crops.find((c) => c.id === detail.crop)?.name[lang]}>
          <CropDetail data={data} card={card} crop={detail.crop} year={detail.year} onClose={() => setDetail(null)}
            planned={planContext(detail.year, strategies, mine.score)} />
        </div>
      )}
    </div>
  )
}

/** The plan a tapped tile belongs to, for its predecessor in S6. */
function planContext(year: number, strategies: Strategy[], mine: PlanScore | null): PlanSlot[] {
  for (const p of [...strategies.map((s) => s.score), mine]) if (p?.slots.some((s) => s.y === year)) return p.slots
  return []
}

interface MyPlan {
  slots: { y: number; locked: boolean; value: MySlot | null }[]
  score: PlanScore | null
  set: (y: number, v: MySlot | null) => void
  clear: () => void
  fill: (from: PlanSlot[]) => void
}

function useMyPlan(data: Loaded, card: CardModel): MyPlan {
  const id = data.field.id
  const stored = useStore((s) => s.user.plans[id])
  const updateUser = useStore((s) => s.updateUser)
  const lockedCrop = card.seasons.find((s) => s.y === card.slots[0]?.y && s.farmer && s.crop)?.crop ?? 'w_wheat'
  const slots = card.slots.map((s) => ({
    y: s.y, locked: !!s.locked, value: s.locked ? { crop: lockedCrop } : stored?.[s.y] ?? null,
  }))
  const chosen: PlanSlot[] = slots.filter((s) => s.value?.crop).map((s) => ({ y: s.y, crop: s.value!.crop!, locked: s.locked, cover: s.value!.cover }))
  const key = JSON.stringify(chosen)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const score = useMemo(() => (chosen.some((s) => !s.locked) ? scorePlan(chosen, card.seasons, card.ctx) : null), [key, card.seasons, card.ctx])
  return {
    slots,
    score,
    set: (y, v) => updateUser((d) => setPlanSlot(d, id, y, v)),
    clear: () => updateUser((d) => card.slots.reduce((acc, s) => setPlanSlot(acc, id, s.y, null), d)),
    fill: (from) => updateUser((d) => from.filter((s) => !s.locked).reduce((acc, s) => setPlanSlot(acc, id, s.y, { crop: s.crop, cover: s.cover }), d)),
  }
}

interface LaneProps {
  lane: LaneId
  score: PlanScore | null
  strategy?: Strategy
  history: Season[]
  past: Season[]
  data: Loaded
  scale: Scale
  onTile: (crop: CropId, year: number) => void
  children?: React.ReactNode
}

const GROUP_CAL: Record<string, CropId> = { winter: 'w_wheat', summer: 'maize', uncultivated: 's_barley' }

interface TileBox { y: number; from: number; to: number }

function Lane({ lane, score, strategy, history, past, data, scale, onTile, children }: LaneProps) {
  const t = useT()
  const msg = useMsg(data.crops)
  const name = useCropName(data.crops)
  const source = useSourceName()
  const [open, setOpen] = useState(false)
  const [chip, setChip] = useState<string | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const { crops, cell, field } = data
  const def = (id: CropId) => crops.crops.find((c) => c.id === id)!
  const short = (id: CropId) => t(`crop.short.${id}` as Key)
  const { x } = scale

  // open at the plan when the timeline is wider than the screen (phones)
  useLayoutEffect(() => {
    const el = scroller.current
    if (el && el.scrollWidth > el.clientWidth + 1) el.scrollLeft = Math.max(0, scale.todayX - 120)
  }, [scale])

  const span = (y: number, crop: CropId | null) => {
    const cal = crop ? cropCalendar(def(crop), cell) : null
    return cal ? { from: x(y, cal.sow.start), to: x(y, cal.harvest.end + 1) } : { from: x(y, 9), to: x(y, 27) }
  }

  const pastTiles = past.map((s) => {
    const cid = s.crop ?? (s.group ? GROUP_CAL[s.group] : null)
    const label = s.crop ? short(s.crop) : s.group ? t(`hist.group.${s.group}` as Key) : t('card.unknownSeason')
    const full = s.crop ? name(s.crop) : label
    return { y: s.y, ...span(s.y, cid), label, full, crop: s.crop ? def(s.crop) : null, known: s.known, group: s.group }
  })
  const slots = score?.slots ?? []
  const planTiles = slots.map((sl) => {
    const c = def(sl.crop)
    const ts = score!.tiles.find((tt) => tt.y === sl.y)
    return { sl, c, ts, ...span(sl.y, sl.crop), assumed: !!strategy?.assumed.includes(sl.y) }
  })
  // a tile never runs into the next one: when seasons overlap (a late harvest), the earlier tile is cut short
  const boxes: TileBox[] = [...pastTiles.map((p) => ({ y: p.y, from: p.from, to: p.to })), ...planTiles.map((p) => ({ y: p.sl.y, from: p.from, to: p.to }))]
    .sort((a, b) => a.y - b.y)
  for (let i = 0; i + 1 < boxes.length; i++) if (boxes[i].to > boxes[i + 1].from - 3) boxes[i].to = Math.max(boxes[i].from + 14, boxes[i + 1].from - 3)
  const box = (y: number) => boxes.find((b) => b.y === y)!

  const links = (score?.links ?? []).map((l) => {
    const a = box(l.from)
    const b = box(l.to)
    const good = l.combos.some((c) => c.sign > 0)
    const bad = l.combos.some((c) => c.sign < 0)
    return { l, at: a && b ? (a.to + b.from) / 2 : null, tone: bad ? 'bad' : good ? 'good' : 'none' }
  })
  const covers = planTiles.filter((p) => p.sl.cover).map((p) => {
    const prev = box(p.sl.y - 1)
    return prev ? { y: p.sl.y, from: prev.to + 3, to: box(p.sl.y).from - 3 } : null
  }).filter((c): c is { y: number; from: number; to: number } => !!c && c.to - c.from > 6)
  // months between the harvest and the next sowing, for the cover-crop note
  const coverNote = (c: { from: number; to: number }) => t('cmp.coverNote', { m: Math.max(1, Math.round((c.to - c.from + 6) / scale.dk / 3)) })

  const chips: { key: string; good: boolean; text: string; combo?: ComboHit; yrs?: string; note?: string }[] = []
  for (const l of score?.links ?? []) for (const c of l.combos) chips.push({ key: `${l.from}-${c.id}`, good: c.sign > 0, text: t(c.label as Key), combo: c, yrs: `${l.from}→${l.to}` })
  for (const c of covers) chips.push({ key: `cover-${c.y}`, good: true, text: `${t('combo.cover_shield')}`, yrs: `${c.y}`, note: coverNote(c) })
  const comboCount = chips.filter((c) => c.good).length
  const open1 = chips.find((c) => c.key === chip)

  const expl: Explanation | null = useMemo(() => {
    if (!open || !score) return null
    const s: Strategy = strategy ?? { id: 'mine' as Strategy['id'], score, assumed: [] }
    return explain(s, field, history)
  }, [open, score, strategy, field, history])

  return (
    <article className="lane" data-lane={lane} data-tour={`lane-${lane}`}>
      <header className="lane-head">
        <h3 className="lane-name">{t(`cmp.lane.${lane}` as Key)} <span className="lane-sub">{t(`cmp.lane.${lane}.sub` as Key)}</span> <Info k={`info.lane.${lane}` as Key} /></h3>
        {score && <span className="lane-score" aria-label={`${t('cmp.score')} ${Math.round(score.total)}`}><small>{t('cmp.score')}</small><b>{Math.round(score.total)}</b></span>}
      </header>

      {planTiles.length > 0 && (
        <ol className="chain" aria-label={t(`cmp.lane.${lane}` as Key)}>
          {planTiles.map((p, i) => {
            const lk = links.find((l) => l.l.to === p.sl.y)
            return (
              <li key={p.sl.y}>
                {i > 0 && <span className="chain-link" data-tone={lk?.tone ?? 'none'} aria-hidden="true">{lk?.tone === 'good' ? '✔' : lk?.tone === 'bad' ? '✖' : '→'}</span>}
                {p.sl.cover && <span className="chain-cover" title={t('cmp.cover')} aria-label={t('cmp.cover')}>🌱 {t('cmp.coverShort')}</span>}
                <button type="button" className="chain-item" data-hard={!!p.ts?.hard} style={{ ['--c' as string]: p.c.colour }} onClick={() => onTile(p.c.id, p.sl.y)}>
                  <small>{p.sl.y}</small> {p.sl.locked ? <span aria-hidden="true">📌</span> : <CropIcon id={p.c.id} size={16} />} {short(p.c.id)}{p.ts?.hard ? ' ✖' : ''}
                </button>
              </li>
            )
          })}
        </ol>
      )}

      <div className="timeline" ref={scroller}>
        <div className="tl" style={{ width: scale.width }}>
          <div className="tl-axis" aria-hidden="true">
            {scale.years.map((y) => (
              <span key={y} className="tl-year" data-plan={y >= scale.planFrom} style={{ left: x(y, 0) }}>{y}</span>
            ))}
          </div>
          <span className="tl-split" style={{ left: scale.todayX }} aria-hidden="true"><span>{t('top.today')} →</span></span>
          <div className="tl-tiles">
            {pastTiles.map((p) => {
              const b = box(p.y)
              return (
                <span key={`p${p.y}`} className="ctile past" data-known={p.known}
                  style={{ left: b.from, width: b.to - b.from, ['--c' as string]: p.crop?.colour ?? 'var(--frost)' }} title={`${p.y}: ${p.full}`}>
                  <span className="ctile-icon" aria-hidden="true">{p.crop ? <CropIcon id={p.crop.id} size={18} /> : <GroupIcon group={p.group ?? null} size={16} />}</span>
                  <span className="ctile-name">{p.label}</span>
                </span>
              )
            })}
            {covers.map((c) => (
              <span key={`c${c.y}`} className="ccover" style={{ left: c.from, width: c.to - c.from }} title={coverNote(c)}>
                {c.to - c.from >= 84 ? <span className="ccover-label" aria-hidden="true">🌱 {t('cmp.coverShort')}</span> : null}
                <span className="sr-only">{coverNote(c)}</span>
              </span>
            ))}
            {planTiles.map((p) => {
              const b = box(p.sl.y)
              const label = `${p.sl.y}: ${name(p.c.id)}${p.sl.locked ? ` · ${t('cmp.locked')}` : ''}${p.ts?.hard ? ` · ${t('cmp.violation')}` : ''}${p.assumed ? ` · ${t('cmp.assumed')}` : ''}`
              return (
                <button key={p.sl.y} type="button" className="ctile" data-hard={!!p.ts?.hard} data-assumed={p.assumed}
                  style={{ left: b.from, width: b.to - b.from, ['--c' as string]: p.c.colour }}
                  onClick={() => onTile(p.c.id, p.sl.y)} title={label} aria-label={label}>
                  <span className="ctile-icon" aria-hidden="true">{p.sl.locked ? '📌' : <CropIcon id={p.c.id} size={18} />}</span>
                  <span className="ctile-name" aria-hidden="true">{short(p.c.id)}</span>
                  {p.ts?.hard && <span className="ctile-bad" aria-hidden="true">✖</span>}
                </button>
              )
            })}
          </div>
          <div className="tl-links" aria-hidden="true">
            {links.map(({ l, at, tone }) => at !== null && (
              <span key={`${l.from}-${l.to}`} className="lmark" data-tone={tone} style={{ left: at }}>{tone === 'good' ? '✔' : tone === 'bad' ? '✖' : ''}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="lane-body">
        {chips.length > 0 && (
          <div className="chips" data-tour={`combos-${lane}`}>
            {chips.map((c) => (
              <button key={c.key} type="button" className="chip" data-good={c.good} aria-pressed={chip === c.key} onClick={() => setChip(chip === c.key ? null : c.key)}>
                <span aria-hidden="true">{c.good ? '✔' : '✖'}</span> {c.text} <small>{c.yrs}</small>
              </button>
            ))}
            {comboCount > 1 && <span className="star">{t('cmp.combos', { n: comboCount })}</span>}
          </div>
        )}
        {open1 && (
          <p className="chip-detail" role="status">
            {open1.combo ? <>{open1.combo.sign > 0 ? '+' : '−'}{open1.combo.points} · {source(open1.combo.source)}</> : open1.note}
          </p>
        )}
        {children}
        {score ? (
          <>
            <StatBars bars={score.bars} />
            <button type="button" className="btn ghost small-btn details-btn" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? t('cmp.hideDetails') : t('cmp.details')}</button>
            {expl && (
              <dl className="details">
                {(['why', 'evidence', 'benefits', 'gaps', 'check'] as const).map((k) => expl[k].length > 0 && (
                  <Fragment key={k}>
                    <dt>{t(`cmp.d.${k}` as Key)}</dt>
                    <dd><ul className="lines">{expl[k].map((m, i) => <li key={i}>{msg(m)}</li>)}</ul></dd>
                  </Fragment>
                ))}
              </dl>
            )}
          </>
        ) : <p className="muted small">{t('cmp.mineEmpty')}</p>}
      </div>
    </article>
  )
}

/** "My plan" pickers, one per season, in normal flow; impossible picks are disabled with the reason. */
function MyPicker({ mine, data, history, fillFrom }: { mine: MyPlan; data: Loaded; history: Season[]; fillFrom?: PlanSlot[] }) {
  const t = useT()
  const name = useCropName(data.crops)
  const prefs = useStore((s) => s.user.prefs)
  const today = useStore((s) => s.today)
  const { crops, cell } = data
  const firstOpen = mine.slots.find((s) => !s.locked)?.y
  const chosen = mine.slots.filter((s) => s.value?.crop).map((s) => ({ y: s.y, crop: s.value!.crop! }))
  return (
    <div className="mypick" data-tour="myplan">
      <div className="mypick-grid">
        {mine.slots.map((s) => {
          if (s.locked) {
            return (
              <div key={s.y} className="myslot" data-locked="true">
                <span className="myslot-year">{s.y}</span>
                <span className="myslot-fixed"><span aria-hidden="true">📌</span> {name(s.value!.crop!)}</span>
                <small className="muted">{t('cmp.locked')}</small>
              </div>
            )
          }
          const prev = chosen.find((c) => c.y === s.y - 1)?.crop ?? history.find((h) => h.y === s.y - 1)?.crop ?? null
          const seq = withPlan(history, chosen.filter((c) => c.y < s.y))
          const options = CROP_ORDER.map((id) => {
            const c = crops.crops.find((k) => k.id === id) as CropDef
            const cal = cropCalendar(c, cell)
            const block = blockReason(id, prefs)
            let disabled: string | null = block ? t(`block.${block}` as Key) : null
            if (!disabled && !cal) disabled = t('cmp.disabled.calendar')
            if (!disabled && cal && s.y === firstOpen && !sowingOpen(cal, s.y, today)) disabled = t('cmp.disabled.window')
            if (!disabled && prev && pairCombos(prev, id, { crops, rules: data.rules, cell }).some((k) => k.id === 'LATE_HARVEST')) disabled = t('cmp.disabled.late')
            const ret = checkReturn(seq, c, s.y)
            const rep = checkRepeat(seq, c, s.y)
            const warn = ret.status === 'violation' ? t('cmp.warn.return', { last: ret.lastYear ?? '' }) : rep.status === 'violation' ? t('cmp.warn.repeat') : null
            return { id, label: `${name(id)}${disabled ? ` — ${disabled}` : warn ? ` — ⚠ ${warn}` : ''}`, disabled: !!disabled, warn }
          })
          const v = s.value?.crop ?? ''
          const picked = options.find((o) => o.id === v)
          const canCover = !!v && coverFits(prev, v as CropId, crops, cell)
          return (
            <div key={s.y} className="myslot">
              <label className="myslot-year" htmlFor={`my-${s.y}`}>{s.y}</label>
              <select id={`my-${s.y}`} value={v} data-empty={!v} aria-label={t('cmp.pick', { year: s.y })}
                onChange={(e) => mine.set(s.y, e.target.value ? { crop: e.target.value as CropId, cover: s.value?.cover && coverFits(prev, e.target.value as CropId, crops, cell) } : null)}>
                <option value="">{t('cmp.choose')}</option>
                {options.map((o) => <option key={o.id} value={o.id} disabled={o.disabled}>{o.label}</option>)}
              </select>
              {picked?.warn && <small className="myslot-warn">⚠ {picked.warn}</small>}
              {canCover && (
                <label className="cover-toggle">
                  <input type="checkbox" checked={!!s.value?.cover} onChange={(e) => mine.set(s.y, { crop: v as CropId, cover: e.target.checked })} />
                  {t('cmp.addCover')}
                </label>
              )}
            </div>
          )
        })}
      </div>
      <div className="mypick-actions">
        {fillFrom && <button type="button" className="btn ghost small-btn" onClick={() => mine.fill(fillFrom)}>{t('cmp.fromBalanced')}</button>}
        {mine.score && <button type="button" className="btn ghost small-btn" onClick={mine.clear}>{t('cmp.clear')}</button>}
      </div>
    </div>
  )
}
