import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { parseMaybeGzip } from './loader'

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
