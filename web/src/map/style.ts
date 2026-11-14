// Basemap: NASA GIBS Blue Marble imagery at small scales (public domain), fading into a dark vector
// map from OpenFreeMap (OpenStreetMap data, ODbL) where fields appear. Satellite imagery fine enough
// for single fields is not available without licence restrictions (see docs/DECISIONS.md).
import type { StyleSpecification } from 'maplibre-gl'
import type { Lang } from '../i18n'

export const C = {
  night: '#030D0F',
  land: '#08191C',
  water: '#0B2A33',
  line: '#1C3A40',
  frost: '#9BC2D7',
  gold: '#E1BC64',
  chalk: '#E8EEEA',
}

export function baseStyle(lang: Lang): StyleSpecification {
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
      { id: 'bg', type: 'background', paint: { 'background-color': C.land } },
      { id: 'bluemarble', type: 'raster', source: 'bluemarble', paint: { 'raster-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.9, 10, 0], 'raster-saturation': -0.35, 'raster-brightness-max': 0.75 } },
      { id: 'water', type: 'fill', source: 'osm', 'source-layer': 'water', paint: { 'fill-color': C.water, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.3, 10, 1] } },
      { id: 'forest', type: 'fill', source: 'osm', 'source-layer': 'landcover', filter: ['==', ['get', 'class'], 'wood'], minzoom: 9, paint: { 'fill-color': '#0C2420' } },
      { id: 'built', type: 'fill', source: 'osm', 'source-layer': 'landuse', filter: ['in', ['get', 'class'], ['literal', ['residential', 'industrial', 'commercial']]], minzoom: 10, paint: { 'fill-color': '#12262A' } },
      { id: 'roads', type: 'line', source: 'osm', 'source-layer': 'transportation', minzoom: 9, filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary']]], paint: { 'line-color': '#2A4A50', 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.4, 14, 1.6] } },
      { id: 'borders', type: 'line', source: 'osm', 'source-layer': 'boundary', filter: ['all', ['<=', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]], paint: { 'line-color': C.frost, 'line-opacity': 0.35, 'line-width': ['match', ['get', 'admin_level'], 2, 1.2, 0.6], 'line-dasharray': [3, 2] } },
      {
        id: 'places', type: 'symbol', source: 'osm', 'source-layer': 'place',
        filter: ['in', ['get', 'class'], ['literal', ['city', 'town', 'village']]],
        layout: {
          'text-field': name as never, 'text-font': ['Noto Sans Regular'],
          'text-size': ['match', ['get', 'class'], 'city', 14, 'town', 12, 11],
        },
        minzoom: 6,
        paint: { 'text-color': C.frost, 'text-halo-color': C.night, 'text-halo-width': 1.4 },
      },
    ],
  }
}
