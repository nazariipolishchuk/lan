// Over-the-map controls (§5.3): settlement search, "locate me", layer chips and the legend.
import { useEffect, useRef, useState } from 'react'
import { DATA_BASE, US_DATA_BASE, parseMaybeGzip } from '../data/loader'
import { useT } from '../i18n'
import { OBLAST_BY_CODE, US_STATES, oblastName } from '../i18n/oblasts'
import { useStore } from '../state/store'
import { MAP_LAYERS, legend, type MapLayer } from './layers'
import { buildIndex, searchPlaces, type Place, type PlaceIndex } from './search'

let indexPromise: Promise<PlaceIndex> | null = null
function placeIndex(): Promise<PlaceIndex> {
  if (!indexPromise) {
    const one = (base: string) => fetch(`${base}/places.json.gz`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.arrayBuffer()
      })
      .then((b) => parseMaybeGzip(b))
      .then((d) => (d as { places: Place[] }).places)
    indexPromise = Promise.all([
      one(DATA_BASE),
      US_DATA_BASE ? one(US_DATA_BASE).catch(() => [] as Place[]) : Promise.resolve([] as Place[]),
    ]).then(([ua, us]) => buildIndex([...ua, ...us.map((p) => [p[0], p[1], p[2], p[3], `us${p[4]}`, p[5]] as Place)]))
    indexPromise.catch(() => {
      indexPromise = null // allow a retry
    })
  }
  return indexPromise
}

const LAYER_KEY: Record<MapLayer, 'layer.none' | 'layer.last' | 'layer.drought' | 'layer.rotation'> = {
  none: 'layer.none', last: 'layer.last', drought: 'layer.drought', rotation: 'layer.rotation',
}

export function MapControls({ focusSearch = 0 }: { focusSearch?: number }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const theme = useStore((s) => s.theme)
  const mapLayer = useStore((s) => s.mapLayer)
  const setMapLayer = useStore((s) => s.setMapLayer)
  const setFlyTo = useStore((s) => s.setFlyTo)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [active, setActive] = useState(0)
  const [locMsg, setLocMsg] = useState<string | null>(null)
  const [legendOpen, setLegendOpen] = useState(true)
  const [legendMore, setLegendMore] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (focusSearch) input.current?.focus()
  }, [focusSearch])

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([])
      return
    }
    let alive = true
    setState('loading')
    placeIndex()
      .then((ix) => {
        if (!alive) return
        setResults(searchPlaces(ix, q))
        setActive(0)
        setState('idle')
      })
      .catch(() => alive && setState('error'))
    return () => {
      alive = false
    }
  }, [q])

  const choose = (p: Place) => {
    setFlyTo({ lon: p[2], lat: p[3], zoom: 13 })
    setQ('')
    setResults([])
    input.current?.blur()
  }

  const locate = () => {
    setLocMsg(null)
    if (!navigator.geolocation) return setLocMsg(t('map.locateNo'))
    navigator.geolocation.getCurrentPosition(
      (pos) => setFlyTo({ lon: pos.coords.longitude, lat: pos.coords.latitude, zoom: 14 }),
      // E7: denied or unavailable → say so once; search stays available
      () => setLocMsg(t('map.locateDenied')),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    )
  }

  const lg = legend(mapLayer, theme)
  const name = (p: Place) => (lang === 'uk' ? p[1] : p[0])
  const other = (p: Place) => (lang === 'uk' ? p[0] : p[1])
  return (
    <div className="map-controls">
      <div className="search-row">
        <div className="search" role="combobox" aria-expanded={results.length > 0} aria-haspopup="listbox" aria-owns="search-list">
          <span className="search-icon" aria-hidden="true">⌕</span>
          <input ref={input} type="search" value={q} placeholder={t('top.search')} aria-label={t('top.search')}
            aria-autocomplete="list" aria-controls="search-list" autoComplete="off" spellCheck={false}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
              else if (e.key === 'Enter' && results[active]) choose(results[active])
              else if (e.key === 'Escape') { setQ(''); setResults([]) }
            }} />
          {(results.length > 0 || (q.trim().length >= 2 && state !== 'loading')) && (
            <ul className="search-list" id="search-list" role="listbox">
              {results.map((p, i) => (
                <li key={`${p[0]}-${p[2]}-${p[3]}`} role="option" aria-selected={i === active}>
                  <button type="button" onPointerDown={(e) => e.preventDefault()} onClick={() => choose(p)}>
                    <b>{name(p)}</b> <span>{other(p) !== name(p) ? other(p) : ''}</span>
                    <small>{p[4].startsWith('us') ? oblastName(US_STATES[p[4].slice(2)] ?? '', lang) + (lang === 'uk' ? ', США' : ', USA') : OBLAST_BY_CODE[p[4]] ? oblastName(OBLAST_BY_CODE[p[4]], lang) : ''}</small>
                  </button>
                </li>
              ))}
              {!results.length && <li className="search-empty">{state === 'error' ? t('map.searchError') : t('map.searchNone')}</li>}
            </ul>
          )}
        </div>
        <button type="button" className="locate-btn" onClick={locate} aria-label={t('map.locate')} title={t('map.locate')}>
          <span aria-hidden="true">◎</span>
        </button>
      </div>
      {locMsg && <p className="map-msg" role="status">{locMsg}</p>}
      <div className="layer-chips" role="group" aria-label={t('layer.group')}>
        {MAP_LAYERS.map((l) => (
          <button key={l} type="button" className="layer-chip" aria-pressed={mapLayer === l}
            onClick={() => { setMapLayer(l); setLegendOpen(true) }}>
            {t(LAYER_KEY[l])}
          </button>
        ))}
      </div>
      {lg && legendOpen && (
        <div className="legend" role="note" data-open={legendMore}>
          <div className="legend-head">
            <b>{t(lg.title)}</b>
            <button type="button" className="legend-x" aria-label={t('card.close')} onClick={() => setLegendOpen(false)}>×</button>
          </div>
          <p className="legend-text">{t(lg.what)}</p>
          <ul>
            {lg.swatches.map((s) => (
              <li key={s.label}><i style={{ background: s.color }} aria-hidden="true" />{t(s.label)}</li>
            ))}
          </ul>
          <p className="legend-note legend-text">{t(lg.unknown)}</p>
          <button type="button" className="legend-more" aria-expanded={legendMore} onClick={() => setLegendMore((v) => !v)}>
            {legendMore ? t('card.collapse') : t('card.expand')}
          </button>
        </div>
      )}
    </div>
  )
}
