// Checks on the real pipeline output (skipped when data/out is absent, e.g. in CI).
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { cropCalendar } from './calendar'
import { CROPS } from './testkit'
import type { ClimateCell } from './types'

const here = fileURLToPath(new URL('.', import.meta.url))
const cellPath = join(here, '..', '..', 'public', 'data', 'climate', '49.5_31.875.json')
const has = existsSync(cellPath)
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const lab = (d: number) => { const x = ((d % 36) + 36) % 36; return `${['early', 'mid', 'late'][x % 3]} ${MONTHS[Math.floor(x / 3)]}` }

describe.skipIf(!has)('calendars on the real Cherkasy climate cell', () => {
  const cell = has ? (JSON.parse(readFileSync(cellPath, 'utf8')) as ClimateCell) : null

  it('prints every crop calendar', () => {
    for (const c of CROPS.crops) {
      const k = cropCalendar(c, cell!)
      if (k) console.log(`${c.id.padEnd(11)} sow ${lab(k.sow.start)} – ${lab(k.sow.end)} | harvest ${lab(k.harvest.start)} – ${lab(k.harvest.end)}`)
    }
  })

  it('winter crops are sown in September–October, as local farmers do (LOCAL_KNOWLEDGE.md)', () => {
    for (const id of ['w_wheat', 'w_barley'] as const) {
      const k = cropCalendar(CROPS.crops.find((c) => c.id === id)!, cell!)!
      const start = k.sow.start + 36 // previous-year dekad
      expect(start, id).toBeGreaterThanOrEqual(24) // from September
      expect(start, id).toBeLessThanOrEqual(30) // to October
    }
  })
})
