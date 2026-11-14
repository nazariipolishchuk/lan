// Map layers (PLAN 4.2, §5.3): fields recoloured by the latest season, summer drought or rotation health;
// below the zoom where fields appear, oblasts are shaded by the same layer summarised per oblast.
// Colour is never the only signal: every legend entry carries words (principle 6).
import type { ExpressionSpecification } from 'maplibre-gl'
import type { Key } from '../i18n'
import type { Theme } from './style'

export type MapLayer = 'none' | 'last' | 'drought' | 'rotation'
export const MAP_LAYERS: MapLayer[] = ['none', 'last', 'drought', 'rotation']

interface Swatch {
  color: string
  label: Key
}

const UNKNOWN: Record<Theme, string> = { dark: '#5C6B70', light: '#A9B2B4' }
const LAST: Record<Theme, [string, string, string]> = {
  dark: ['#E1BC64', '#6FBF8E', '#B98466'], // winter crop · summer crop · not cultivated
  light: ['#C9971F', '#3E9A63', '#9A5F3F'],
}
// sequential ramps, low → high
const DROUGHT: Record<Theme, string[]> = {
  dark: ['#4E8C7A', '#A9B85A', '#E1BC64', '#E08A3C', '#D0533A'],
  light: ['#3E8A73', '#9AA83E', '#D4A62C', '#D3762A', '#B8402A'],
}
const ROTATION: Record<Theme, string[]> = {
  dark: ['#D0533A', '#E08A3C', '#E1BC64', '#A9C46A', '#5FB47A'],
  light: ['#B8402A', '#D3762A', '#D4A62C', '#87A73E', '#3E9A63'],
}
const DROUGHT_STOPS = [0, 5, 10, 15, 20]
const ROTATION_STOPS = [0, 25, 50, 75, 100]

function ramp(prop: ExpressionSpecification, stops: number[], colors: string[], unknown: string): ExpressionSpecification {
  const pairs = stops.flatMap((s, i) => [s, colors[i]])
  return ['case', ['<', prop, 0], unknown, ['interpolate', ['linear'], prop, ...pairs]] as ExpressionSpecification
}

/** fill-color of a field for the active layer; `base` is the plain field colour. */
export function fieldColor(layer: MapLayer, theme: Theme, base: string): ExpressionSpecification | string {
  const u = UNKNOWN[theme]
  if (layer === 'last') {
    const [w, s, n] = LAST[theme]
    return ['match', ['coalesce', ['get', 'lg'], -1], 0, w, 1, s, 2, n, u] as ExpressionSpecification
  }
  if (layer === 'drought') return ramp(['coalesce', ['get', 'dr'], -1] as ExpressionSpecification, DROUGHT_STOPS, DROUGHT[theme], u)
  if (layer === 'rotation') return ramp(['coalesce', ['get', 'rh'], -1] as ExpressionSpecification, ROTATION_STOPS, ROTATION[theme], u)
  return base
}

/** fill-color of an oblast (oblasts.json properties lgw %, dr years, rh 0–100; −1 = not enough data). */
export function oblastColor(layer: MapLayer, theme: Theme): ExpressionSpecification | string {
  const u = UNKNOWN[theme]
  if (layer === 'last') {
    // share of fields whose latest season carried a winter crop: summer-crop gold-green ramp
    const [w, s] = LAST[theme]
    const v = ['coalesce', ['get', 'lgw'], -1] as ExpressionSpecification
    return ['case', ['<', v, 0], u, ['interpolate', ['linear'], v, 20, s, 60, w]] as ExpressionSpecification
  }
  if (layer === 'drought') return ramp(['coalesce', ['get', 'dr'], -1] as ExpressionSpecification, DROUGHT_STOPS, DROUGHT[theme], u)
  if (layer === 'rotation') return ramp(['coalesce', ['get', 'rh'], -1] as ExpressionSpecification, ROTATION_STOPS, ROTATION[theme], u)
  return u
}

export interface Legend {
  title: Key
  what: Key
  swatches: Swatch[]
  unknown: Key
}

export function legend(layer: MapLayer, theme: Theme): Legend | null {
  const u = UNKNOWN[theme]
  if (layer === 'last') {
    const [w, s, n] = LAST[theme]
    return {
      title: 'layer.last', what: 'layer.lastWhat', unknown: 'layer.lastUnknown',
      swatches: [{ color: w, label: 'layer.winter' }, { color: s, label: 'layer.summer' }, { color: n, label: 'layer.fallow' }, { color: u, label: 'layer.unknown' }],
    }
  }
  if (layer === 'drought') {
    const c = DROUGHT[theme]
    return {
      title: 'layer.drought', what: 'layer.droughtWhat', unknown: 'layer.droughtUnknown',
      swatches: [{ color: c[0], label: 'layer.drought0' }, { color: c[2], label: 'layer.drought10' }, { color: c[4], label: 'layer.drought20' }, { color: u, label: 'layer.unknown' }],
    }
  }
  if (layer === 'rotation') {
    const c = ROTATION[theme]
    return {
      title: 'layer.rotation', what: 'layer.rotationWhat', unknown: 'layer.rotationUnknown',
      swatches: [{ color: c[0], label: 'layer.rotationLow' }, { color: c[2], label: 'layer.rotationMid' }, { color: c[4], label: 'layer.rotationHigh' }, { color: u, label: 'layer.unknown' }],
    }
  }
  return null
}
