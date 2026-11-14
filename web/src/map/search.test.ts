import { describe, expect, it } from 'vitest'
import { buildIndex, norm, searchPlaces, type Place } from './search'

const places: Place[] = [
  ['Cherkasy', 'Черкаси', 32.06, 49.44, '71', 270000],
  ['Zvenyhorodka', 'Звенигородка', 30.97, 49.08, '71', 16490],
  ['Kamianka', 'Кам’янка', 32.1, 49.03, '71', 11000],
  ['Mokra Kalyhirka', 'Мокра Калигірка', 31.0, 49.2, '71', 2000],
  ['Vilshana', 'Вільшана', 31.27, 49.2, '71', 1500],
  ['Nova Vilshana', 'Нова Вільшана', 31.3, 49.3, '71', 300],
]
const ix = buildIndex(places)

describe('settlement search', () => {
  it('test_search_finds_cyrillic_and_latin', () => {
    expect(searchPlaces(ix, 'Звениг')[0][0]).toBe('Zvenyhorodka')
    expect(searchPlaces(ix, 'zvenyh')[0][0]).toBe('Zvenyhorodka')
    expect(searchPlaces(ix, 'ЧЕРКАСИ')[0][0]).toBe('Cherkasy')
  })

  it('ignores apostrophes and case', () => {
    expect(searchPlaces(ix, "кам'янка")[0][0]).toBe('Kamianka')
    expect(searchPlaces(ix, 'камянка')[0][0]).toBe('Kamianka')
    expect(norm('Кам’янка')).toBe(norm("Кам'янка"))
  })

  it('ranks a name start before a later word, bigger places first', () => {
    expect(searchPlaces(ix, 'віль').map((p) => p[0])).toEqual(['Vilshana', 'Nova Vilshana'])
    expect(searchPlaces(ix, 'kaly').map((p) => p[0])).toEqual(['Mokra Kalyhirka'])
  })

  it('needs at least two letters', () => {
    expect(searchPlaces(ix, 'з')).toEqual([])
    expect(searchPlaces(ix, '  ')).toEqual([])
  })
})
