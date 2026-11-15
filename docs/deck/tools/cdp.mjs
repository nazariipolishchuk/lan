// Minimal Chrome DevTools driver for the deck: screenshots of the live site and the PDF render.
// usage: node cdp.mjs <scenario.mjs> [width] [height] [deviceScaleFactor]
// The scenario's default export gets { go, eval, sleep, shot, click, clickText, wheel, pdf, send }.
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const [scenarioPath, W = '1600', H = '900', DSF = '2'] = process.argv.slice(2)
const BASE = process.env.BASE_URL || 'https://nazariipolishchuk.github.io/lan'
const DBG = 9341
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const profile = mkdtempSync(join(tmpdir(), 'lan-deck-chrome-'))
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', `--remote-debugging-port=${DBG}`, `--user-data-dir=${profile}`, '--no-first-run',
  '--enable-unsafe-swiftshader', '--use-angle=swiftshader', `--window-size=${W},${H}`, 'about:blank',
], { stdio: 'ignore' })

async function until(fn, ms = 20000) {
  const t0 = Date.now()
  for (;;) {
    try { const v = await fn(); if (v) return v } catch {}
    if (Date.now() - t0 > ms) throw new Error('timeout')
    await sleep(250)
  }
}

let code = 0
let ws
try {
  const targets = await until(async () => (await fetch(`http://127.0.0.1:${DBG}/json`)).json())
  ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r))
  let id = 0
  const pending = new Map()
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
  })
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id
    pending.set(i, (m) => (m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result)))
    ws.send(JSON.stringify({ id: i, method, params }))
  })
  await send('Runtime.enable'); await send('Page.enable')
  const mobile = Number(W) < 640
  await send('Emulation.setDeviceMetricsOverride', { width: Number(W), height: Number(H), deviceScaleFactor: Number(DSF), mobile })
  if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true })
  const api = {
    send, sleep,
    async go(path) { await send('Page.navigate', { url: BASE + path }); await sleep(2500) },
    async eval(expr) {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
      if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text))
      return r.result.value
    },
    async shot(file, clip) {
      const jpg = file.endsWith('.jpg')
      const r = await send('Page.captureScreenshot', { format: jpg ? 'jpeg' : 'png', ...(jpg ? { quality: 95 } : {}), ...(clip ? { clip: { ...clip, scale: 1 } } : {}) })
      writeFileSync(file, Buffer.from(r.data, 'base64'))
      console.log('shot', file)
    },
    async click(x, y) { for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }) },
    async clickText(text, sel = 'button') {
      const r = await api.eval(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(sel)})].find(b => b.textContent.trim() === ${JSON.stringify(text)}); if (!e) return null; const b = e.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2] })()`)
      if (!r) throw new Error('no button ' + text)
      await api.click(r[0], r[1])
    },
    async wheel(x, y, dy) { await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY: dy }) },
    async pdf(file) {
      const { stream } = await send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0, transferMode: 'ReturnAsStream' })
      const parts = []
      for (;;) { const c = await send('IO.read', { handle: stream, size: 512 * 1024 }); parts.push(Buffer.from(c.data, c.base64Encoded ? 'base64' : 'binary')); if (c.eof) break }
      await send('IO.close', { handle: stream })
      writeFileSync(file, Buffer.concat(parts))
      console.log('pdf', file)
    },
  }
  const scenario = await import(pathToFileURL(resolve(scenarioPath)).href)
  await scenario.default(api)
} catch (e) {
  console.error('FAILED', e)
  code = 1
} finally {
  try { await fetch(`http://127.0.0.1:${DBG}/json/close`).catch(() => {}) } catch {}
  try { ws?.close() } catch {}
  chrome.kill()
  await sleep(800)
  try { rmSync(profile, { recursive: true, force: true }) } catch {}
  process.exit(code)
}
