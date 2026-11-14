import { describe, expect, it } from 'vitest'
import crops from '../../public/rules/crops.json'
import rules from '../../public/rules/rules.json'
import { en } from './en'
import { uk } from './uk'

describe('translations', () => {
  it('test_every_en_key_exists_in_uk', () => {
    const missing = Object.keys(en).filter((k) => !(k in uk) || !(uk as Record<string, string>)[k].trim())
    expect(missing).toEqual([])
  })

  it('placeholders match between languages', () => {
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
    for (const k of Object.keys(en) as (keyof typeof en)[]) expect(vars(uk[k]), k).toEqual(vars(en[k]))
  })

  it('every label key used in crops.json and rules.json has a string', () => {
    const keys = new Set<string>()
    JSON.stringify([crops, rules], (k, v) => {
      if ((k === 'label' || k === 'what') && typeof v === 'string') keys.add(v)
      return v
    })
    for (const k of keys) expect(Object.keys(en), k).toContain(k)
  })
})
