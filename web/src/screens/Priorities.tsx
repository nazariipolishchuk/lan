// S4 Priorities and constraints (PLAN §5.5). Farm-wide, stored in this browser; every change re-scores at once.
import { DEFAULT_PRIORITIES, type Priorities as P } from '../engine/prefs'
import type { CropId } from '../engine/types'
import { useT, type Key } from '../i18n'
import { setPrefs } from '../state/persist'
import { useStore } from '../state/store'
import { CROP_ORDER, PanelHead, useCropName, type Loaded } from './common'
import { ICON } from './FieldCard'

export function Priorities({ data }: { data: Loaded }) {
  const t = useT()
  const openPanel = useStore((s) => s.openPanel)
  const prefs = useStore((s) => s.user.prefs)
  const updateUser = useStore((s) => s.updateUser)
  const name = useCropName(data.crops)
  const put = (p: P) => updateUser((d) => setPrefs(d, p))
  const toggle = (list: CropId[], id: CropId) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id])
  const icon = (id: CropId) => ICON[data.crops.crops.find((c) => c.id === id)?.icon ?? '']

  return (
    <div className="editor prefs">
      <PanelHead title={t('pr.title')} onBack={() => openPanel({ kind: 'card' })} backLabel={t('pr.done')} />
      <p className="muted small">{t('pr.note')}</p>

      <fieldset>
        <legend>{t('pr.matters')}</legend>
        {(['water', 'soil', 'risk', 'cash'] as const).map((k) => (
          <label key={k} className="slider">
            <span>{t(`pr.w.${k}` as Key)}</span>
            <input type="range" min={0} max={100} step={10} value={prefs.weights[k]}
              aria-valuetext={`${prefs.weights[k]}`}
              onChange={(e) => put({ ...prefs, weights: { ...prefs.weights, [k]: Number(e.target.value) } })} />
            <span className="slider-ends" aria-hidden="true"><small>{t('pr.less')}</small><small>{t('pr.more')}</small></span>
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>{t('pr.equipment')}</legend>
        {([['beetHarvester', 'pr.e.beet'], ['rowPlanter', 'pr.e.row'], ['dryer', 'pr.e.dryer']] as const).map(([k, label]) => (
          <label key={k} className="toggle">
            <input type="checkbox" checked={prefs.equipment[k]} onChange={(e) => put({ ...prefs, equipment: { ...prefs.equipment, [k]: e.target.checked } })} />
            <span>{t(label)}</span>
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>{t('pr.water')}</legend>
        <label className="toggle">
          <input type="checkbox" checked={prefs.irrigation} onChange={(e) => put({ ...prefs, irrigation: e.target.checked })} />
          <span>{t('pr.irrigation')}</span>
        </label>
      </fieldset>

      <fieldset>
        <legend>{t('pr.market')} · {t('pr.keep')}</legend>
        <table className="croptable">
          <thead><tr><th scope="col" /><th scope="col">{t('pr.market')}</th><th scope="col">{t('pr.pin')}</th><th scope="col">{t('pr.ban')}</th></tr></thead>
          <tbody>
            {CROP_ORDER.map((id) => (
              <tr key={id}>
                <th scope="row"><span aria-hidden="true">{icon(id)}</span> {name(id)}</th>
                <td><input type="checkbox" aria-label={`${t('pr.market')}: ${name(id)}`} checked={prefs.sell[id] !== false}
                  onChange={(e) => put({ ...prefs, sell: { ...prefs.sell, [id]: e.target.checked } })} /></td>
                <td><input type="checkbox" aria-label={`${t('pr.pin')}: ${name(id)}`} checked={prefs.pin.includes(id)}
                  onChange={() => put({ ...prefs, pin: toggle(prefs.pin, id), ban: prefs.ban.filter((x) => x !== id) })} /></td>
                <td><input type="checkbox" aria-label={`${t('pr.ban')}: ${name(id)}`} checked={prefs.ban.includes(id)}
                  onChange={() => put({ ...prefs, ban: toggle(prefs.ban, id), pin: prefs.pin.filter((x) => x !== id) })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </fieldset>

      <div className="editor-foot">
        <button type="button" className="btn ghost" onClick={() => put(DEFAULT_PRIORITIES)}>{t('pr.reset')}</button>
        <button type="button" className="btn" onClick={() => openPanel({ kind: 'card' })}>{t('pr.done')}</button>
      </div>
    </div>
  )
}
