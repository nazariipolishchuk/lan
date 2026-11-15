import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { neighbourCells, parseMaybeGzip } from './loader'

const buf = (b: Uint8Array) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer

describe('chunk parsing', () => {
  it('reads gzip bytes (Pages serves .json.gz as raw bytes)', async () => {
    const obj = { v: 1, ck: '1_2', fields: [{ id: 'аб' }] }
    expect(await parseMaybeGzip(buf(gzipSync(JSON.stringify(obj))))).toEqual(obj)
  })

  it('reads plain JSON (older data, or a server that already unpacked it)', async () => {
    expect(await parseMaybeGzip(buf(new TextEncoder().encode('{"a":[1,2]}')))).toEqual({ a: [1, 2] })
  })
})

describe('neighbourCells', () => {
  it('names the eight POWER cells around a cell in the files’ own format', () => {
    const n = neighbourCells('46.5_36.875')
    expect(n.slice(0, 4)).toEqual(['47.0_36.875', '46.5_37.500', '46.5_36.250', '46.0_36.875'])
    expect(n).toHaveLength(8)
    expect(neighbourCells('25.0_-80.625')[2]).toBe('25.0_-81.250')
  })
})
