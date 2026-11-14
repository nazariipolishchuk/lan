// Shared pieces of the field screens: data loading, the farmer's options, message rendering, small controls.
import { useEffect, useMemo, useState } from 'react'
import { loadClimate, loadCrops, loadField, loadRules } from '../data/loader'
import { buildCard, type CardModel, type CardOptions } from '../engine/card'
import type { Msg } from '../engine/explain'
import { completeYears, lastCompleteYear, type Bars as BarValues, type Scenario } from '../engine/score'
import type { ClimateCell, CropId, CropsFile, FieldRecord, RulesFile } from '../engine/types'
import { useT, type Key } from '../i18n'
import { useStore } from '../state/store'

export type Loaded = { field: FieldRecord; cell: ClimateCell; crops: CropsFile; rules: RulesFile }
export type Status = { kind: 'loading' } | { kind: 'missing' } | { kind: 'error' } | { kind: 'ok'; data: Loaded }

/** Load a field with its climate cell and the rules; `retry` re-runs after a failure (state E5). */
export function useFieldData(id: string): { status: Status; retry: () => void } {
  const [status, setStatus] = useState<Status>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let live = true
    setStatus({ kind: 'loading' })
    ;(async () => {
      try {
        const field = await loadField(id)
        if (!field) return live && setStatus({ kind: 'missing' })
        const [cell, crops, rules] = await Promise.all([loadClimate(field.cell, id.startsWith('fixture-')), loadCrops(), loadRules()])
        if (live) setStatus({ kind: 'ok', data: { field, cell, crops, rules } })
      } catch {
        if (live) setStatus({ kind: 'error' })
      }
    })()
    return () => {
      live = false
    }
  }, [id, attempt])
  return { status, retry: () => setAttempt((a) => a + 1) }
}

/** The farmer's inputs that change the answer for this field. */
export function useCardOptions(fieldId: string): CardOptions & { unsafe: boolean } {
  const overrides = useStore((s) => s.user.overrides[fieldId])
  const prefs = useStore((s) => s.user.prefs)
  const scenario = useStore((s) => s.scenario)
  const unsafe = useStore((s) => !!s.user.unsafe[fieldId])
  return useMemo(() => ({ overrides, prefs, scenario: scenario === 'all' ? undefined : scenario, unsafe }), [overrides, prefs, scenario, unsafe])
}

export function useCard(data: Loaded): CardModel {
  const today = useStore((s) => s.today)
  const opts = useCardOptions(data.field.id)
  const { field, cell, crops, rules } = data
  return useMemo(() => buildCard(field, cell, crops, rules, today, opts), [field, cell, crops, rules, today, opts])
}

/** Crop name in the current language, from a crop id. */
export function useCropName(crops: CropsFile) {
  const lang = useStore((s) => s.lang)
  return (id: string) => crops.crops.find((c) => c.id === id)?.name[lang] ?? id
}

/** Render an explanation message: crop ids, hazard and combo label keys are translated. */
export function useMsg(crops: CropsFile) {
  const t = useT()
  const name = useCropName(crops)
  return (m: Msg) => {
    const p: Record<string, string | number> = { ...(m.params ?? {}) }
    if (typeof p.crop === 'string') p.crop = name(p.crop)
    if (typeof p.crops === 'string') p.crops = p.crops.split(' → ').map(name).join(' → ')
    if (typeof p.hazard === 'string') p.hazard = t(p.hazard as Key).toLowerCase()
    if (typeof p.combo === 'string') p.combo = t(p.combo as Key)
    return t(m.key as Key, p)
  }
}

export function useSourceName() {
  const t = useT()
  return (id: string | null) => (id ? t('cmp.source', { s: id === 'kmu164' || id === 'local_n' ? t(`src.${id}` as Key) : id }) : t('cmp.sourceNone'))
}

export function ScenarioSwitch({ cell }: { cell: ClimateCell }) {
  const t = useT()
  const scenario = useStore((s) => s.scenario)
  const setScenario = useStore((s) => s.setScenario)
  const today = useStore((s) => s.today)
  const n = completeYears(cell, lastCompleteYear(cell, today)).length
  const opts: [Scenario, string][] = [['all', t('sc.all', { n })], ['last10', t('sc.last10')], ['dry', t('sc.dry')]]
  return (
    <div className="seg" role="group" aria-label={t('sc.title')} title={t('sc.hint')}>
      <span className="seg-label">{t('sc.title')}</span>
      {opts.map(([id, label]) => (
        <button key={id} type="button" aria-pressed={scenario === id} onClick={() => setScenario(id)}>{label}</button>
      ))}
    </div>
  )
}

const BAR_KEYS = ['water', 'heat', 'soil', 'disease'] as const

/** The four stat bars, each with its word and number (colour is never the only signal). */
export function StatBars({ bars }: { bars: BarValues }) {
  const t = useT()
  return (
    <ul className="statbars">
      {BAR_KEYS.map((k) => (
        <li key={k}>
          <span className="statbar-name">{t(`bar.${k}` as Key)}</span>
          <span className="statbar-track" aria-hidden="true"><span className="statbar-fill" style={{ width: `${Math.round(bars[k])}%` }} data-level={bars[k] < 40 ? 'low' : bars[k] < 70 ? 'mid' : 'high'} /></span>
          <span className="statbar-num">{Math.round(bars[k])}</span>
        </li>
      ))}
    </ul>
  )
}

/** Header row of a panel inside the sheet: title and a back button. */
export function PanelHead({ title, onBack, backLabel }: { title: string; onBack: () => void; backLabel: string }) {
  return (
    <header className="panel-head">
      <button type="button" className="back-btn" onClick={onBack} aria-label={backLabel}>←</button>
      <h2 className="panel-title">{title}</h2>
    </header>
  )
}

export const CROP_ORDER: CropId[] = ['w_wheat', 'w_barley', 's_barley', 'maize', 'sunflower', 'soy', 'sugar_beet', 'w_rape', 'peas', 'chickpea', 'sorghum']
