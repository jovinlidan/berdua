// Verifies the pet is draggable: a drag MOVES it and does NOT open the care sheet (tap is not drag),
// a plain tap still opens care, and letting go anywhere off the floor drops it back down.
//
// That last part is why the movement checks read the pet MID-AIR, straight after pointerup: it no
// longer stays where it was put vertically, so anything measured after the fall reads y=0 and would
// look like the drag never happened. Needs `pnpm dev`.
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

/** The pet's live transform. `y` is its offset from the floor: 0 on it, negative lifted. */
const petTransform = () =>
  p.evaluate(() => {
    const el = document.querySelector('[aria-label="Mochi"]')
    const m = new DOMMatrix(getComputedStyle(el).transform)
    return { x: Math.round(m.m41), y: Math.round(m.m42) }
  })
const before = await pet.boundingBox()

// DRAG: press, move a clear distance (up & left), release — should NOT open the care sheet
await p.mouse.move(before.x + before.width / 2, before.y + before.height / 2)
await p.mouse.down()
await p.mouse.move(before.x - 60, before.y - 120, { steps: 12 })
await p.mouse.move(before.x - 70, before.y - 150, { steps: 6 })
await p.mouse.up()
// airborne reading FIRST: the fall starts on release and takes up to about half a second
const airborneMouse = await pet.boundingBox()
res.movedByDrag = before.y - airborneMouse.y > 40
await p.waitForTimeout(400)
res.dragDidNotOpenSheet = (await p.getByText('Your pet').count()) === 0

// TAP still opens the care sheet (interactive)
await pet.click()
await p.waitForTimeout(400)
res.tapStillOpensCare = (await p.getByText('Your pet').count()) > 0

// ── the same thing with a finger, at several distances ────────────────────────────────────────
/**
 * Drag with real touch pointer events, the way a phone does. `distance` px upward.
 *
 * Returns where the pet was AT THE MOMENT OF RELEASE, before the fall starts. Pass settle:false to
 * skip the wait afterwards, which is required to time the fall itself: waiting here would let it
 * finish and every measurement would come back as zero.
 */
async function fingerDrag(distance, { settle = true } = {}) {
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
  // captured before any waiting, so callers can assert on the lift rather than on the landing
  const airborne = await p.evaluate(() => {
    const el = document.querySelector('[aria-label="Mochi"]')
    const m = new DOMMatrix(getComputedStyle(el).transform)
    return { x: Math.round(m.m41), y: Math.round(m.m42) }
  })
  if (settle) await p.waitForTimeout(700)
  return airborne
}

// close the sheet the tap check opened, so each finger case starts clean
await p.getByRole('button', { name: 'Close' }).first().click()
await p.waitForTimeout(700)

for (const distance of [8, 20, 45, 100]) {
  const from = await petTransform()
  const airborne = await fingerDrag(distance)
  res[`finger${distance}_didNotOpenSheet`] = (await p.getByText('Your pet').count()) === 0
  // it actually moved, so we are asserting a suppressed tap and not a dropped gesture
  res[`finger${distance}_actuallyMoved`] = from.y - airborne.y > distance * 0.6
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

// the tap check above left the care sheet open, and it covers the pet: close it before dragging
await p.getByRole('button', { name: 'Close' }).first().click()
await p.waitForTimeout(700)

// ── it must come back to the ground ────────────────────────────────────────────────────────────
// `y` is an offset from the floor and drag was the only thing that ever changed it, so a pet let go
// halfway up the screen used to stay there and carry on walking in mid-air (the wander loop only
// animates `x`).
const lifted = await fingerDrag(420) // up, to about the middle of the screen
res.dragLiftsItOffTheGround = lifted.y < -100
await p.waitForTimeout(1400)
const landed = await petTransform()
res.fallsBackToTheGround = Math.abs(landed.y) <= 1
// only the vertical position is restored; where you put it horizontally is kept
res.keepsWhereYouPutItHorizontally = Math.abs(landed.x - lifted.x) <= 2

/**
 * How long the pet takes to reach the floor from `distance` px up, or null if it never gets there.
 *
 * Null matters: without the drop the loop simply runs out, and comparing two timed-out runs made
 * this assertion pass even with the feature removed, which is worse than not having it.
 */
async function fallMs(distance) {
  await fingerDrag(distance, { settle: false })
  const started = Date.now()
  for (let i = 0; i < 100; i++) {
    if (Math.abs((await petTransform()).y) <= 1) return Date.now() - started
    await p.waitForTimeout(25)
  }
  return null
}
const shortFall = await fallMs(90)
await p.waitForTimeout(400)
const longFall = await fallMs(500)
// the duration scales with the square root of the distance, the way a real fall does. The margin is
// wider than the 25ms polling step so this cannot turn over on sampling noise.
res.fallingFurtherTakesLonger = shortFall !== null && longFall !== null && longFall - shortFall > 50
console.log(`fall from 90px: ${shortFall}ms · from 500px: ${longFall}ms`)

// grabbing it again mid-fall must not leave it stranded
await fingerDrag(400)
await p.waitForTimeout(80)
await fingerDrag(60)
await p.waitForTimeout(1500)
res.grabbingMidFallStillLands = Math.abs((await petTransform()).y) <= 1

// and landing must not kill the wander loop. A pet is an EGG for its first ~2 minutes and eggs do
// not wander, so backdate it to get a walker before watching for movement.
await p.evaluate(async () => {
  const db = await new Promise((r) => {
    const open = indexedDB.open('berdua')
    open.onsuccess = () => r(open.result)
  })
  const store = db.transaction('pets', 'readwrite').objectStore('pets')
  const rows = await new Promise((r) => {
    const get = store.getAll()
    get.onsuccess = () => r(get.result)
  })
  for (const pet of rows) {
    pet.bornAt = Date.now() - 3 * 24 * 60 * 60 * 1000
    pet.updatedAt = Date.now()
    store.put(pet)
  }
})
await p.reload({ waitUntil: 'domcontentloaded' })
await p.waitForTimeout(2500)
await fingerDrag(300)
await p.waitForTimeout(1500)
const xs = []
for (let i = 0; i < 12; i++) {
  xs.push((await petTransform()).x)
  await p.waitForTimeout(400)
}
res.resumesWanderingAfterLanding = new Set(xs).size > 1

console.log(JSON.stringify(res, null, 2))
console.log('lift on the mouse drag:', Math.round(before.y - airborneMouse.y), 'px')
console.log('errors:', errs.length ? errs : 'none')
const pass = Object.values(res).every(Boolean) && errs.length === 0
console.log(pass ? '\nPET DRAG E2E: PASS ✅' : '\nPET DRAG E2E: FAIL ❌')
await browser.close()
process.exit(pass ? 0 : 1)
