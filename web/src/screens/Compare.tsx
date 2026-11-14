// S5 Compare rotations (PLAN §5.6): lanes on a month scale, combo links, stat bars, five-item details,
// and the editable "My plan" with instant re-scoring.
import { Fragment, useMemo, useState } from 'react'
import { cropCalendar, sowingOpen } from '../engine/calendar'
import type { CardModel } from '../engine/card'
import { pairCombos } from '../engine/combos'
import { explain, type Explanation } from '../engine/explain'
import { blockReason } from '../engine/prefs'
import { checkRepeat, checkReturn, type Season } from '../engine/precursors'
import { scorePlan, withPlan, type Link, type PlanScore, type PlanSlot } from '../engine/score'
import { coverFits, suggestRotations, type Strategy } from '../engine/strategies'
import type { CropDef, CropId } from '../engine/types'
import { useT, type Key } from '../i18n'
import { setPlanSlot, type MySlot } from '../state/persist'
import { useStore } from '../state/store'
import { CROP_ORDER, ScenarioSwitch, StatBars, useCard, useCropName, useFieldData, useMsg, useSourceName, type Loaded } from './common'
import { CropDetail } from './CropDetail'
import { ICON } from './FieldCard'

const DK = 6 // pixels per dekad
const PAST = 3 // past seasons shown before the plan

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

function CompareBody({ data }: { data: Loaded }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const setCompare = useStore((s) => s.setCompare)
  const openPanel = useStore((s) => s.openPanel)
  const unsafe = useStore((s) => !!s.user.unsafe[data.field.id])
  const card = useCard(data)
  const { field, crops, cell } = data
  const history = card.seasons
  const strategies = useMemo(() => (unsafe ? [] : suggestRotations(history, card.ctx)), [history, card.ctx, unsafe])
  const mine = useMyPlan(data, card)
  const [detail, setDetail] = useState<{ crop: CropId; year: number } | null>(null)
  const nf = (v: number) => v.toLocaleString(lang === 'uk' ? 'uk-UA' : 'en-GB', { maximumFractionDigits: 1 })

  const planYears = card.slots.map((s) => s.y)
  const y0 = planYears[0] - PAST
  const yLast = planYears[planYears.length - 1]
  const axis = { start: (y0 - 1) * 36 + 24, end: yLast * 36 + 31 } // from early September before the first past season to early November of the last
  const width = (axis.end - axis.start) * DK
  const past = history.filter((s) => s.y >= y0 && s.y < planYears[0])

  return (
    <div className="cmp">
      <header className="cmp-head">
        <button type="button" className="back-btn" onClick={() => setCompare(false)} aria-label={t('cmp.back')}>←</button>
        <h2 className="cmp-title">{t('cmp.title')} <span className="muted">· {nf(field.ha)} {t('card.ha')}</span></h2>
        <ScenarioSwitch cell={cell} />
        <button type="button" className="btn ghost small-btn" onClick={() => { setCompare(false); openPanel({ kind: 'priorities' }) }}>⚙ {t('card.priorities')}</button>
      </header>
      {unsafe ? <p className="note">{t('card.unsafeNote')}</p> : (
        <>
          <p className="muted small">{t('cmp.scaleNote')}</p>
          <div className="lanes-scroll">
            <div className="lanes" style={{ width: width + 2 }}>
              <YearAxis y0={y0} yLast={yLast} start={axis.start} planFrom={planYears[0]} />
              {strategies.map((s) => (
                <Lane key={s.id} lane={s.id} score={s.score} strategy={s} history={history} past={past} data={data} axisStart={axis.start}
                  width={width} onTile={(crop, year) => setDetail({ crop, year })} />
              ))}
              <Lane lane="mine" score={mine.score} history={history} past={past} data={data} axisStart={axis.start} width={width}
                onTile={(crop, year) => setDetail({ crop, year })} mine={mine} fillFrom={strategies.find((s) => s.id === 'balanced')?.score.slots} />
            </div>
          </div>
        </>
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

/** The crop before `year` in whichever plan the tile came from does not matter for S6: use the first plan that has the year. */
function planContext(year: number, strategies: Strategy[], mine: PlanScore | null): PlanSlot[] {
  for (const p of [...strategies.map((s) => s.score), mine]) if (p?.slots.some((s) => s.y === year)) return p.slots
  return []
}

function YearAxis({ y0, yLast, start, planFrom }: { y0: number; yLast: number; start: number; planFrom: number }) {
  const t = useT()
  const years = []
  for (let y = y0; y <= yLast; y++) years.push(y)
  return (
    <div className="axis" aria-hidden="true">
      {years.map((y) => (
        <span key={y} className="axis-year" data-plan={y >= planFrom} style={{ left: (y * 36 - start) * DK }}>{y}</span>
      ))}
      <span className="axis-split" style={{ left: ((planFrom - 1) * 36 + 24 - start) * DK }}>
        <span>{t('cmp.past')}</span><span>{t('cmp.plan')} →</span>
      </span>
    </div>
  )
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
  axisStart: number
  width: number
  onTile: (crop: CropId, year: number) => void
  mine?: MyPlan
  fillFrom?: PlanSlot[]
}

const GROUP_CAL: Record<string, CropId> = { winter: 'w_wheat', summer: 'maize', uncultivated: 's_barley' }

function Lane({ lane, score, strategy, history, past, data, axisStart, width, onTile, mine, fillFrom }: LaneProps) {
  const t = useT()
  const msg = useMsg(data.crops)
  const name = useCropName(data.crops)
  const source = useSourceName()
  const [open, setOpen] = useState(false)
  const [link, setLink] = useState<Link | null>(null)
  const { crops, cell, field } = data
  const def = (id: CropId) => crops.crops.find((c) => c.id === id)!
  const x = (y: number, d: number) => (y * 36 + d - axisStart) * DK

  // past tiles (shared by every lane)
  const pastTiles = past.map((s) => {
    const cid = s.crop ?? (s.group ? GROUP_CAL[s.group] : null)
    const cal = cid ? cropCalendar(def(cid), cell) : null
    const from = cal ? x(s.y, cal.sow.start) : x(s.y, 9)
    const to = cal ? x(s.y, cal.harvest.end + 1) : x(s.y, 27)
    const label = s.crop ? name(s.crop) : s.group ? t(`hist.group.${s.group}` as Key) : t('card.unknownSeason')
    return { s, from, to, label, crop: s.crop ? def(s.crop) : null }
  })

  const slots = score?.slots ?? []
  const tiles = slots.map((sl) => {
    const c = def(sl.crop)
    const cal = cropCalendar(c, cell)
    const ts = score!.tiles.find((tt) => tt.y === sl.y)
    const prevCrop = slots.find((p) => p.y === sl.y - 1)?.crop ?? history.find((h) => h.y === sl.y - 1)?.crop ?? null
    const prevCal = prevCrop ? cropCalendar(def(prevCrop), cell) : null
    return {
      sl, c, ts,
      from: cal ? x(sl.y, cal.sow.start) : x(sl.y, 9),
      to: cal ? x(sl.y, cal.harvest.end + 1) : x(sl.y, 27),
      cover: sl.cover && prevCal && cal ? { from: x(sl.y - 1, prevCal.harvest.end + 1) + 4, to: x(sl.y, cal.sow.start) - 4 } : null,
      assumed: !!strategy?.assumed.includes(sl.y),
    }
  })
  const edgeOf = (y: number) => tiles.find((tt) => tt.sl.y === y) ?? pastTiles.find((p) => p.s.y === y)
  const links = (score?.links ?? []).map((l) => {
    const a = edgeOf(l.from)
    const b = edgeOf(l.to)
    const pos = a && b ? (b.from > a.to + 16 ? (a.to + b.from) / 2 : b.from - 2) : null
    const good = l.combos.some((c) => c.sign > 0)
    const bad = l.combos.some((c) => c.sign < 0)
    return { l, pos, tone: bad ? 'bad' : good ? 'good' : 'none' }
  })
  const comboCount = (score?.links ?? []).reduce((n, l) => n + l.combos.filter((c) => c.sign > 0).length, 0) + (slots.some((s) => s.cover) ? 1 : 0)
  const expl: Explanation | null = useMemo(() => {
    if (!open || !score) return null
    const s: Strategy = strategy ?? { id: 'mine' as Strategy['id'], score, assumed: [] }
    return explain(s, field, history)
  }, [open, score, strategy, field, history])

  return (
    <article className="lane" data-lane={lane}>
      <header className="lane-head">
        <h3 className="lane-name">{t(`cmp.lane.${lane}` as Key)} <span className="muted">· {t(`cmp.lane.${lane}.sub` as Key)}</span></h3>
        {score && <span className="lane-score" aria-label={`${t('cmp.score')} ${Math.round(score.total)}`}>{t('cmp.score')} <b>{Math.round(score.total)}</b></span>}
      </header>
      <div className="track" style={{ width }}>
        {pastTiles.map((p) => (
          <span key={`p${p.s.y}`} className="ctile past" data-known={p.s.known} style={{ left: p.from, width: Math.max(18, p.to - p.from), ['--c' as string]: p.crop?.colour ?? 'var(--line)' }}
            title={`${p.s.y}: ${p.label}`}>
            <span aria-hidden="true">{p.crop ? ICON[p.crop.icon] : p.s.group === 'winter' ? '❄' : p.s.group === 'summer' ? '☀' : '?'}</span>
            <span className="ctile-name">{p.label}</span>
          </span>
        ))}
        {tiles.map((tt) => (
          <Fragment key={tt.sl.y}>
            {tt.cover && tt.cover.to > tt.cover.from && (
              <span className="ctile cover" style={{ left: tt.cover.from, width: tt.cover.to - tt.cover.from }} title={t('cmp.cover')}>
                <span aria-hidden="true">🌱</span><span className="sr-only">{t('cmp.cover')}</span>
              </span>
            )}
            <button type="button" className="ctile" data-hard={!!tt.ts?.hard} data-assumed={tt.assumed}
              style={{ left: tt.from, width: Math.max(24, tt.to - tt.from), ['--c' as string]: tt.c.colour }}
              onClick={() => onTile(tt.c.id, tt.sl.y)}
              title={`${tt.sl.y}: ${name(tt.c.id)}${tt.sl.locked ? ` · ${t('cmp.locked')}` : ''}${tt.ts?.hard ? ` · ${t('cmp.violation')}` : ''}`}>
              <span aria-hidden="true">{tt.sl.locked ? '📌' : ''}{ICON[tt.c.icon]}</span>
              <span className="ctile-name">{name(tt.c.id)}{tt.assumed ? ` (${t('cmp.assumed')})` : ''}</span>
              {tt.ts?.hard && <span className="ctile-bad" aria-hidden="true">✖</span>}
            </button>
          </Fragment>
        ))}
        {links.map(({ l, pos, tone }) => pos !== null && (
          <button key={`${l.from}-${l.to}`} type="button" className="link" data-tone={tone} style={{ left: pos - 11 }}
            aria-pressed={link?.from === l.from}
            aria-label={`${l.from} → ${l.to}: ${l.combos.length ? l.combos.map((c) => t(c.label as Key)).join(', ') : t('cmp.link.none')}`}
            onClick={() => setLink(link?.from === l.from ? null : l)}>
            {tone === 'good' ? '✔' : tone === 'bad' ? '✖' : '·'}
          </button>
        ))}
        {mine && <MySlots mine={mine} data={data} history={history} x={x} fillFrom={fillFrom} />}
      </div>
      {link && (
        <div className="link-detail" role="status">
          <b>{t('cmp.linkTitle', { from: `${link.from}`, to: `${link.to}` })}</b>
          {link.combos.length ? (
            <ul className="lines">
              {link.combos.map((c) => (
                <li key={c.id}><span className={c.sign > 0 ? 'combo' : 'combo bad'}>{c.sign > 0 ? '+' : '−'}{c.points} {t(c.label as Key)}</span> <span className="muted small">{source(c.source)}</span></li>
              ))}
            </ul>
          ) : <span className="muted"> {t('cmp.link.none')}</span>}
        </div>
      )}
      {score ? (
        <div className="lane-foot">
          <p className="lane-combos">
            {(score.links ?? []).flatMap((l) => l.combos).map((c, i) => (
              <span key={i} className={c.sign > 0 ? 'combo' : 'combo bad'}>{c.sign > 0 ? '✔' : '✖'} {t(c.label as Key)}</span>
            ))}
            {slots.some((s) => s.cover) && <span className="combo">✔ {t('combo.cover_shield')}</span>}
            {comboCount > 1 && <span className="star">{t('cmp.combos', { n: comboCount })}</span>}
          </p>
          <StatBars bars={score.bars} />
          <button type="button" className="btn ghost small-btn" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? t('cmp.hideDetails') : t('cmp.details')}</button>
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
        </div>
      ) : mine && <p className="muted small lane-foot">{t('cmp.mineEmpty')}</p>}
    </article>
  )
}

/** "My plan": a picker per open season, placed under its tile position; impossible picks are disabled with the reason. */
function MySlots({ mine, data, history, x, fillFrom }: { mine: MyPlan; data: Loaded; history: Season[]; x: (y: number, d: number) => number; fillFrom?: PlanSlot[] }) {
  const t = useT()
  const name = useCropName(data.crops)
  const prefs = useStore((s) => s.user.prefs)
  const today = useStore((s) => s.today)
  const { crops, cell } = data
  const firstOpen = mine.slots.find((s) => !s.locked)?.y
  const chosen = mine.slots.filter((s) => s.value?.crop).map((s) => ({ y: s.y, crop: s.value!.crop! }))
  return (
    <div className="myslots">
      {mine.slots.filter((s) => !s.locked).map((s) => {
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
          return { id, label: `${name(id)}${disabled ? ` — ${disabled}` : warn ? ` — ⚠ ${warn}` : ''}`, disabled: !!disabled }
        })
        const v = s.value?.crop ?? ''
        const canCover = !!v && coverFits(prev, v as CropId, crops, cell)
        return (
          <div key={s.y} className="myslot" style={{ left: x(s.y, 3) }}>
            <label className="sr-only" htmlFor={`my-${s.y}`}>{t('cmp.pick', { year: s.y })}</label>
            <select id={`my-${s.y}`} value={v} data-empty={!v}
              onChange={(e) => mine.set(s.y, e.target.value ? { crop: e.target.value as CropId, cover: s.value?.cover && coverFits(prev, e.target.value as CropId, crops, cell) } : null)}>
              <option value="">{t('cmp.choose')} · {s.y}</option>
              {options.map((o) => <option key={o.id} value={o.id} disabled={o.disabled}>{o.label}</option>)}
            </select>
            {canCover && (
              <label className="cover-toggle">
                <input type="checkbox" checked={!!s.value?.cover} onChange={(e) => mine.set(s.y, { crop: v as CropId, cover: e.target.checked })} />
                {t('cmp.addCover')}
              </label>
            )}
          </div>
        )
      })}
      <div className="myslot-actions">
        {fillFrom && <button type="button" className="btn ghost small-btn" onClick={() => mine.fill(fillFrom)}>{t('cmp.fromBalanced')}</button>}
        {mine.score && <button type="button" className="btn ghost small-btn" onClick={mine.clear}>{t('cmp.clear')}</button>}
      </div>
    </div>
  )
}
