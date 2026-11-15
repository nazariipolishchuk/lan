// Geometry of the guide (S9): which part of an element is visible, and where the guide card goes.

export interface Box { x: number; y: number; w: number; h: number }

const GAP = 14 // spotlight edge to the card
const EDGE = 8 // card to the screen edge
const OVERLAP = 24 // how much of a spotlight's lower edge the card may cover rather than jump above it

/** The part of an element that can actually be seen: cut by every scrolling ancestor and by the window. */
export function visibleBox(el: Element, vw: number, vh: number): Box | null {
  const r = el.getBoundingClientRect()
  let x0 = r.left, y0 = r.top, x1 = r.right, y1 = r.bottom
  for (let p = el.parentElement; p; p = p.parentElement) {
    const cs = getComputedStyle(p)
    if (/(auto|scroll|hidden|clip)/.test(cs.overflowY + cs.overflowX)) {
      const c = p.getBoundingClientRect()
      x0 = Math.max(x0, c.left); y0 = Math.max(y0, c.top); x1 = Math.min(x1, c.right); y1 = Math.min(y1, c.bottom)
    }
  }
  x0 = Math.max(x0, 0); y0 = Math.max(y0, 0); x1 = Math.min(x1, vw); y1 = Math.min(y1, vh)
  return x1 - x0 > 4 && y1 - y0 > 4 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null
}

export function unionBox(boxes: Box[]): Box | null {
  if (!boxes.length) return null
  const x0 = Math.min(...boxes.map((b) => b.x)), y0 = Math.min(...boxes.map((b) => b.y))
  const x1 = Math.max(...boxes.map((b) => b.x + b.w)), y1 = Math.max(...boxes.map((b) => b.y + b.h))
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

/**
 * Where the guide card goes. Below the spotlight when it fits (or nearly does), above it otherwise; on a wide
 * screen a spotlight in the right-hand panel gets the card on its left, so the panel stays readable. A spotlight
 * too tall for either gets the card laid over its lower part. With no spotlight the card sits in the middle.
 */
export function placeCard(s: Box | null, cw: number, ch: number, vw: number, vh: number): { top: number; left: number } {
  const clampX = (x: number) => Math.min(Math.max(EDGE, x), vw - cw - EDGE)
  const clampY = (y: number) => Math.min(Math.max(EDGE, y), vh - ch - EDGE)
  if (!s) return { top: clampY((vh - ch) / 2), left: clampX((vw - cw) / 2) }
  const midX = clampX(s.x + s.w / 2 - cw / 2)
  if (vw >= 900 && s.x > vw / 2 && s.x - GAP - cw >= EDGE) return { top: clampY(s.y), left: s.x - GAP - cw }
  const bottom = s.y + s.h
  if (bottom + GAP + ch <= vh - EDGE) return { top: bottom + GAP, left: midX }
  if (vh - EDGE - ch >= bottom - OVERLAP) return { top: vh - EDGE - ch, left: midX }
  if (s.y - GAP - ch >= EDGE) return { top: s.y - GAP - ch, left: midX }
  // neither side quite fits: take the roomier one if it holds most of the card, covering a sliver of the spotlight
  const above = s.y - GAP - EDGE, below = vh - EDGE - bottom - GAP
  if (Math.max(above, below) >= ch * 0.75) return { top: above >= below ? EDGE : vh - EDGE - ch, left: midX }
  return { top: clampY(bottom - ch - 16), left: midX }
}
