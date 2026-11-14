import * as maplibregl from 'maplibre-gl'
import type { MapGeoJSONFeature } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { Protocol } from 'pmtiles'
import type { FeatureCollection } from 'geojson'
import { useEffect, useRef, useState } from 'react'
import { loadOblasts, loadTileSets } from '../data/loader'
import { decodeFieldId } from '../engine/fieldId'
import { useT, type Key } from '../i18n'
import { useStore } from '../state/store'
import { fieldColor, oblastColor, type MapLayer } from './layers'
import { PALETTES, baseStyle, type Theme } from './style'

export const FIELDS_MIN_ZOOM = 11
let protocolAdded = false
// MapLibre looks for its worker next to its own module; bundling moves the module, so point at the file
maplibregl.setWorkerUrl(new URL(workerUrl, window.location.href).href)

type TileSet = { code: string; url: string }
type Hover = { source: string; id: string }
interface Tip { x: number; y: number; ha: number; lg: number; dr: number; rh: number }

const src = (code: string) => `fields-${code}`
const lid = (code: string, part: 'fill' | 'line' | 'hover' | 'sel') => `fields-${code}-${part}`

export function MapView() {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const sets = useRef<TileSet[]>([])
  const oblasts = useRef<FeatureCollection | null>(null)
  const hovered = useRef<Hover | null>(null)
  const [zoom, setZoom] = useState(9)
  const [tip, setTip] = useState<Tip | null>(null)
  const lang = useStore((s) => s.lang)
  const theme = useStore((s) => s.theme)
  const selectedId = useStore((s) => s.selectedId)
  const mapLayer = useStore((s) => s.mapLayer)
  const flyTo = useStore((s) => s.flyTo)
  const t = useT()

  useEffect(() => {
    if (!protocolAdded) {
      maplibregl.addProtocol('pmtiles', new Protocol().tile)
      protocolAdded = true
    }
    const start = selectedId ? decodeFieldId(selectedId) : null
    const m = new maplibregl.Map({
      container: el.current!,
      style: baseStyle(useStore.getState().lang, useStore.getState().theme),
      ...(start ? { center: [start.lon, start.lat] as [number, number], zoom: 13.5 }
        : { bounds: [[22.1, 44.3], [40.3, 52.4]] as [[number, number], [number, number]], fitBoundsOptions: { padding: window.innerWidth < 640 ? { top: 180, bottom: 40, left: 10, right: 10 } : { top: 40, bottom: 40, left: 380, right: 20 } } }),
      maxZoom: 16,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    })
    m.touchZoomRotate.disableRotation()
    map.current = m
    if (import.meta.env.DEV) (window as unknown as { __lanMap: maplibregl.Map }).__lanMap = m
    setZoom(m.getZoom())
    m.on('zoom', () => setZoom(m.getZoom()))
    // the compact attribution opens itself on load; on phones it covers the bottom of the map
    m.once('load', () => {
      if (window.innerWidth < 900) el.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show')
    })
    const addAll = () => {
      const s = useStore.getState()
      addOblasts(m, oblasts.current, s.theme, s.mapLayer)
      for (const ts of sets.current) addFields(m, ts, s.theme, s.mapLayer)
    }
    m.on('style.load', () => {
      hovered.current = null // feature state does not survive a style swap
      addAll()
    })
    Promise.all([loadTileSets(), loadOblasts()]).then(([ts, ob]) => {
      sets.current = ts
      oblasts.current = ob
      // the data can arrive before or after the style: add as soon as both are there
      const tryAdd = () => {
        if (!map.current) return
        if (m.style && m.isStyleLoaded()) addAll()
        else window.setTimeout(tryAdd, 100)
      }
      tryAdd()
    })
    // Hover: one query per animation frame, painted through feature-state (no layer rebuild), and only at
    // zooms where fields are drawn. setFilter per hovered field re-parsed every tile and left a lagging trail.
    let pending: maplibregl.MapMouseEvent | null = null
    let frame = 0
    const clearHover = () => {
      setHover(m, hovered, null)
      m.getCanvas().style.cursor = ''
      setTip(null)
    }
    const onMove = () => {
      frame = 0
      const e = pending
      pending = null
      if (!e) return
      if (m.getZoom() < FIELDS_MIN_ZOOM) {
        clearHover()
        if (m.getLayer('oblasts-fill') && m.queryRenderedFeatures(e.point, { layers: ['oblasts-fill'] }).length) m.getCanvas().style.cursor = 'zoom-in'
        return
      }
      const f = fieldAt(m, e.point, sets.current)
      if (!f) return clearHover()
      setHover(m, hovered, { source: f.source, id: String(f.properties.id) })
      m.getCanvas().style.cursor = 'pointer'
      const p = f.properties
      setTip({ x: e.point.x, y: e.point.y, ha: Number(p.ha), lg: Number(p.lg ?? -1), dr: Number(p.dr ?? -1), rh: Number(p.rh ?? -1) })
    }
    m.on('mousemove', (e) => {
      pending = e
      if (!frame) frame = requestAnimationFrame(onMove)
    })
    m.getCanvas().addEventListener('mouseleave', clearHover)
    m.on('zoom', () => {
      if (m.getZoom() < FIELDS_MIN_ZOOM && hovered.current) clearHover()
    })
    m.on('movestart', () => setTip(null))
    m.on('click', (e) => {
      if (m.getZoom() < FIELDS_MIN_ZOOM) {
        // small scale: a tap on an oblast flies into it
        const ob = m.getLayer('oblasts-fill') ? m.queryRenderedFeatures(e.point, { layers: ['oblasts-fill'] })[0] : undefined
        if (ob) m.flyTo({ center: e.lngLat, zoom: Math.max(m.getZoom() + 2.5, 8.5) })
        return
      }
      const f = fieldAt(m, e.point, sets.current)
      useStore.getState().select(f ? String(f.properties.id) : null)
    })
    return () => m.remove()
    // the map is created once; later changes go through the effects below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // language or theme: swap the basemap style (fields are re-added on style.load)
  const first = useRef(`${lang}/${theme}`)
  useEffect(() => {
    if (`${lang}/${theme}` === first.current) return
    map.current?.setStyle(baseStyle(lang, theme))
    first.current = `${lang}/${theme}`
  }, [lang, theme])

  // active layer: recolour fields and oblasts in place
  useEffect(() => {
    const m = map.current
    if (!m || !m.isStyleLoaded()) return
    paintLayer(m, sets.current, theme, mapLayer)
  }, [mapLayer, theme])

  // selection outline
  useEffect(() => {
    const m = map.current
    if (!m) return
    const apply = () => {
      for (const ts of sets.current) if (m.getLayer(lid(ts.code, 'sel'))) m.setFilter(lid(ts.code, 'sel'), ['==', ['get', 'id'], selectedId ?? ''])
    }
    if (m.isStyleLoaded()) apply()
    else m.once('idle', apply)
    // a field chosen outside the map (demo, link, history) that is not on screen: fly to it
    const c = selectedId ? decodeFieldId(selectedId) : null
    if (c && (m.getZoom() < FIELDS_MIN_ZOOM || !m.getBounds().contains([c.lon, c.lat]))) {
      m.flyTo({ center: [c.lon, c.lat], zoom: 13.5, essential: true })
    }
  }, [selectedId])

  // search result or "locate me"
  useEffect(() => {
    const m = map.current
    if (!m || !flyTo) return
    m.flyTo({ center: [flyTo.lon, flyTo.lat], zoom: flyTo.zoom, essential: true })
    useStore.getState().setFlyTo(null)
  }, [flyTo])

  const nf = (v: number, d = 1) => v.toLocaleString(lang === 'uk' ? 'uk-UA' : 'en-GB', { maximumFractionDigits: d })
  return (
    <div className="map-wrap">
      <div ref={el} className="map" role="application" aria-label={t('map.label')} />
      {zoom < FIELDS_MIN_ZOOM && <div className="map-hint">{t('map.zoomIn')}</div>}
      {tip && (
        <div className="map-tip" style={tipPosition(tip, el.current)}>
          {nf(tip.ha)} {t('card.ha')}
          {mapLayer === 'last' && <> · {t(LG_LABEL[tip.lg] ?? 'layer.unknown')}</>}
          {mapLayer === 'drought' && <> · {tip.dr >= 0 ? t('layer.droughtTip', { n: tip.dr }) : t('layer.unknown')}</>}
          {mapLayer === 'rotation' && <> · {tip.rh >= 0 ? t('layer.rotationTip', { n: tip.rh }) : t('layer.unknown')}</>}
        </div>
      )}
    </div>
  )
}

/** Tooltip beside the cursor, flipped to the other side near the right or bottom edge so it never leaves the map. */
function tipPosition(tip: Tip, box: HTMLElement | null): React.CSSProperties {
  const w = box?.clientWidth ?? window.innerWidth
  const h = box?.clientHeight ?? window.innerHeight
  const right = tip.x > w - 240
  const bottom = tip.y > h - 60
  return {
    ...(right ? { right: w - tip.x + 14 } : { left: tip.x + 14 }),
    ...(bottom ? { bottom: h - tip.y + 14 } : { top: tip.y + 14 }),
  }
}

const LG_LABEL: Record<number, Key> = { 0: 'layer.winter', 1: 'layer.summer', 2: 'layer.fallow' }

function fieldAt(m: maplibregl.Map, point: maplibregl.PointLike, sets: TileSet[]): MapGeoJSONFeature | undefined {
  const layers = sets.map((s) => lid(s.code, 'fill')).filter((l) => m.getLayer(l))
  return layers.length ? (m.queryRenderedFeatures(point, { layers })[0] as MapGeoJSONFeature | undefined) : undefined
}

function setHover(m: maplibregl.Map, ref: { current: Hover | null }, h: Hover | null) {
  if (ref.current?.id === h?.id && ref.current?.source === h?.source) return
  if (ref.current && m.getSource(ref.current.source)) {
    m.setFeatureState({ source: ref.current.source, sourceLayer: 'fields', id: ref.current.id }, { hover: false })
  }
  ref.current = h && m.getSource(h.source) ? h : null
  if (ref.current) m.setFeatureState({ source: ref.current.source, sourceLayer: 'fields', id: ref.current.id }, { hover: true })
}

function fillOpacity(layer: MapLayer): maplibregl.ExpressionSpecification {
  return layer === 'none'
    ? ['interpolate', ['linear'], ['zoom'], FIELDS_MIN_ZOOM, 0.06, 14, 0.14]
    : ['interpolate', ['linear'], ['zoom'], FIELDS_MIN_ZOOM, 0.55, 14, 0.62]
}

function paintLayer(m: maplibregl.Map, sets: TileSet[], theme: Theme, layer: MapLayer) {
  const p = PALETTES[theme]
  for (const ts of sets) {
    const id = lid(ts.code, 'fill')
    if (!m.getLayer(id)) continue
    m.setPaintProperty(id, 'fill-color', fieldColor(layer, theme, p.field))
    m.setPaintProperty(id, 'fill-opacity', fillOpacity(layer))
  }
  if (m.getLayer('oblasts-fill')) {
    m.setPaintProperty('oblasts-fill', 'fill-color', oblastColor(layer, theme))
    m.setPaintProperty('oblasts-fill', 'fill-opacity', layer === 'none' ? 0 : 0.5)
  }
}

function addOblasts(m: maplibregl.Map, data: FeatureCollection | null, theme: Theme, layer: MapLayer) {
  if (!data || m.getSource('oblasts')) return
  m.addSource('oblasts', { type: 'geojson', data, attribution: 'geoBoundaries (OpenStreetMap, ODbL)' })
  m.addLayer({
    id: 'oblasts-fill', type: 'fill', source: 'oblasts', maxzoom: FIELDS_MIN_ZOOM,
    paint: { 'fill-color': oblastColor(layer, theme), 'fill-opacity': layer === 'none' ? 0 : 0.5 },
  }, 'places')
}

function addFields(m: maplibregl.Map, ts: TileSet, theme: Theme, layer: MapLayer) {
  const p = PALETTES[theme]
  const s = src(ts.code)
  if (m.getSource(s)) return
  m.addSource(s, {
    type: 'vector', url: `pmtiles://${ts.url}`,
    promoteId: 'id', // our string field id becomes the feature id, so hover can use feature-state
    attribution: 'Fields of The World (CC-BY-4.0)',
  })
  const before = 'places'
  m.addLayer({
    id: lid(ts.code, 'fill'), type: 'fill', source: s, 'source-layer': 'fields', minzoom: FIELDS_MIN_ZOOM,
    paint: { 'fill-color': fieldColor(layer, theme, p.field), 'fill-opacity': fillOpacity(layer) },
  }, before)
  m.addLayer({
    id: lid(ts.code, 'line'), type: 'line', source: s, 'source-layer': 'fields', minzoom: FIELDS_MIN_ZOOM,
    paint: { 'line-color': p.field, 'line-opacity': ['interpolate', ['linear'], ['zoom'], FIELDS_MIN_ZOOM, 0.35, 14, 0.8], 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.4, 15, 1.4] },
  }, before)
  m.addLayer({
    id: lid(ts.code, 'hover'), type: 'line', source: s, 'source-layer': 'fields', minzoom: FIELDS_MIN_ZOOM,
    paint: { 'line-color': p.hover, 'line-width': 2, 'line-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0] },
  }, before)
  m.addLayer({
    id: lid(ts.code, 'sel'), type: 'line', source: s, 'source-layer': 'fields',
    filter: ['==', ['get', 'id'], useStore.getState().selectedId ?? ''],
    paint: { 'line-color': p.fieldSelected, 'line-width': 4 },
  }, before)
}
