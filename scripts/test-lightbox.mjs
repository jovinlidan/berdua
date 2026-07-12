// Verifies the memory photo lightbox is a swipeable gallery: add 3 photos, open it,
// navigate with the chevrons + arrow keys, and confirm the counter tracks. Run vs dev server.
import { chromium } from 'playwright'

const base = process.env.BASE || 'http://localhost:5174'
// tiny valid 1x1 PNGs (compressImage decodes these fine)
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
)
const files = [1, 2, 3].map((n) => ({ name: `p${n}.png`, mimeType: 'image/png', buffer: PNG }))

const browser = await chromium.launch()
const page = await browser.newPage()
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

await page.goto(base + '/', { waitUntil: 'networkidle' })
if ((await page.locator('input[placeholder="You"]').count()) > 0) {
  await page.fill('input[placeholder="You"]', 'Alex')
  await page.fill('input[placeholder="Them"]', 'Sayang')
  await page.fill('input[type="date"]', '2022-07-01')
  await page.click('text=Begin, together')
  await page.waitForTimeout(400)
}

// Create a memory via Home quick-add, which navigates to its detail page.
await page.goto(base + '/', { waitUntil: 'networkidle' })
await page.click('text=Memory')
await page.waitForURL(/\/memories\/.+/, { timeout: 5000 })
await page.waitForTimeout(300)

// Add 3 photos through the hidden file input.
await page.setInputFiles('input[type=file]', files)
await page.waitForTimeout(1200)
const thumbs = await page.locator('button.cursor-zoom-in').count()
console.log('Photo thumbnails present:', thumbs)

// Open the lightbox on the first photo.
await page.locator('button.cursor-zoom-in').first().click()
await page.waitForTimeout(300)
const c1 = await page.locator('text=/^1 \\/ 3$/').count()
console.log('Lightbox opened at 1 / 3:', c1 > 0)

// Next via chevron → 2 / 3
await page.click('[aria-label="Next photo"]')
await page.waitForTimeout(250)
console.log('After Next → 2 / 3:', (await page.locator('text=/^2 \\/ 3$/').count()) > 0)

// Next via keyboard → 3 / 3, and Next disabled at the end
await page.keyboard.press('ArrowRight')
await page.waitForTimeout(250)
console.log('After ArrowRight → 3 / 3:', (await page.locator('text=/^3 \\/ 3$/').count()) > 0)
console.log('Next disabled at end:', await page.locator('[aria-label="Next photo"]').isDisabled())

// Back to start via keyboard
await page.keyboard.press('ArrowLeft')
await page.keyboard.press('ArrowLeft')
await page.waitForTimeout(250)
console.log('Back to 1 / 3:', (await page.locator('text=/^1 \\/ 3$/').count()) > 0)
console.log('Prev disabled at start:', await page.locator('[aria-label="Previous photo"]').isDisabled())

// Close (wait out the overlay fade-exit before asserting it left the DOM)
await page.keyboard.press('Escape')
await page.waitForTimeout(700)
console.log('Closed on Escape:', (await page.locator('[aria-label="Next photo"]').count()) === 0)

console.log('CONSOLE ERRORS:', errors.length ? errors : 'none')
await browser.close()
process.exit(0)
