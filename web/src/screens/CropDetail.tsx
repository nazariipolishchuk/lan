// S6 Crop tile detail (PLAN §5.7): why this crop here, its windows, risks as "x of N years", watch calendar, gaps, sources.
import { cropCalendar } from '../engine/calendar'
import type { CardModel } from '../engine/card'
import { pairCombos } from '../engine/combos'
import { hazards } from '../engine/hazards'
import { lastCompleteYear, scenarioYears, scorePlan, type PlanSlot } from '../engine/score'
import type { CropId, HazardDef } from '../engine/types'
import { dekadEnd, dekadStart, watchList } from '../engine/watch'
import { useT, type Key } from '../i18n'
import { useStore, type EvidenceTab } from '../state/store'
import { StatBars, useCropName, useSourceName, type Loaded } from './common'
import { ICON } from './FieldCard'

const TAB_OF: Record<HazardDef['variable'], EvidenceTab> = {
  rain: 'rain', balance: 'moisture', wet: 'moisture', et0: 'moisture', hot30: 'heat', hot35: 'heat', tmin: 'heat',
}

interface Props {
  data: Loaded
  card: CardModel
  crop: CropId
  year: number
  onClose: () => void
  /** The plan the tile belongs to, for its predecessor; empty on the card. */
  planned?: PlanSlot[]
}

export function CropDetail({ data, card, crop, year, onClose, planned = [] }: Props) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const scenario = useStore((s) => s.scenario)
  const today = useStore((s) => s.today)
  const openPanel = useStore((s) => s.openPanel)
  const setCompare = useStore((s) => s.setCompare)
  const name = useCropName(data.crops)
  const source = useSourceName()
  const { crops, rules, cell } = data
  const c = crops.crops.find((k) => k.id === crop)!
  const cal = cropCalendar(c, cell)
  const prev = planned.find((s) => s.y === year - 1)?.crop ?? card.seasons.find((s) => s.y === year - 1)?.crop ?? null
  const pred = prev ? rules.predecessor.find((p) => p.from === prev && p.to === crop) : undefined
  const combos = prev ? pairCombos(prev, crop, { crops, rules, cell }) : []
  const years = scenarioYears(cell, scenario, lastCompleteYear(cell, today))
  const hz = hazards(c, cell, 0, scenario === 'all' ? years.slice(-20) : years)
  const watch = watchList(c, cell, year)
  const sc = scorePlan([{ y: year, crop }], card.seasons, card.ctx)
  const fmt = (d: Date) => d.toLocaleDateString(lang === 'uk' ? 'uk-UA' : 'en-GB', { day: 'numeric', month: 'short' })
  const hdef = (id: string) => c.hazards.find((h) => h.id === id)!
  const goEvidence = (tab: EvidenceTab) => {
    setCompare(false)
    openPanel({ kind: 'evidence', tab })
  }
  const effectKey = !pred || pred.effect === 0 ? 'crop.effect.zero' : pred.effect > 0 ? 'crop.effect.pos' : 'crop.effect.neg'

  return (
    <div className="crop-detail">
      <header className="panel-head">
        <button type="button" className="back-btn" onClick={onClose} aria-label={t('card.close')}>←</button>
        <h2 className="panel-title"><span aria-hidden="true">{ICON[c.icon]}</span> {t('crop.title', { crop: name(crop), year })}</h2>
      </header>

      <section className="block">
        <h3 className="block-title">{t('crop.whyHere')}</h3>
        <ul className="lines">
          {prev && <li>{pred && pred.effect > 0 ? '✔' : pred && pred.effect < 0 ? '✖' : '·'} {t('crop.after', { prev: name(prev) })}: {t(effectKey as Key)}{pred ? <> <span className="muted small">{source(pred.source)}</span></> : null}</li>}
          {combos.map((k) => <li key={k.id} className={k.sign > 0 ? 'combo' : 'combo bad'}>{k.sign > 0 ? '✔' : '✖'} {t(k.label as Key)} <span className="muted small">{source(k.source)}</span></li>)}
          {c.fixesNitrogen && <li>✔ {t('crop.fixesN')}</li>}
          {c.returnGap.v > 0 && <li>· {t('crop.returnGap', { n: c.returnGap.v })} <span className="muted small">{source(c.returnGap.source)}</span></li>}
        </ul>
        {sc.tiles[0] && <StatBars bars={sc.tiles[0].bars} />}
      </section>

      {cal && (
        <section className="block">
          <dl className="windows">
            <dt>{t('crop.sow')}</dt><dd>{fmt(dekadStart(year, cal.sow.start))} – {fmt(dekadEnd(year, cal.sow.end))}</dd>
            <dt>{t('crop.harvest')}</dt><dd>{fmt(dekadStart(year, cal.harvest.start))} – {fmt(dekadEnd(year, cal.harvest.end))}</dd>
          </dl>
        </section>
      )}

      <section className="block" data-tone="warn">
        <h3 className="block-title"><span aria-hidden="true">⚠</span> {t('crop.risks')}</h3>
        {hz.some((h) => h.count > 0) ? (
          <ul className="lines">
            {hz.filter((h) => h.years > 0).sort((a, b) => b.count - a.count).map((h) => (
              <li key={h.id}>
                <button type="button" className="linklike" onClick={() => goEvidence(TAB_OF[hdef(h.id).variable])}>
                  {t('card.riskLine', { what: t(h.label as Key), count: h.count, years: h.years })} ▸
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="muted">{t('crop.noRisks')}</p>}
      </section>

      {watch.length > 0 && (
        <section className="block" data-tone="watch">
          <h3 className="block-title"><span aria-hidden="true">◉</span> {t('crop.watch')}</h3>
          <ul className="lines">
            {watch.map((w) => <li key={w.what}><span className="when">{t('card.watchRange', { from: fmt(w.from), to: fmt(w.to) })}</span> {t(w.what as Key)}</li>)}
          </ul>
          <p className="muted small">{t('crop.watchHow')}</p>
        </section>
      )}

      <section className="block">
        <h3 className="block-title">{t('crop.unknown')}</h3>
        <p className="muted">{t('crop.unknown.list')}</p>
        <button type="button" className="btn ghost small-btn" onClick={() => goEvidence('green')}>{t('crop.openEvidence')} ▸</button>
      </section>
    </div>
  )
}
