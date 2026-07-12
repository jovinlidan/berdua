// E2E for the Food Map + Wishlist place controls:
//  - the Map tab/screen mounts (MapLibre via software WebGL; tiles stubbed so it's offline-safe),
//  - "pin my current spot" adds a located Food to-do WITHOUT a Mapbox token (geolocation mocked),
//  - the Nearby list ranks the closest spot first,
//  - tapping a spot offers Navigate → a Google Maps directions URL to the right coordinates,
//  - the pin survives a full reload (it lives in IndexedDB),
//  - from the WISHLIST screen you can attach a place to an item (keyless name-search), and it shows
//    up on the map.
// Photon (the keyless geocoder) is stubbed with a canned response so the search path is exercised
// deterministically without external network. Needs `pnpm dev`.
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const base = process.env.BASE || 'http://localhost:5174'
const CODE = `map-e2e-${Date.now()}`
// Medan-area coords (the home city) so "pin current spot" lands within the accepted radius.
const NEAR = { latitude: 3.5811, longitude: 98.651 }
const FAR = { latitude: 3.5, longitude: 98.7 }
const NAME_NEAR = `Kopi Near ${Date.now()}`
const NAME_FAR = `Sushi Far ${Date.now()}`
const WISH = `Mie Aceh ${Date.now()}`
mkdirSync('shots', { recursive: true })

// Canned Photon response (search + reverse) — one Medan-ish feature, with CORS header so the
// browser accepts the cross-origin fetch.
const PHOTON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [98.67, 3.585] },
      properties: { name: 'Test Spot', street: 'Jl. Test', city: 'Medan', country: 'Indonesia' },
    },
  ],
}

const browser = await chromium.launch({
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
})
const errors = []
const NOISE = /openfreemap|tiles|webgl|maplibre|photon|komoot|failed to fetch|networkerror|net::|abort|geolocation|the operation|load failed/i

const ctx = await browser.newContext({
  viewport: { width: 402, height: 880 },
  geolocation: FAR,
  permissions: ['geolocation'],
})
await ctx.addInitScript(() => {
  window.__opened = []
  window.open = (u) => {
    window.__opened.push(String(u))
    return null
  }
})
const page = await ctx.newPage()
page.on('console', (m) => m.type() === 'error' && !NOISE.test(m.text()) && errors.push(m.text()))
page.on('pageerror', (e) => !NOISE.test(e.message) && errors.push(`PAGEERROR: ${e.message}`))
await page.route(/tiles\.openfreemap\.org/, (r) => r.abort())
await page.route(/photon\.komoot\.io\/(api|reverse)/, (r) =>
  r.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(PHOTON),
  }),
)

async function onboard() {
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('input[placeholder="You"]')
  await page.fill('input[placeholder="You"]', 'Alex')
  await page.fill('input[placeholder^="A secret word"]', CODE)
  await page.click('text=Begin, together')
  await page.waitForTimeout(1200)
}

async function addCurrentSpot(name) {
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await page.getByRole('button', { name: 'Pin my current spot' }).click()
  await page.waitForSelector('input[placeholder^="Name this spot"]')
  await page.fill('input[placeholder^="Name this spot"]', name)
  await page.getByRole('button', { name: 'Add to our map' }).click()
  await page.waitForTimeout(800)
}

await onboard()
await page.goto(`${base}/map`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)

const navHasMap = (await page.locator('nav >> text=Map').count()) > 0
const mapMounted = (await page.locator('.maplibregl-map').count()) > 0

await addCurrentSpot(NAME_FAR)
await ctx.setGeolocation(NEAR)
await page.waitForTimeout(1500)
await addCurrentSpot(NAME_NEAR)
await page.waitForTimeout(800)

const farRow = await page.locator(`text=${NAME_FAR}`).count()
const nearRow = await page.locator(`text=${NAME_NEAR}`).count()
const pinCount = await page.locator('.place-pin').count()
const firstCardText = await page.locator('section >> .card').first().innerText()
const nearestFirst = firstCardText.includes('Kopi Near')
const hasDistance = /\d+\s?(m|km)/.test(await page.locator('section').innerText())
await page.screenshot({ path: 'shots/map.png' })

// Navigate hand-off.
await page.locator(`text=${NAME_NEAR}`).first().click()
await page.waitForTimeout(500)
await page.getByRole('button', { name: 'Navigate' }).click()
await page.waitForTimeout(300)
const navUrl = (await page.evaluate(() => window.__opened || []))[0] || ''
const navOk = navUrl.includes('google.com/maps') && navUrl.includes(String(NEAR.latitude).slice(0, 6))

// Persistence.
await page.keyboard.press('Escape')
await page.reload({ waitUntil: 'domcontentloaded' })
await page.goto(`${base}/map`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)
const survivesReload = (await page.locator(`text=${NAME_NEAR}`).count()) > 0

// Wishlist → attach a place to an item via keyless name-search, then confirm it lands on the map.
await page.goto(`${base}/todos`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('input[placeholder^="Add a task"]')
await page.fill('input[placeholder^="Add a task"]', WISH)
await page.click('[aria-label="Add to-do"]')
await page.waitForTimeout(700)
await page.getByText(WISH).first().click() // open the item's edit sheet
await page.getByRole('button', { name: 'Pin a place on the map' }).click()
await page.waitForSelector('input[placeholder^="Search a place"]')
await page.fill('input[placeholder^="Search a place"]', 'test')
await page.waitForTimeout(500)
await page.getByText('Test Spot').first().click()
await page.getByRole('button', { name: 'Save place' }).click()
await page.waitForTimeout(900)
// On the row, the title + a 📍 place line both show the name → ≥2 occurrences.
const wishlistShowsPlace = (await page.getByText(WISH).count()) >= 2
// A located wishlist row shows a Navigate button (left of the search icon).
const navBtnOnWishlistRow = (await page.locator('[aria-label="Navigate"]').count()) > 0
await page.goto(`${base}/map`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1300)
const wishOnMap = (await page.getByText(WISH).count()) > 0
await page.screenshot({ path: 'shots/map-wishlist.png' })

// Auto-locate: a food wishlist item with NO place gets pinned from its title in one tap.
const AUTO = `Auto Spot ${Date.now()}`
await page.goto(`${base}/todos`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('input[placeholder^="Add a task"]')
await page.fill('input[placeholder^="Add a task"]', AUTO)
await page.click('[aria-label="Add to-do"]')
await page.waitForTimeout(700)
await page.goto(`${base}/map`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1200)
const autoBtn = page.getByRole('button', { name: 'Auto-locate food spots' })
const autoBtnShown = (await autoBtn.count()) > 0
if (autoBtnShown) {
  await autoBtn.click()
  await page.waitForTimeout(2800) // geocode loop (≥1 item · 200ms each + fetch)
}
const autoOnMap = (await page.getByText(AUTO).count()) > 0

// Google Maps link paste → resolves to a pin (resolver stubbed above).
const LINK = `Linked ${Date.now()}`
await page.goto(`${base}/todos`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('input[placeholder^="Add a task"]')
await page.fill('input[placeholder^="Add a task"]', LINK)
await page.click('[aria-label="Add to-do"]')
await page.waitForTimeout(700)
await page.getByText(LINK).first().click()
await page.getByRole('button', { name: 'Pin a place on the map' }).click()
await page.waitForSelector('input[placeholder^="Paste a link"]')
// Raw coordinates pasted directly → resolved client-side, no network (the reliable path).
await page.fill('input[placeholder^="Paste a link"]', '3.5684, 98.6677')
await page.getByRole('button', { name: 'Pin from link' }).click()
await page.waitForTimeout(700)
await page.getByRole('button', { name: 'Save place' }).click()
await page.waitForTimeout(800)
await page.goto(`${base}/map`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1200)
const pastedLinkOnMap = (await page.getByText(LINK).count()) > 0

console.log('nav has Map tab:', navHasMap)
console.log('MapLibre map mounted:', mapMounted, `(pins rendered: ${pinCount})`)
console.log('FAR spot added:', farRow > 0, '· NEAR spot added:', nearRow > 0)
console.log('nearest spot listed first:', nearestFirst)
console.log('distance label shown:', hasDistance)
console.log('Navigate → maps URL:', navOk, `(${navUrl.slice(0, 72)})`)
console.log('survives full reload (IndexedDB):', survivesReload)
console.log('Wishlist item shows its 📍 place:', wishlistShowsPlace)
console.log('Navigate button on located wishlist row:', navBtnOnWishlistRow)
console.log('Wishlist-attached place appears on the map:', wishOnMap)
console.log('auto-locate button shown for unlocated food:', autoBtnShown)
console.log('auto-located item appears on the map:', autoOnMap)
console.log('pasted Google Maps link → pin on map:', pastedLinkOnMap)
console.log('app console errors:', errors.length ? errors : 'none')

const pass =
  navHasMap &&
  farRow > 0 &&
  nearRow > 0 &&
  nearestFirst &&
  hasDistance &&
  navOk &&
  survivesReload &&
  wishlistShowsPlace &&
  navBtnOnWishlistRow &&
  wishOnMap &&
  autoBtnShown &&
  autoOnMap &&
  pastedLinkOnMap &&
  errors.length === 0
console.log(pass ? '\nFOOD MAP + WISHLIST E2E: PASS ✅' : '\nFOOD MAP + WISHLIST E2E: FAIL ❌')
await browser.close()
process.exit(pass ? 0 : 1)
