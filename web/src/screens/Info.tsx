// ⓘ next to a block title: one sentence on what the block means (PLAN 4.6). Tap to open, tap again to close.
import { useId, useState } from 'react'
import { useT, type Key } from '../i18n'

export function Info({ k }: { k: Key }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <span className="info">
      <button type="button" className="info-btn" aria-expanded={open} aria-controls={id} aria-label={t('info.label')}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}>ⓘ</button>
      {open && <span id={id} role="note" className="info-pop">{t(k)}</span>}
    </span>
  )
}
