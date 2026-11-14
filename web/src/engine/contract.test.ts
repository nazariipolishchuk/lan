import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import crops from '../../public/rules/crops.json'
import rules from '../../public/rules/rules.json'
import type { ClimateCell, FieldChunk, Meta } from './types'
import { climateCellErrors, cropsErrors, fieldChunkErrors, metaErrors, rulesErrors } from './validate'

const here = fileURLToPath(new URL('.', import.meta.url))
const dir = join(here, '..', '..', 'public', 'fixtures')
const load = (f: string): unknown => JSON.parse(readFileSync(join(dir, f), 'utf8'))

describe('data contract v1 on fixtures', () => {
  const files = readdirSync(dir)

  it('has the three fixture fields and a climate cell', () => {
    const chunk = load(files.find((f) => f.startsWith('fields_'))!) as FieldChunk
    expect(chunk.fields.map((f) => f.id)).toEqual(['fixture-A', 'fixture-B', 'fixture-C'])
    expect(files.some((f) => f.startsWith('climate_'))).toBe(true)
  })

  it.each(files.filter((f) => f.startsWith('fields_')))('%s is a valid FieldChunk', (f: string) => {
    expect(fieldChunkErrors(load(f))).toEqual([])
  })

  it.each(files.filter((f) => f.startsWith('climate_')))('%s is a valid ClimateCell', (f: string) => {
    const cell = load(f) as ClimateCell
    expect(climateCellErrors(cell)).toEqual([])
    expect(cell.years.length).toBeGreaterThanOrEqual(30)
  })

  it('meta.json is valid', () => {
    const m = load('meta.json') as Meta
    expect(metaErrors(m)).toEqual([])
  })

  it('every fixture field points at a climate cell that exists', () => {
    const chunk = load(files.find((f) => f.startsWith('fields_'))!) as FieldChunk
    for (const f of chunk.fields) expect(files).toContain(`climate_${f.cell}.json`)
  })

  it('the validator rejects a broken record', () => {
    const chunk = load(files.find((f) => f.startsWith('fields_'))!) as FieldChunk
    const broken = structuredClone(chunk) as unknown as { fields: { hist: { k: string }[]; ha: number }[] }
    broken.fields[0].hist[0].k = 'banana'
    broken.fields[1].ha = -1
    expect(fieldChunkErrors(broken)).toEqual(['fields[0].hist[0]', 'fields[1].ha'])
  })
})

describe('rules files', () => {
  it('crops.json has every crop id and sourced numbers', () => {
    expect(cropsErrors(crops)).toEqual([])
  })

  it('rules.json has every combo id and bounded predecessor effects', () => {
    expect(rulesErrors(rules)).toEqual([])
  })

  it('every source id is either null or listed in REFERENCES.md', () => {
    const refs = readFileSync(join(here, '..', '..', '..', 'docs', 'REFERENCES.md'), 'utf8')
    const ids = new Set<string>()
    JSON.stringify([crops, rules], (k, v) => {
      if (k === 'source' && typeof v === 'string') ids.add(v)
      return v
    })
    for (const id of ids) expect(refs, `source id ${id}`).toContain(`\`${id}\``)
  })
})
