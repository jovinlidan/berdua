// Frame-cost probe for the motions you actually feel: the app sitting still, a bottom sheet opening,
// and typing into a field with a long list behind it.
//
// It reports where the renderer spends its time (style, layout, paint, raster, layerize, commit)
// rather than one fps number, because that is what tells you WHICH change helped. The CPU is
// throttled so a desktop stands in for a mid-range phone.
//
// Run: BASE=http://localhost:5173 node scripts/test-perf.mjs
// Compare two builds by serving each and running this against both. The first repetition of any
// interaction is discarded — first mount and cold caches make it roughly twice as expensive as the
// steady state, and a lone "before" number taken from it will overstate any win.
import { chromium } from 'playwright'

const base = process.env.BASE || 'http://localhost:5173'
const THROTTLE = Number(process.env.THROTTLE || 4)
const TODOS = Number(process.env.TODOS || 40)
// CHROME_PATH lets a sandbox point at an already-installed Chromium (Playwright pins one build).
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {})
const ctx = await browser.newContext({ viewport: { width: 402, height: 880 } })
const page = await ctx.newPage()
const cdp = await ctx.newCDPSession(page)

await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('input[placeholder="You"]')
await page.fill('input[placeholder="You"]', 'Alex')
await page.fill('input[placeholder^="A secret word"]', `perf-${Date.now()}`)
await page.click('text=Begin, together')
await page.waitForTimeout(2000)

// Adopt a pet: the roaming companion rides along on every screen, so a measurement without one is
// not the app anybody actually uses.
await page.click('text=Adopt a pet')
await page.waitForSelector('input[placeholder="e.g. Mochi"]')
await page.fill('input[placeholder="e.g. Mochi"]', 'Mochi')
await page.click('button:has-text("Adopt Mochi")')
await page.waitForTimeout(1200)

await page.goto(`${base}/todos`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('input[placeholder="Add a task…"]')
for (let i = 0; i < TODOS; i++) {
  await page.fill('input[placeholder="Add a task…"]', `Task number ${i + 1}`)
  await page.click('[aria-label="Add to-do"]')
  await page.waitForTimeout(90)
}
await page.waitForTimeout(700)
await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE })

const PIPELINE = ['UpdateLayoutTree', 'Layout', 'PrePaint', 'Paint', 'RasterTask', 'Layerize', 'Commit']
const SCRIPT = ['FunctionCall', 'TimerFire', 'EventDispatch']

/** Trace one interaction and total the renderer's work by event name. */
async function trace(act, settleMs) {
  const events = []
  const onData = ({ value }) => events.push(...value)
  cdp.on('Tracing.dataCollected', onData)
  await cdp.send('Tracing.start', {
    traceConfig: { includedCategories: ['devtools.timeline', 'disabled-by-default-devtools.timeline'] },
    transferMode: 'ReportEvents',
  })
  if (act) await act()
  await page.waitForTimeout(settleMs)
  const done = new Promise((r) => cdp.once('Tracing.tracingComplete', r))
  await cdp.send('Tracing.end')
  await done
  cdp.off('Tracing.dataCollected', onData)
  const agg = {}
  for (const e of events) {
    if (e.ph !== 'X') continue
    agg[e.name] = (agg[e.name] || 0) + (e.dur || 0) / 1000
  }
  return agg
}

const rows = []
function report(label, reps) {
  const use = reps.length > 1 ? reps.slice(1) : reps // drop the polluted first rep
  const med = (pick) => {
    const v = use.map(pick).sort((a, b) => a - b)
    return v[Math.floor(v.length / 2)] ?? 0
  }
  rows.push({
    label,
    pipeline: med((a) => PIPELINE.reduce((s, k) => s + (a[k] || 0), 0)),
    script: med((a) => SCRIPT.reduce((s, k) => s + (a[k] || 0), 0)),
    parts: Object.fromEntries(PIPELINE.map((k) => [k, med((a) => a[k] || 0)])),
  })
}

// 1) the app sitting still. Anything here is pure background burn: loops that never stop.
report('idle, untouched', [await trace(null, 3000), await trace(null, 3000), await trace(null, 3000)])

// 2) the sheet opening over a full list
const opens = []
for (let i = 0; i < 4; i++) {
  opens.push(await trace(() => page.locator('[aria-label="Edit to-do"]').first().click(), 900))
  await page.click('[aria-label="Close"]')
  await page.waitForTimeout(700)
}
report('edit sheet opens', opens)

console.log(`\nCPU throttle ${THROTTLE}x · ${TODOS} to-dos · renderer ms per interaction (median, first rep dropped)`)
for (const r of rows) {
  console.log(`  ${r.label.padEnd(18)} pipeline ${r.pipeline.toFixed(0).padStart(4)}ms · script ${r.script.toFixed(0).padStart(4)}ms`)
  console.log(
    `  ${''.padEnd(18)} ` +
      PIPELINE.map((k) => `${k.slice(0, 6)} ${r.parts[k].toFixed(0).padStart(4)}`).join(' · '),
  )
}

// 3) keystroke to paint, the cost that makes typing feel heavy. Measured in the edit sheet and in
// the composer, because both used to re-render the whole list on every character.
async function keystrokes(label, focus) {
  await focus()
  await page.evaluate(() => {
    window.__lat = []
  })
  for (const ch of 'abcdefghijklmnop') {
    await page.evaluate(() => {
      window.__t0 = performance.now()
    })
    await page.keyboard.type(ch)
    await page.evaluate(
      () =>
        new Promise((r) =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              window.__lat.push(performance.now() - window.__t0)
              r()
            }),
          ),
        ),
    )
  }
  const d = await page.evaluate(() => window.__lat)
  const sorted = [...d].sort((a, b) => a - b)
  console.log(
    `  ${label.padEnd(18)} mean ${(d.reduce((s, x) => s + x, 0) / d.length).toFixed(1).padStart(5)}ms · p50 ${sorted[Math.floor(d.length / 2)].toFixed(1).padStart(5)}ms · worst ${Math.max(...d).toFixed(1).padStart(5)}ms`,
  )
}
console.log('\nkeystroke to paint:')
await keystrokes('in the edit sheet', async () => {
  await page.locator('[aria-label="Edit to-do"]').first().click()
  await page.waitForTimeout(900)
  await page.locator('[role=dialog] input.field').first().click()
})
await page.click('[aria-label="Close"]')
await page.waitForTimeout(700)
await keystrokes('in the composer', async () => {
  await page.locator('input[placeholder="Add a task…"]').click()
})

await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
await browser.close()
