// Basemap: NASA GIBS Blue Marble imagery at small scales (public domain), fading into a vector map
// from OpenFreeMap (OpenStreetMap data, ODbL) where fields appear. Satellite imagery fine enough for
// single fields is not available without licence restrictions (see docs/DECISIONS.md).
// Orientation first: towns and villages are drawn as filled built-up areas with outlines, raion and
// oblast borders are visible, and place names are large.
import type { StyleSpecification } from 'maplibre-gl'
import type { Lang } from '../i18n'

export type Theme = 'dark' | 'light'

interface Palette {
  land: string
  water: string
  wood: string
  built: string
  builtEdge: string
  road: string
  roadMinor: string
  border: string
  label: string
  halo: string
  field: string
  fieldSelected: string
  hover: string
  blueMarbleBrightness: number
}

export const PALETTES: Record<Theme, Palette> = {
  dark: {
    land: '#0E2226', water: '#14404D', wood: '#123029', built: '#2A3F44', builtEdge: '#5C7C85',
    road: '#56747C', roadMinor: '#2F4A50', border: '#9BC2D7', label: '#DCE9EF', halo: '#06171A',
    field: '#E1BC64', fieldSelected: '#F2D27F', hover: '#FFFFFF', blueMarbleBrightness: 0.85,
  },
  light: {
    land: '#EEF2EC', water: '#9CC3D3', wood: '#CFE0CB', built: '#D6D9D7', builtEdge: '#8E9A9C',
    road: '#FFFFFF', roadMinor: '#F8F9F7', border: '#3E6A80', label: '#16343B', halo: '#FFFFFF',
    field: '#B8861C', fieldSelected: '#8A5E00', hover: '#16343B', blueMarbleBrightness: 1,
  },
}

export function baseStyle(lang: Lang, theme: Theme): StyleSpecification {
  const p = PALETTES[theme]
  const name = lang === 'uk'
    ? ['coalesce', ['get', 'name:uk'], ['get', 'name']]
    : ['coalesce', ['get', 'name:en'], ['get', 'name:latin'], ['get', 'name']]
  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      bluemarble: {
        type: 'raster', tileSize: 256, maxzoom: 8,
        tiles: ['https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/2004-08-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg'],
        attribution: 'Imagery: NASA GIBS Blue Marble',
      },
      osm: { type: 'vector', url: 'https://tiles.openfreemap.org/planet', attribution: '© OpenStreetMap contributors (ODbL), OpenFreeMap' },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': p.land } },
      { id: 'bluemarble', type: 'raster', source: 'bluemarble', paint: { 'raster-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.95, 9.5, 0], 'raster-brightness-max': p.blueMarbleBrightness } },
      { id: 'wood', type: 'fill', source: 'osm', 'source-layer': 'landcover', filter: ['==', ['get', 'class'], 'wood'], minzoom: 8, paint: { 'fill-color': p.wood, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0, 9.5, 1] } },
      { id: 'water', type: 'fill', source: 'osm', 'source-layer': 'water', paint: { 'fill-color': p.water, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.4, 9.5, 1] } },
      { id: 'built', type: 'fill', source: 'osm', 'source-layer': 'landuse', filter: ['in', ['get', 'class'], ['literal', ['residential', 'industrial', 'commercial', 'retail', 'suburb', 'neighbourhood']]], minzoom: 8, paint: { 'fill-color': p.built, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0, 9.5, 1] } },
      { id: 'built-edge', type: 'line', source: 'osm', 'source-layer': 'landuse', filter: ['in', ['get', 'class'], ['literal', ['residential', 'industrial', 'commercial', 'retail']]], minzoom: 10, paint: { 'line-color': p.builtEdge, 'line-width': 0.8, 'line-opacity': 0.8 } },
      { id: 'roads-minor', type: 'line', source: 'osm', 'source-layer': 'transportation', minzoom: 12, filter: ['in', ['get', 'class'], ['literal', ['minor', 'service', 'track']]], paint: { 'line-color': p.roadMinor, 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.3, 15, 1.2] } },
      { id: 'roads', type: 'line', source: 'osm', 'source-layer': 'transportation', minzoom: 7, filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary']]], paint: { 'line-color': p.road, 'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.5, 10, 1.2, 14, 2.6] } },
      { id: 'raion-borders', type: 'line', source: 'osm', 'source-layer': 'boundary', minzoom: 7, filter: ['all', ['==', ['get', 'admin_level'], 6], ['!=', ['get', 'maritime'], 1]], paint: { 'line-color': p.border, 'line-opacity': 0.6, 'line-width': 1, 'line-dasharray': [2, 2] } },
      { id: 'borders', type: 'line', source: 'osm', 'source-layer': 'boundary', filter: ['all', ['<=', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]], paint: { 'line-color': p.border, 'line-opacity': 0.85, 'line-width': ['match', ['get', 'admin_level'], 2, 2, 1.4] } },
      {
        id: 'places', type: 'symbol', source: 'osm', 'source-layer': 'place',
        filter: ['in', ['get', 'class'], ['literal', ['city', 'town', 'village', 'hamlet']]],
        layout: {
          'text-field': name as never, 'text-font': ['Noto Sans Bold'],
          'text-size': ['match', ['get', 'class'], 'city', 17, 'town', 14, 'village', 13, 11],
          'text-padding': 4,
        },
        minzoom: 6,
        paint: { 'text-color': p.label, 'text-halo-color': p.halo, 'text-halo-width': 2 },
      },
    ],
  }
}
