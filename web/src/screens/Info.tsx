// ⓘ next to a block title: one sentence on what the block means (PLAN 4.6). Tap to open, tap again to close.
// The note is placed in fixed coordinates and kept inside the screen: shifted sideways near an edge and
// flipped above the button when there is no room below.
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useT, type Key } from '../i18n'

const MARGIN = 8

export function Info({ k }: { k: Key }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLSpanElement>(null)
  const id = useId()

  useLayoutEffect(() => {
    if (!open || !btn.current) return
    const place = () => {
      const b = btn.current!.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight
      const width = Math.min(300, vw - 2 * MARGIN)
      const left = Math.min(Math.max(MARGIN, b.left + b.width / 2 - width / 2), vw - width - MARGIN)
      const h = pop.current?.offsetHeight ?? 80
      const top = b.bottom + 6 + h > vh - MARGIN ? Math.max(MARGIN, b.top - 6 - h) : b.bottom + 6
      setPos({ left, top, width })
    }
    place()
    const raf = requestAnimationFrame(place) // second pass with the real height
    return () => cancelAnimationFrame(raf)
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (e.type === 'pointerdown' && (btn.current?.contains(e.target as Node) || pop.current?.contains(e.target as Node))) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('pointerdown', close)
    window.addEventListener('resize', close)
    document.addEventListener('scroll', close, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('resize', close)
      document.removeEventListener('scroll', close, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <span className="info">
      <button ref={btn} type="button" className="info-btn" aria-expanded={open} aria-controls={id} aria-label={t('info.label')}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}>ⓘ</button>
      {open && (
        <span id={id} ref={pop} role="note" className="info-pop"
          style={pos ? { position: 'fixed', left: pos.left, top: pos.top, width: pos.width } : { position: 'fixed', visibility: 'hidden' }}>
          {t(k)}
        </span>
      )}
    </span>
  )
}
