import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import crops from '../../public/rules/us/crops.json'
import rules from '../../public/rules/us/rules.json'
import { cropsErrors, rulesErrors } from './validate'

const here = fileURLToPath(new URL('.', import.meta.url))

describe('USA rule set', () => {
  it('has the same structure as the Ukrainian files', () => {
    expect(cropsErrors(crops)).toEqual([])
    expect(rulesErrors(rules)).toEqual([])
  })

  it('cites no Ukrainian law and no Ukrainian local practice', () => {
    const text = JSON.stringify([crops, rules])
    expect(text).not.toContain('kmu164')
    expect(text).not.toContain('local_n')
  })

  it('every source id is listed in REFERENCES.md', () => {
    const refs = readFileSync(join(here, '..', '..', '..', 'docs', 'REFERENCES.md'), 'utf8')
    const ids = new Set<string>()
    JSON.stringify([crops, rules], (k, v) => {
      if (k === 'source' && typeof v === 'string') ids.add(v)
      return v
    })
    expect(ids.size).toBeGreaterThan(5)
    for (const id of ids) expect(refs, `source id ${id}`).toContain(`\`${id}\``)
  })
})
