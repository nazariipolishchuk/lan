import * as maplibregl from 'maplibre-gl'
import type { MapGeoJSONFeature } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { Protocol } from 'pmtiles'
import { useEffect, useRef, useState } from 'react'
import { FIELD_TILES } from '../data/loader'
import { decodeFieldId } from '../engine/fieldId'
import { useT } from '../i18n'
import { useStore } from '../state/store'
import { C, baseStyle } from './style'

const FIELDS_MIN_ZOOM = 11
let protocolAdded = false
// MapLibre looks for its worker next to its own module; bundling moves the module, so point at the file
maplibregl.setWorkerUrl(new URL(workerUrl, window.location.href).href)

export function MapView() {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const hovered = useRef<string | null>(null)
  const [zoom, setZoom] = useState(9)
  const [tip, setTip] = useState<{ x: number; y: number; ha: number } | null>(null)
  const lang = useStore((s) => s.lang)
  const selectedId = useStore((s) => s.selectedId)
  const t = useT()

  useEffect(() => {
    if (!protocolAdded) {
      maplibregl.addProtocol('pmtiles', new Protocol().tile)
      protocolAdded = true
    }
    const start = selectedId ? decodeFieldId(selectedId) : null
    const m = new maplibregl.Map({
      container: el.current!,
      style: baseStyle(useStore.getState().lang),
      center: start ? [start.lon, start.lat] : [31.9, 49.4],
      zoom: start ? 13.5 : 9,
      maxZoom: 16,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    })
    m.touchZoomRotate.disableRotation()
    map.current = m
    setZoom(m.getZoom())
    m.on('zoom', () => setZoom(m.getZoom()))
    m.on('style.load', () => addFields(m))
    m.on('mousemove', 'fields-fill', (e) => {
      const f = e.features?.[0] as MapGeoJSONFeature | undefined
      if (!f) return
      setHover(m, hovered, String(f.properties.id))
      m.getCanvas().style.cursor = 'pointer'
      setTip({ x: e.point.x, y: e.point.y, ha: Number(f.properties.ha) })
    })
    m.on('mouseleave', 'fields-fill', () => {
      setHover(m, hovered, null)
      m.getCanvas().style.cursor = ''
      setTip(null)
    })
    m.on('click', (e) => {
      const f = m.queryRenderedFeatures(e.point, { layers: ['fields-fill'] })[0]
      useStore.getState().select(f ? String(f.properties.id) : null)
    })
    return () => m.remove()
    // the map is created once; later changes go through the effects below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // language: swap the basemap style (fields are re-added on style.load)
  const firstLang = useRef(lang)
  useEffect(() => {
    if (lang === firstLang.current) return
    map.current?.setStyle(baseStyle(lang))
    firstLang.current = lang
  }, [lang])

  // selection outline
  useEffect(() => {
    const m = map.current
    if (!m) return
    const apply = () => m.getLayer('fields-selected') && m.setFilter('fields-selected', ['==', ['get', 'id'], selectedId ?? ''])
    if (m.isStyleLoaded()) apply()
    else m.once('idle', apply)
  }, [selectedId])

  return (
    <div className="map-wrap">
      <div ref={el} className="map" role="application" aria-label="Map of fields" />
      {zoom < FIELDS_MIN_ZOOM && <div className="map-hint">{t('map.zoomIn')}</div>}
      {tip && (
        <div className="map-tip" style={{ left: tip.x + 14, top: tip.y + 14 }}>
          {tip.ha.toLocaleString(lang === 'uk' ? 'uk-UA' : 'en-GB', { maximumFractionDigits: 1 })} {t('card.ha')}
        </div>
      )}
    </div>
  )
}

function setHover(m: maplibregl.Map, ref: { current: string | null }, id: string | null) {
  if (ref.current === id) return
  ref.current = id
  if (m.getLayer('fields-hover')) m.setFilter('fields-hover', ['==', ['get', 'id'], id ?? ''])
}

function addFields(m: maplibregl.Map) {
  if (m.getSource('fields')) return
  m.addSource('fields', {
    type: 'vector', url: `pmtiles://${new URL(FIELD_TILES, window.location.href).href}`,
    attribution: 'Fields of The World (CC-BY-4.0)',
  })
  const before = 'places'
  m.addLayer({
    id: 'fields-fill', type: 'fill', source: 'fields', 'source-layer': 'fields', minzoom: FIELDS_MIN_ZOOM,
    paint: { 'fill-color': C.gold, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], FIELDS_MIN_ZOOM, 0.05, 14, 0.12] },
  }, before)
  m.addLayer({
    id: 'fields-line', type: 'line', source: 'fields', 'source-layer': 'fields', minzoom: FIELDS_MIN_ZOOM,
    paint: { 'line-color': C.gold, 'line-opacity': ['interpolate', ['linear'], ['zoom'], FIELDS_MIN_ZOOM, 0.35, 14, 0.8], 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.4, 15, 1.4] },
  }, before)
  m.addLayer({
    id: 'fields-hover', type: 'line', source: 'fields', 'source-layer': 'fields', filter: ['==', ['get', 'id'], ''],
    paint: { 'line-color': C.chalk, 'line-width': 2 },
  }, before)
  m.addLayer({
    id: 'fields-selected', type: 'line', source: 'fields', 'source-layer': 'fields',
    filter: ['==', ['get', 'id'], useStore.getState().selectedId ?? ''],
    paint: { 'line-color': C.gold, 'line-width': 3.5 },
  }, before)
}
