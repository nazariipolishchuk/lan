import { describe, expect, it } from 'vitest'
import { ABOUT } from './about'

const shape = (x: unknown): unknown =>
  Array.isArray(x) ? x.map(shape) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, shape(v)])) : typeof x

describe('About text', () => {
  it('has the same sections, lists and placeholders in both languages', () => {
    expect(shape(ABOUT.uk)).toEqual(shape(ABOUT.en))
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
    expect(vars(ABOUT.uk.accuracy.groupLine)).toEqual(vars(ABOUT.en.accuracy.groupLine))
    expect(vars(ABOUT.uk.coverage.total)).toEqual(vars(ABOUT.en.coverage.total))
  })

  it('has every §5.8 glossary term', () => {
    expect(ABOUT.en.glossary.items).toHaveLength(10)
  })
})
