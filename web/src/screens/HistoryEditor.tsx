// S3 History editor (PLAN §5.4): one row per season with the satellite guess, its confidence and a crop picker.
// Edits stay in this browser, show a farmer mark on the strip, and re-score everything at once.
import { CropIcon } from './CropIcon'
import type { CardModel } from '../engine/card'
import type { CropId, HistClass } from '../engine/types'
import { useT, type Key } from '../i18n'
import { resetOverrides, setOverride } from '../state/persist'
import { useStore } from '../state/store'
import { CROP_ORDER, PanelHead, useCropName, type Loaded } from './common'

const PICK: (CropId | 'fallow')[] = [...CROP_ORDER, 'fallow']

export function HistoryEditor({ data, card }: { data: Loaded; card: CardModel }) {
  const t = useT()
  const openPanel = useStore((s) => s.openPanel)
  const updateUser = useStore((s) => s.updateUser)
  const overrides = useStore((s) => s.user.overrides[data.field.id]) ?? {}
  const name = useCropName(data.crops)
  const { field } = data
  const locked = card.slots.find((s) => s.locked)?.y
  const years = card.seasons.map((s) => s.y).reverse()

  const guess = (y: number) => {
    const item = field.hist.find((h) => h.y === y && h.src !== 'farmer')
    if (!item) return { label: t('card.unknownSeason'), how: t('he.clouds'), sure: false }
    const label = item.k !== 'unknown' ? t(`hist.${item.k as HistClass}` as Key)
      : item.g ? t(`hist.group.${item.g}` as Key) : t('card.unknownSeason')
    const sure = item.k !== 'unknown' && item.p >= 0.6
    const how = item.k === 'unknown' ? (item.g ? t('he.map') : t('he.clouds')) : `${t('he.sat')} · ${sure ? t('he.sure') : t('he.unsure')} ${Math.round(item.p * 100)} %`
    return { label, how, sure }
  }

  return (
    <div className="editor">
      <PanelHead title={t('he.title')} onBack={() => openPanel({ kind: 'card' })} backLabel={t('he.done')} />
      <ul className="he-list">
        {years.map((y) => {
          const g = guess(y)
          const v = overrides[y] ?? ''
          const season = card.seasons.find((s) => s.y === y)
          return (
            <li key={y} className="he-row" data-farmer={!!overrides[y]}>
              <span className="he-year">{y}{y === locked ? <small> · {t('he.inGround')}</small> : null}</span>
              <span className="he-guess">
                {overrides[y] ? <><span aria-hidden="true">🧑‍🌾</span> {overrides[y] === 'unknown' ? t('he.dontKnow') : name(overrides[y] as string)} <small className="muted">{t('he.you')}</small></>
                  : <>{season?.crop ? <CropIcon id={season.crop} size={18} /> : null} {g.label} <small className="muted">{g.how}</small></>}
              </span>
              <label className="sr-only" htmlFor={`he-${y}`}>{t('cmp.pick', { year: y })}</label>
              <select id={`he-${y}`} value={v} onChange={(e) => {
                const val = e.target.value
                updateUser((d) => setOverride(d, field.id, y, val ? (val as CropId | 'unknown') : null))
              }}>
                <option value="">{t('he.keep')}</option>
                {PICK.map((id) => <option key={id} value={id}>{id === 'fallow' ? t('he.fallow') : name(id)}</option>)}
                <option value="unknown">{t('he.dontKnow')}</option>
              </select>
            </li>
          )
        })}
      </ul>
      <div className="editor-foot">
        <button type="button" className="btn ghost" disabled={!Object.keys(overrides).length} onClick={() => updateUser((d) => resetOverrides(d, field.id))}>{t('he.reset')}</button>
        <button type="button" className="btn" onClick={() => openPanel({ kind: 'card' })}>{t('he.done')}</button>
      </div>
      <p className="muted small">{t('he.local')}</p>
    </div>
  )
}
