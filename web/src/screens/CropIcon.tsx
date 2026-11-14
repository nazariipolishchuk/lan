// Crop pictograms (P4 redesign, N: "no emoji; cereals must be told apart").
// One line-drawing per crop on a 24-unit grid, 1.5 stroke, in currentColor, like the plates of a field
// guide. Cereals differ by the ear itself: wheat = plump grains with short awns, barley = slim grains
// with long awns, sorghum = a loose panicle. Winter and spring crops carry a small mark in the lower
// right corner (a six-ray frost star or a sun), the same signs the history strip uses.
import type { ReactNode } from 'react'
import type { CropId } from '../engine/types'

const g = (k: string, children: ReactNode) => <g key={k}>{children}</g>

/** Ear of plump grains: pairs of grains along the rachis, set at ±32°. */
function ear(cx: number, top: number, n: number, rx: number, ry: number, gap: number, awn: number) {
  const out: ReactNode[] = [<path key="r" d={`M${cx} ${top + 1} V${top + n * gap + 4}`} />]
  for (let i = 0; i < n; i++) {
    const y = top + 2.5 + i * gap
    out.push(<ellipse key={`l${i}`} cx={cx - rx * 0.95} cy={y} rx={rx} ry={ry} transform={`rotate(-32 ${cx - rx * 0.95} ${y})`} />)
    out.push(<ellipse key={`r${i}`} cx={cx + rx * 0.95} cy={y} rx={rx} ry={ry} transform={`rotate(32 ${cx + rx * 0.95} ${y})`} />)
    if (awn > 0) {
      out.push(<path key={`al${i}`} d={`M${cx - rx * 1.6} ${y - ry * 0.8} l${-awn * 0.42} ${-awn}`} />)
      out.push(<path key={`ar${i}`} d={`M${cx + rx * 1.6} ${y - ry * 0.8} l${awn * 0.42} ${-awn}`} />)
    }
  }
  out.push(<ellipse key="t" cx={cx} cy={top + 0.6} rx={rx * 0.8} ry={ry} />)
  return out
}

/** Barley ear: slim grains in two rows, each with a long awn running up nearly parallel to the ear. */
function barley(cx: number) {
  const out: ReactNode[] = [<path key="r" d={`M${cx} 7.6V19.6`} />]
  for (let i = 0; i < 4; i++) {
    const y = 9.4 + i * 2.6
    out.push(<ellipse key={`l${i}`} cx={cx - 1} cy={y} rx="0.85" ry="1.8" transform={`rotate(-24 ${cx - 1} ${y})`} />)
    out.push(<ellipse key={`r${i}`} cx={cx + 1} cy={y} rx="0.85" ry="1.8" transform={`rotate(24 ${cx + 1} ${y})`} />)
    out.push(<path key={`a${i}`} d={`M${cx - 1.6} ${y - 1.6} L${cx - 3.4 - i * 0.3} ${1.2 + i * 0.4}M${cx + 1.6} ${y - 1.6} L${cx + 3.4 + i * 0.3} ${1.2 + i * 0.4}`} strokeWidth={1.1} />)
  }
  out.push(<path key="ta" d={`M${cx} 7.6V1`} strokeWidth={1.1} />)
  return out
}

const FROST = (
  <g className="mark" strokeWidth={1.2}>
    <path d="M20 15.2v6.4M17.2 16.8l5.6 3.2M17.2 20l5.6-3.2" />
  </g>
)
const SUN = (
  <g className="mark" strokeWidth={1.2}>
    <circle cx="20" cy="18.4" r="1.7" />
    <path d="M20 14.8v.8M20 21.2v.8M16.4 18.4h.8M22.8 18.4h.8M17.5 15.9l.5.5M22 20.4l.5.5M17.5 20.9l.5-.5M22 16.4l.5-.5" />
  </g>
)

const ICONS: Record<CropId, ReactNode> = {
  // winter wheat: plump grains, short awns
  w_wheat: [g('ear', ear(10, 2.5, 4, 1.35, 2.1, 3.1, 1.2)), g('st', <path d="M10 18.2V22.5" />), g('m', FROST)],
  // winter barley: slim grains, long awns
  w_barley: [g('ear', barley(10)), g('st', <path d="M10 19.5V22.5" />), g('m', FROST)],
  // spring barley: the same ear, spring mark
  s_barley: [g('ear', barley(10)), g('st', <path d="M10 19.5V22.5" />), g('m', SUN)],
  // maize: cob with kernel rows, two husk leaves
  maize: [
    g('cob', <path d="M12 2.6c2.6 0 3.6 3.4 3.6 7.6s-1 8.3-3.6 8.3-3.6-4.1-3.6-8.3 1-7.6 3.6-7.6z" />),
    g('rows', <path d="M10.2 5.2c1.2.8 2.4.8 3.6 0M9.1 8.8c1.9 1 3.9 1 5.8 0M9.1 12.4c1.9 1 3.9 1 5.8 0M9.6 15.8c1.6.8 3.2.8 4.8 0M12 3v15" />),
    g('husk', <path d="M8.6 10.5C6.3 13.4 6 17.6 8.4 21.4c1.4-2.6 2.6-3.7 3.6-3.9M15.4 10.5c2.3 2.9 2.6 7.1.2 10.9-1.4-2.6-2.6-3.7-3.6-3.9" />),
  ],
  // sunflower: seed disc and petals
  sunflower: [
    g('disc', <circle cx="12" cy="10" r="3.6" />),
    g('seeds', <circle cx="12" cy="10" r="1.6" strokeWidth={1} />),
    g('petals', Array.from({ length: 10 }, (_, i) => {
      const a = (i * 36 * Math.PI) / 180
      const x = 12 + Math.cos(a) * 6.4
      const y = 10 + Math.sin(a) * 6.4
      return <ellipse key={i} cx={x} cy={y} rx="1.35" ry="2.5" transform={`rotate(${i * 36 + 90} ${x} ${y})`} />
    })),
    g('st', <path d="M12 17v5.5" />),
  ],
  // soybean: hairy three-bean pod and a trifoliate leaf
  soy: [
    g('pod', <path d="M5.2 19.6c-.9-2.4 1-3.6 2.8-4.6 1.9-1 2.2-3.4 4-4.6 1.9-1.2 3.4-1 4.4-2.6 1-1.6 1.4-3.6 3.2-3.6.2 2.6-.4 5.6-2.4 7.6-1.8 1.8-3.4 2-4.8 3.6-1.5 1.6-2.4 3.6-4.8 4.4-1.2.4-2.2.2-2.4-.2z" />),
    g('beans', <path d="M8.4 17.1h.01M12.2 13.3h.01M16.1 9.4h.01" strokeWidth={2.4} />),
    g('leaf', <path d="M5.4 9.8C3.2 8.9 2.6 6.3 4 4.6c1.6.9 2.3 3.3 1.4 5.2zM5.4 9.8c-.1-2.6 1.4-4.6 3.6-4.8.4 2-1.2 4.4-3.6 4.8zM5.4 9.8c1.6 1.1 3.8.7 4.8-.9" />),
  ],
  // sugar beet: tapering root with leaves
  sugar_beet: [
    g('root', <path d="M12 23c-.5-2.4-4.6-5.2-4.6-8.8 0-2.5 2-3.9 4.6-3.9s4.6 1.4 4.6 3.9c0 3.6-4.1 6.4-4.6 8.8z" />),
    g('rings', <path d="M9.4 14.2c1.6.6 3.6.6 5.2 0M10.4 17.4c1 .4 2.2.4 3.2 0" strokeWidth={1} />),
    g('leaves', <path d="M11 10.4C9.6 7.4 6.4 6.4 4.6 7.2c.6 2.6 3.6 3.9 6.4 3.2zM12 10.2c-.6-3.4.6-6.6 2.4-7.6 1.4 2 .8 5.4-2.4 7.6zM13 10.6c2.2-2 5.4-2.2 6.8-.9-1.2 2.2-4.4 2.4-6.8.9z" />),
  ],
  // winter rapeseed: four-petal flowers on a raceme, slim pods
  w_rape: [
    g('stem', <path d="M11 22.5V7.4M11 17.4 7.4 12.6M11 14.2l3.8-4.6" />),
    g('pods', <path d="M7.4 12.6 6.4 9.8M14.8 9.6l.6-2.8" strokeWidth={2} />),
    g('flowers', [[11, 4.4, 1.5], [7.2, 6.6, 1.15], [15.2, 4.6, 1.15]].map(([x, y, r], i) => (
      <g key={i}>
        <circle cx={x} cy={y - r} r={r * 0.62} /><circle cx={x} cy={y + r} r={r * 0.62} />
        <circle cx={x - r} cy={y} r={r * 0.62} /><circle cx={x + r} cy={y} r={r * 0.62} />
      </g>
    ))),
    g('m', FROST),
  ],
  // field peas: open pod with round peas and a tendril
  peas: [
    g('pod', <path d="M3.2 15.6c3.4 3.6 11.6 3.6 17.4-4.4-1.4-.4-2.6 0-3.6.8-3.6 3-8.4 4.4-13.8 3.6z" />),
    g('peas', [6.8, 10, 13.2, 16.2].map((x, i) => <circle key={i} cx={x} cy={15.6 - i * 0.9} r="1.35" />)),
    g('tendril', <path d="M17.6 10.8c.6-2.4-.2-4.6-2-5.2-1.6-.5-2.8.8-2.2 2 .6 1.1 2 .7 2-.4" />),
  ],
  // chickpea: one inflated, beaked pod and serrated leaflets
  chickpea: [
    g('seed', <path d="M6.8 12.2c1.2-1.6 3-2.4 5-2.2 3.6.3 5.6 3.2 5.2 6.4-.4 3.4-3.4 5.6-6.6 5.2-3.2-.4-5.2-3.2-4.8-6.2l-1.4-1.8 2.6-1.4z" />),
    g('crease', <path d="M8.8 13.8c1.6 1.2 2 3.4 1.2 5.4" strokeWidth={1.1} />),
    g('leaf', <path d="M14.6 9.4 19.4 2.8" strokeWidth={1.1} />),
    g('leaflets', [[15.6, 7.6], [16.9, 5.8], [18.2, 4]].map(([x, y], i) => (
      <g key={i}><ellipse cx={x - 1.3} cy={y - 0.4} rx="0.7" ry="1.1" transform={`rotate(-50 ${x - 1.3} ${y - 0.4})`} /><ellipse cx={x + 1.1} cy={y + 0.6} rx="0.7" ry="1.1" transform={`rotate(40 ${x + 1.1} ${y + 0.6})`} /></g>
    ))),
  ],
  // sorghum: loose panicle of round grains
  sorghum: [
    g('head', <path d="M12 1.8c2.4 0 3.6 2.6 3.6 5.4S14.2 12.4 12 12.4 8.4 10 8.4 7.2 9.6 1.8 12 1.8z" />),
    g('grains', [[12, 4], [10.4, 6.2], [13.6, 6.2], [12, 8.2], [10.6, 9.8], [13.4, 9.8]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="0.85" />)),
    g('st', <path d="M12 12.4V22.5" />),
    g('leaf', <path d="M12 18c-2-2.6-5.2-3.6-8.4-3 1.6 2.6 4.8 3.8 8.4 3zM12 15.4c2.2-2.2 5.4-2.8 8.4-1.8-1.8 2.4-5.2 3.2-8.4 1.8z" />),
  ],
  // fallow: ploughed soil, no crop
  fallow: [
    g('furrows', <path d="M2.5 13.5c2.4-1.4 4.6-1.4 6.8 0s4.6 1.4 6.8 0 3.6-1.2 5.4-.4M2.5 17.5c2.4-1.4 4.6-1.4 6.8 0s4.6 1.4 6.8 0 3.6-1.2 5.4-.4M2.5 21.5c2.4-1.4 4.6-1.4 6.8 0s4.6 1.4 6.8 0 3.6-1.2 5.4-.4" />),
    g('clods', <path d="M6 9.4h.01M12.2 8.6h.01M17.6 9.6h.01" strokeWidth={2.2} />),
  ],
  // cover crop: a seedling over the soil line
  cover: [
    g('soil', <path d="M3 19.5h18" />),
    g('sprout', <path d="M12 19.5V10M12 13.4C11.6 9.6 8.6 7.6 5.4 8c.4 3.4 3.4 5.4 6.6 5.4zM12 11.6c.6-3.4 3.4-5.4 6.8-5-.4 3.4-3.4 5.2-6.8 5z" />),
  ],
}

/** The crop's pictogram; `title` turns it into an image with a name, otherwise it is decorative. */
export function CropIcon({ id, size = 20, title, className }: { id: CropId | null | undefined; size?: number; title?: string; className?: string }) {
  const body = id ? ICONS[id] : null
  return (
    <svg className={`crop-icon${className ? ` ${className}` : ''}`} width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
      role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      {body ?? <path d="M9.4 9.2a2.6 2.6 0 1 1 3.6 2.4c-.7.3-1 .8-1 1.6M12 16.6h.01" />}
    </svg>
  )
}

/** Group signs for seasons known only as winter / summer / not cultivated. */
export function GroupIcon({ group, size = 20 }: { group: 'winter' | 'summer' | 'uncultivated' | null | undefined; size?: number }) {
  return (
    <svg className="crop-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {group === 'winter' ? <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M10 4.6l2 1.6 2-1.6M10 19.4l2-1.6 2 1.6" />
        : group === 'summer' ? <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M5.3 18.7 7 17M17 7l1.7-1.7" /></>
        : group === 'uncultivated' ? ICONS.fallow
        : <path d="M9.4 9.2a2.6 2.6 0 1 1 3.6 2.4c-.7.3-1 .8-1 1.6M12 16.6h.01" />}
    </svg>
  )
}

export const CROP_ICON_IDS = Object.keys(ICONS) as CropId[]
