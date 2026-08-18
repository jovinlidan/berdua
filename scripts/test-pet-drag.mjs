// Verifies the pet is draggable: a drag MOVES it and does NOT open the care sheet (tap is not drag),
// while a plain tap still opens care. Needs `pnpm dev`.
//
// Covered with a MOUSE and with a FINGER, and the finger cases are the ones that matter. On a mouse,
// framer-motion suppresses the onTap that follows a drag by itself, so the mouse cases passed for
// months while putting the pet down on a real phone opened its care sheet every single time. Any
// gesture assertion about this component has to dispatch pointerType: 'touch' to mean anything.
import { chromium } from 'playwright'

const base = process.env.BASE || 'http://localhost:5173'
const CODE = `drag-${Date.now()}`
// CHROME_PATH lets a sandbox point at an already-installed Chromium (Playwright pins one build).
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {})
const errs = []
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
const p = await ctx.newPage()
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
p.on('pageerror', (e) => errs.push('PE:' + e.message))
const res = {}

await p.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
await p.waitForSelector('input[placeholder="You"]')
await p.fill('input[placeholder="You"]', 'Alex')
await p.fill('input[placeholder^="A secret word"]', CODE)
await p.click('text=Begin, together')
await p.waitForTimeout(1500)
await p.getByRole('button', { name: /Adopt a pet/ }).click()
await p.waitForTimeout(300)
await p.fill('input[placeholder="e.g. Mochi"]', 'Mochi')
await p.getByRole('button', { name: '🐄' }).click()
await p.getByRole('button', { name: /Adopt/ }).last().click()
await p.waitForTimeout(1200)

const pet = p.locator('[aria-label="Mochi"]')
res.present = (await pet.count()) > 0
const before = await pet.boundingBox()

// DRAG: press, move a clear distance (up & left), release — should NOT open the care sheet
await p.mouse.move(before.x + before.width / 2, before.y + before.height / 2)
await p.mouse.down()
await p.mouse.move(before.x - 60, before.y - 120, { steps: 12 })
await p.mouse.move(before.x - 70, before.y - 150, { steps: 6 })
await p.mouse.up()
await p.waitForTimeout(400)
res.dragDidNotOpenSheet = (await p.getByText('Your pet').count()) === 0
const after = await pet.boundingBox()
// it moved up appreciably from where it was (y smaller), ignoring horizontal auto-walk
res.movedByDrag = before.y - after.y > 40

// TAP still opens the care sheet (interactive)
await pet.click()
await p.waitForTimeout(400)
res.tapStillOpensCare = (await p.getByText('Your pet').count()) > 0

// ── the same thing with a finger, at several distances ────────────────────────────────────────
/** Drag with real touch pointer events, the way a phone does. */
async function fingerDrag(distance) {
  const box = await pet.boundingBox()
  await p.evaluate(
    async ([x, y, d]) => {
      const el = document.elementFromPoint(x, y)
      if (!el) throw new Error('no element under the pet')
      const send = (type, px, py) =>
        el.dispatchEvent(
          new PointerEvent(type, {
            pointerId: 1,
            pointerType: 'touch',
            isPrimary: true,
            bubbles: true,
            cancelable: true,
            clientX: px,
            clientY: py,
            buttons: type === 'pointerup' ? 0 : 1,
          }),
        )
      send('pointerdown', x, y)
      for (let i = 1; i <= 10; i++) {
        send('pointermove', x, y - (d * i) / 10)
        await new Promise((r) => requestAnimationFrame(r))
      }
      send('pointerup', x, y - d)
    },
    [box.x + box.width / 2, box.y + box.height / 2, distance],
  )
  await p.waitForTimeout(700)
}

// close the sheet the tap check opened, so each finger case starts clean
await p.getByRole('button', { name: 'Close' }).first().click()
await p.waitForTimeout(700)

for (const distance of [8, 20, 45, 100]) {
  const from = await pet.boundingBox()
  await fingerDrag(distance)
  const to = await pet.boundingBox()
  res[`finger${distance}_didNotOpenSheet`] = (await p.getByText('Your pet').count()) === 0
  // it actually moved, so we are asserting a suppressed tap and not a dropped gesture
  res[`finger${distance}_actuallyMoved`] = from.y - to.y > distance * 0.6
  if (!res[`finger${distance}_didNotOpenSheet`]) {
    await p.getByRole('button', { name: 'Close' }).first().click()
    await p.waitForTimeout(600)
  }
}

// and a finger TAP must still open care
await p.evaluate(
  ([x, y]) => {
    const el = document.elementFromPoint(x, y)
    const send = (type) =>
      el.dispatchEvent(
        new PointerEvent(type, {
          pointerId: 1,
          pointerType: 'touch',
          isPrimary: true,
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y,
          buttons: type === 'pointerup' ? 0 : 1,
        }),
      )
    send('pointerdown')
    send('pointerup')
  },
  await pet.boundingBox().then((b) => [b.x + b.width / 2, b.y + b.height / 2]),
)
await p.waitForTimeout(700)
res.fingerTapStillOpensCare = (await p.getByText('Your pet').count()) > 0

console.log(JSON.stringify(res, null, 2))
console.log('moved dy:', Math.round(before.y - after.y))
console.log('errors:', errs.length ? errs : 'none')
const pass = Object.values(res).every(Boolean) && errs.length === 0
console.log(pass ? '\nPET DRAG E2E: PASS ✅' : '\nPET DRAG E2E: FAIL ❌')
await browser.close()
process.exit(pass ? 0 : 1)
