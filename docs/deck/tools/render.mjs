// Render docs/deck/deck.html: one PNG preview per slide (preview/), and Lan-deck.pdf unless PREVIEW_ONLY is set.
// node cdp.mjs render.mjs 1920 7560 1   (BASE_URL=file:///C:/Work/SpaceXChallenge/docs/deck)
import { mkdirSync } from 'node:fs'
const DIR = 'C:/Work/SpaceXChallenge/docs/deck'
export default async (p) => {
  await p.go('/deck.html'); await p.sleep(1500)
  await p.eval('document.fonts.ready.then(() => document.fonts.size)')
  const n = await p.eval('document.querySelectorAll(".slide").length')
  const over = await p.eval(`[...document.querySelectorAll('.slide')].map((s, i) => { const r = s.getBoundingClientRect(); const bad = [...s.querySelectorAll('*')].filter(e => { const b = e.getBoundingClientRect(); return b.width && !e.classList.contains('bleed') && (b.bottom > r.bottom + 1 || b.right > r.right + 1 || b.left < r.left - 1) }).map(e => e.className || e.tagName); return bad.length ? (i + 1) + ':' + bad.slice(0, 4).join('|') : '' }).filter(Boolean).join('  ')`)
  console.log('slides', n, 'overflow:', over || 'none')
  mkdirSync(`${DIR}/preview`, { recursive: true })
  for (let i = 0; i < n; i++) await p.shot(`${DIR}/preview/slide-${i + 1}.png`, { x: 0, y: i * 1080, width: 1920, height: 1080 })
  if (!process.env.PREVIEW_ONLY) await p.pdf(`${DIR}/Lan-deck.pdf`)
}
