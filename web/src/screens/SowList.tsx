// "Sow next" as a ranked ladder (N chose variant A2, 14 Nov): per crop one stacked bar whose four segments
// are the weighted parts of its score (water, heat, soil, disease), and one plain line saying why it ranks
// there. The reason compares the crop with the other candidates: a weakness every crop shares says nothing.
import type { Candidate, CardModel } from '../engine/card'
import { DEFAULT_WEIGHTS, type Bars } from '../engine/score'
import type { CropDef } from '../engine/types'
import { useT, type Key } from '../i18n'
import { CropIcon } from './CropIcon'

export const BAR_KEYS: (keyof Bars)[] = ['water', 'heat', 'soil', 'disease']

export interface Reason { key: Key; vars: Record<string, string | number>; tone: 'go' | 'warn' | 'muted' }

/** Why a crop ranks where it does, in priority order: predecessor, combo, its own strength/weakness. */
export function sowReason(c: Candidate, all: Candidate[], prevCropName: string | null): Reason[] {
  const out: Reason[] = []
  if (c.effect > 0 && prevCropName) out.push({ key: 'sow.why.after', vars: { crop: prevCropName, n: c.effect }, tone: 'go' })
  for (const k of c.combos) out.push({ key: k.sign > 0 ? 'sow.why.combo' : 'sow.why.anti', vars: { what: k.label }, tone: k.sign > 0 ? 'go' : 'warn' })
  const mean = (b: keyof Bars) => all.reduce((a, x) => a + x.bars[b], 0) / Math.max(1, all.length)
  const dev = BAR_KEYS.map((b) => ({ b, d: c.bars[b] - mean(b), v: Math.round(c.bars[b]) }))
  const best = dev.reduce((a, x) => (x.d > a.d ? x : a))
  const worst = dev.reduce((a, x) => (x.d < a.d ? x : a))
  if (all.length > 1 && best.d > 3) out.push({ key: 'sow.why.better', vars: { bar: `bar.${best.b}`, v: best.v }, tone: 'go' })
  if (all.length > 1 && worst.d < -3) out.push({ key: 'sow.why.worse', vars: { bar: `bar.${worst.b}`, v: worst.v }, tone: 'warn' })
  const unk = c.checks.find((k) => k.status === 'unknown')
  if (unk) out.push({ key: 'card.unchecked', vars: { years: (unk.unknownYears ?? []).slice(0, 3).join(', ') }, tone: 'muted' })
  if (!out.length) out.push({ key: 'sow.why.even', vars: {}, tone: 'muted' })
  return out
}

const lower = (x: string) => x.charAt(0).toLowerCase() + x.slice(1)

export function SowList({ list, all, model, cropName, prevName, onOpen }: {
  list: Candidate[]; all: Candidate[]; model: CardModel; cropName: (c: CropDef) => string; prevName: string | null
  onOpen: (c: Candidate) => void
}) {
  const t = useT()
  const tr = (r: Reason) => t(r.key, Object.fromEntries(Object.entries(r.vars).map(([k, v]) => [k, typeof v === 'string' && /^(bar|combo|hz)\./.test(v) ? lower(t(v as Key)) : v])))
  return (
    <div className="ladder" data-target={model.target}>
      <p className="ladder-key" aria-hidden="true">
        {BAR_KEYS.map((b) => <span key={b}><i className={`seg-${b}`} />{t(`bar.${b}` as Key)}</span>)}
      </p>
      <ol>
        {list.map((c) => {
          const reasons = sowReason(c, all, prevName)
          const label = `${cropName(c.crop)}: ${Math.round(c.score)}. ${BAR_KEYS.map((b) => `${t(`bar.${b}` as Key)} ${Math.round(c.bars[b])}`).join(', ')}`
          return (
            <li key={c.crop.id}>
              <span className="ladder-icon" style={{ color: c.crop.colour }}><CropIcon id={c.crop.id} size={26} /></span>
              <span className="ladder-main">
                <button type="button" className="ladder-top" onClick={() => onOpen(c)} aria-label={label}>
                  <b>{cropName(c.crop)}{c.pinned ? <span title={t('card.pinned')}> 📌</span> : null}</b>
                  <span className="ladder-score" title={t('card.scoreHint')}>{Math.round(c.score)}</span>
                </button>
                <span className="stack" title={label}>
                  {BAR_KEYS.map((b) => <i key={b} className={`seg-${b}`} style={{ width: `${c.bars[b] * DEFAULT_WEIGHTS[b]}%` }} />)}
                </span>
                {reasons.slice(0, 2).map((r, i) => <span key={i} className={`ladder-why ${r.tone}`}>{tr(r)}</span>)}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
