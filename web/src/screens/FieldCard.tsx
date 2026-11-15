import { useRef, useState } from 'react'
import { CropIcon, GroupIcon } from './CropIcon'
import type { CardModel } from '../engine/card'
import type { CropDef, HazardDef, HistClass } from '../engine/types'
import { useT, type Key } from '../i18n'
import { oblastName } from '../i18n/oblasts'
import { setUnsafe } from '../state/persist'
import { useStore, type EvidenceTab, type Sheet } from '../state/store'
import { useCard, useFieldData, type Loaded } from './common'
import { CropDetail } from './CropDetail'
import { Evidence } from './Evidence'
import { HistoryEditor } from './HistoryEditor'
import { Info } from './Info'
import { Priorities } from './Priorities'
import { SowList } from './SowList'

const TAB_OF: Record<HazardDef['variable'], EvidenceTab> = {
  rain: 'rain', balance: 'moisture', wet: 'moisture', et0: 'moisture', hot30: 'heat', hot35: 'heat', tmin: 'heat',
}


const HIST_TO_CROP: Partial<Record<HistClass, string>> = {
  winter_cereal: 'w_wheat', spring_cereal: 's_barley', rapeseed: 'w_rape', maize: 'maize',
  sunflower: 'sunflower', soy: 'soy', sugar_beet: 'sugar_beet',
}

export function FieldCard({ id }: { id: string }) {
  const { status, retry } = useFieldData(id)
  const t = useT()
  const select = useStore((s) => s.select)
  const sheet = useStore((s) => s.sheet)
  const setSheet = useStore((s) => s.setSheet)

  return (
    <aside className="sheet" data-state={sheet} aria-label={t('card.field')}>
      <div className="sheet-bar">
        <SheetGrip sheet={sheet} setSheet={setSheet} label={t('card.resize')} />
        <button type="button" className="icon-btn" onClick={() => select(null)} aria-label={t('card.close')}>✕</button>
      </div>
      {status.kind === 'loading' && <div className="card-state" aria-busy="true"><span className="pulse" /></div>}
      {status.kind === 'missing' && <p className="card-state">{t('card.notFound')}</p>}
      {status.kind === 'error' && (
        <div className="card-state">
          <p>{t('card.loadError')}</p>
          <button type="button" className="btn" onClick={retry}>{t('card.retry')}</button>
        </div>
      )}
      {status.kind === 'ok' && <Panels data={status.data} />}
    </aside>
  )
}

const ORDER: Sheet[] = ['peek', 'half', 'full']

/** The whole bar is the grip: swipe up or down to change height; a tap toggles half and full. */
function SheetGrip({ sheet, setSheet, label }: { sheet: Sheet; setSheet: (s: Sheet) => void; label: string }) {
  const start = useRef<number | null>(null)
  const moved = useRef(false)
  const step = (dir: 1 | -1) => setSheet(ORDER[Math.max(0, Math.min(2, ORDER.indexOf(sheet) + dir))])
  return (
    <button type="button" className="sheet-grip" aria-label={label} aria-expanded={sheet === 'full'}
      onPointerDown={(e) => {
        start.current = e.clientY
        moved.current = false
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (start.current === null || moved.current) return
        const dy = e.clientY - start.current
        if (Math.abs(dy) > 28) {
          moved.current = true
          step(dy < 0 ? 1 : -1)
        }
      }}
      onPointerUp={() => {
        start.current = null
      }}
      onClick={() => {
        if (moved.current) return
        setSheet(sheet === 'full' ? 'half' : 'full')
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp') step(1)
        if (e.key === 'ArrowDown') step(-1)
      }}>
      <span className="sheet-handle" aria-hidden="true" />
    </button>
  )
}

/** The sheet shows the card or one of its sub-screens (S3, S4, S6, S7) for the same field. */
function Panels({ data }: { data: Loaded }) {
  const panel = useStore((s) => s.panel)
  const openPanel = useStore((s) => s.openPanel)
  const card = useCard(data)
  return (
    <div className="card" key={panel.kind}>
      {panel.kind === 'card' && <CardBody data={data} model={card} />}
      {panel.kind === 'history' && <HistoryEditor data={data} card={card} />}
      {panel.kind === 'priorities' && <Priorities data={data} />}
      {panel.kind === 'evidence' && <Evidence key={panel.tab ?? 'green'} data={data} card={card} tab={panel.tab} />}
      {panel.kind === 'crop' && <CropDetail data={data} card={card} crop={panel.crop} year={panel.year} onClose={() => openPanel({ kind: 'card' })} />}
    </div>
  )
}

function CardBody({ data, model }: { data: Loaded; model: CardModel }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const openPanel = useStore((s) => s.openPanel)
  const setCompare = useStore((s) => s.setCompare)
  const updateUser = useStore((s) => s.updateUser)
  const unsafe = useStore((s) => !!s.user.unsafe[data.field.id])
  const { field, crops } = data
  const nf = (v: number, d = 1) => v.toLocaleString(lang === 'uk' ? 'uk-UA' : 'en-GB', { maximumFractionDigits: d })
  const cropName = (c: CropDef) => c.name[lang]
  const byId = (id: string) => crops.crops.find((c) => c.id === id)
  const locked = model.slots.find((s) => s.locked)
  const [showAll, setShowAll] = useState(false)
  const fmtDay = (d: Date) => d.toLocaleDateString(lang === 'uk' ? 'uk-UA' : 'en-GB', { day: 'numeric', month: 'short' })
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(lang === 'uk' ? 'uk-UA' : 'en-GB', { day: 'numeric', month: 'long' })

  return (
    <>
      <header className="card-head" data-tour="card-head">
        <h2 className="card-title">
          <span className="ha">{nf(field.ha)}</span> <span className="unit">{t('card.ha')}</span>
        </h2>
        <p className="card-sub">
          {oblastName(field.adm.oblast, lang)}
          {field.terrain ? <> · {t('card.slope')} {nf(field.terrain.slope)}%</> : <> · {t('card.terrainNone')}</>}
          {field.soil ? <> · {t('card.soilClay', { v: nf(field.soil.clay, 0) })} · {t('card.soilSoc', { v: nf(field.soil.soc, 1) })}</> : <> · {t('card.soilNone')}</>}
        </p>
        <span className="badge">{t('card.estimate')}</span>
      </header>

      <section className="row" aria-labelledby="was" data-tour="history">
        <h3 id="was" className="row-label">{t('card.was')} <Info k="info.was" />
          <button type="button" className="mini-btn" onClick={() => openPanel({ kind: 'history' })}>{t('card.edit')}</button>
        </h3>
        {field.hist.length || model.seasons.some((s) => s.farmer) ? (
          <ol className="strip">
            {model.seasons.map((s) => {
              const item = s.farmer ? undefined : field.hist.find((h) => h.y === s.y)
              const crop = s.farmer ? (s.crop ? byId(s.crop) : undefined) : item && s.known ? byId(HIST_TO_CROP[item.k] ?? '') : undefined
              const hint = !s.known && s.hint ? byId(s.hint) : undefined
              const group = !s.known && s.group ? t(`hist.group.${s.group}` as Key) : null
              const name = s.farmer ? `${crop ? cropName(crop) : t('he.dontKnow')} (${t('card.farmerYear')})`
                : item && s.known ? t(`hist.${item.k}` as Key)
                : group && hint ? t('hist.maybe', { group, crop: cropName(hint) })
                : group ?? t('card.unknownSeason')
              const conf = item && item.src === 'model' && item.k !== 'unknown' ? ` · ${t('hist.confidence', { p: Math.round(item.p * 100) })}` : ''
              const glyph = s.known && crop ? <CropIcon id={crop.id} size={20} /> : <GroupIcon group={s.group ?? null} size={18} />
              return (
                <li key={s.y} className="tile" data-known={s.known} data-group={s.group ?? undefined} data-farmer={!!s.farmer}
                  style={crop ? { ['--c' as string]: crop.colour } : hint ? { ['--c' as string]: hint.colour } : undefined}
                  title={`${s.y}: ${name}${conf}`} aria-label={`${s.y}: ${name}${conf}`}>
                  <span className="tile-glyph" aria-hidden="true">{glyph}{!s.known && s.group ? <sup>?</sup> : null}</span>
                  <span className="tile-year">{s.farmer ? <span aria-hidden="true">✎</span> : null}{String(s.y).slice(2)}</span>
                </li>
              )
            })}
          </ol>
        ) : (
          <p className="muted">{field.flags.includes('no_history') ? t('card.historyPending') : t('card.noHistory')}</p>
        )}
      </section>

      <section className="row">
        <h3 className="row-label">{t('card.now')} <Info k="info.now" /></h3>
        <p>{field.now ? t(`now.${field.now.state}` as Key, { date: fmtDate(field.now.asOf) }) : t('now.unknown')}</p>
      </section>
      {locked && <p className="note">{t('card.lockedWinter', { year: locked.y })}</p>}
      {field.flags.includes('small') && <p className="note">{t('card.smallField')}</p>}

      {unsafe ? <p className="note warn-note">{t('card.unsafeNote')}</p> : <>
      <section className="block" data-tone="go" aria-labelledby="sow" data-tour="sow">
        <h3 id="sow" className="block-title"><span aria-hidden="true">✓</span> {t('card.sowNext')} <span className="muted">{t('card.sowFor', { year: model.target })}</span> <Info k="info.sow" /></h3>
        <p className="muted small">{t('card.chooseHint')}</p>
        <SowList list={showAll ? [...model.sowNext, ...model.other] : model.sowNext} all={[...model.sowNext, ...model.other]} model={model}
          cropName={cropName} prevName={(() => { const p = model.seasons.find((x) => x.y === model.target - 1); const c = p?.crop ? byId(p.crop) : undefined; return c ? cropName(c) : null })()}
          onOpen={(c) => openPanel({ kind: 'crop', crop: c.crop.id, year: model.target })} />
        {model.other.length > 0 && (
          <button type="button" className="btn ghost" aria-expanded={showAll} onClick={() => setShowAll((v) => !v)}>
            {showAll ? t('card.lessOptions') : t('card.moreOptions', { n: model.other.length })}
          </button>
        )}
        {model.blocked.length > 0 && (
          <div className="blocked">
            <p className="muted small">{t('card.blockedTitle')}</p>
            <ul className="lines">
              {model.blocked.map((b) => (
                <li key={b.crop.id} className="blocked-item"><CropIcon id={b.crop.id} size={18} /> {cropName(b.crop)} — {t(`block.${b.reason}` as Key)}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="block" data-tone="stop" aria-labelledby="avoid" data-tour="avoid">
        <h3 id="avoid" className="block-title"><span aria-hidden="true">⛔</span> {t('card.avoid')} <Info k="info.avoid" /></h3>
        {model.avoid.length ? (
          <ul className="lines">
            {model.avoid.map((a) => (
              <li key={a.crop.id}>
                {a.check.rule === 'EARLY_RETURN' && t('card.avoidReturn', { crop: cropName(a.crop), year: a.check.allowedFrom ?? '', last: a.check.lastYear ?? '' })}
                {a.check.rule === 'MAX_IN_ROW' && t('card.avoidRepeat', { crop: cropName(a.crop), year: model.target })}
                {a.check.rule === 'LATE_HARVEST' && t('card.avoidLate', { crop: cropName(a.crop) })}
              </li>
            ))}
          </ul>
        ) : <p className="muted">{t('card.nothingToAvoid', { year: model.target })}</p>}
      </section>

      {model.risks && (
        <section className="block" data-tone="warn" aria-labelledby="risks" data-tour="risks">
          <h3 id="risks" className="block-title"><span aria-hidden="true">⚠</span> {t('card.risks')} <span className="muted">· {cropName(model.risks.crop)}</span> <Info k="info.risks" /></h3>
          {(() => {
            const hits = model.risks.results.filter((r) => r.count > 0).sort((a, b) => b.count - a.count)
            const years = model.risks.results[0]?.years ?? 0
            return hits.length ? (
              <ul className="lines">
                {hits.map((r) => (
                  <li key={r.id} className="risk">
                    <button type="button" className="linklike" onClick={() => openPanel({ kind: 'evidence', tab: TAB_OF[model.risks!.crop.hazards.find((h) => h.id === r.id)?.variable ?? 'rain'] })}>
                      {t('card.riskLine', { what: t(r.label as Key), count: r.count, years: r.years })} ▸
                    </button>
                    <span className="dots" aria-hidden="true">
                      {Array.from({ length: r.years }, (_, i) => <i key={i} data-on={i < r.count} />)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : <p className="muted">{t('card.noRisks', { years })}</p>
          })()}
        </section>
      )}

      {model.watch.length > 0 && (
        <section className="block" data-tone="watch" aria-labelledby="watch">
          <h3 id="watch" className="block-title"><span aria-hidden="true">◉</span> {t('card.watch')} <span className="muted">· {cropName(model.watch[0].crop)}</span> <Info k="info.watch" /></h3>
          <ul className="lines">
            {model.watch.map((w) => (
              <li key={w.what}><button type="button" className="linklike" onClick={() => openPanel({ kind: 'crop', crop: w.crop.id, year: model.target })}><span className="when">{t('card.watchRange', { from: fmtDay(w.from), to: fmtDay(w.to) })}</span> {t(w.what as Key)}</button></li>
            ))}
          </ul>
        </section>
      )}

      </>}

      <div className="actions">
        {!unsafe && <button type="button" className="btn primary" data-tour="compare-btn" onClick={() => setCompare(true)}>{t('card.compare')}</button>}
        <button type="button" className="btn ghost" onClick={() => openPanel({ kind: 'evidence' })}>{t('card.why')}</button>
        <button type="button" className="btn ghost" onClick={() => openPanel({ kind: 'priorities' })}>{t('card.priorities')}</button>
      </div>

      <section className="row health" aria-label={t('card.health')}>
        {model.health >= 0 ? (
          <>
            <h3 className="row-label">{t('card.health')} <Info k="info.health" /></h3>
            <meter min={0} max={100} low={40} high={70} optimum={100} value={model.health} aria-label={t('card.health')} />
            <span className="health-num">{model.health}</span>
          </>
        ) : <p className="muted">{t('card.healthUnknown')}</p>}
      </section>
      <button type="button" className="btn ghost unsafe-btn" aria-pressed={unsafe} onClick={() => updateUser((d) => setUnsafe(d, field.id, !unsafe))}>
        🚩 {unsafe ? t('card.unmarkUnsafe') : t('card.markUnsafe')}
      </button>
    </>
  )
}
