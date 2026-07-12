import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const base = process.env.BASE || 'http://localhost:5174'
mkdirSync('shots', { recursive: true })

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 402, height: 880 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

const shot = async (name) => {
  await page.waitForTimeout(550)
  await page.screenshot({ path: `shots/${name}.png` })
  console.log('shot', name)
}

await page.goto(base + '/', { waitUntil: 'networkidle' })
await shot('01-welcome')

await page.fill('input[placeholder="You"]', 'Alex')
await page.fill('input[placeholder="Them"]', 'Sayang')
await page.fill('input[type="date"]', '2022-07-01')
await page.click('text=Begin, together')
await shot('02-home')

await page.goto(base + '/ideas', { waitUntil: 'networkidle' })
await page.locator('[aria-label="Add to favorites"]').nth(1).click()
await page.waitForTimeout(250)
await page.locator('[aria-label="Add to favorites"]').nth(2).click()
await page.waitForTimeout(350)
await shot('03-ideas')

await page.goto(base + '/surprise', { waitUntil: 'networkidle' })
await page.click('text=Surprise us')
await shot('04-surprise')

try {
  await page.goto(base + '/bucket', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(500)
  await shot('17-empty')
  await page.click('[aria-label="Add dream"]')
  await page.fill('input[placeholder^="Something we want"]', 'See the northern lights')
  await page.getByText(/Someday/).first().click()
  await page.getByText('Add to our bucket').click()
  await page.waitForTimeout(400)
  await page.click('[aria-label="Add dream"]')
  await page.fill('input[placeholder^="Something we want"]', 'Weekend road trip')
  await page.getByText('Add to our bucket').click()
  await page.waitForTimeout(400)
} catch (e) {
  console.log('(bucket seed skipped):', e.message)
}
await shot('05-bucket')

await page.goto(base + '/ideas', { waitUntil: 'networkidle' })
await page.locator('a[href^="/ideas/"]').first().click()
await shot('06-idea-detail')

// plan-a-date presets
await page.getByText('Plan this date').click()
await page.waitForTimeout(400)
await shot('16-plan')
await page.goBack()
await page.waitForTimeout(400)

// make a memory from this idea → capture screen
await page.click('text=make a memory')
await shot('07-memory-capture')

// rate as partner A + pick a mood
await page.locator('[aria-label="3 hearts"]').first().click()
await page.getByText('Romantic').click()
await page.waitForTimeout(300)
await shot('08-memory-rated')

await page.goto(base + '/memories', { waitUntil: 'networkidle' })
await shot('09-memories')

await page.goto(base + '/story', { waitUntil: 'networkidle' })
await page.waitForTimeout(1300)
await shot('15-story')

// Mood check-in
try {
  await page.goto(base + '/checkin', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: 'Great' }).click()
  await page.waitForTimeout(500)
  await shot('19-checkin')
} catch (e) {
  console.log('(checkin capture skipped):', e.message)
}

await page.goto(base + '/todos', { waitUntil: 'networkidle' })
await page.getByText('Food').first().click()
await page.fill('input[placeholder^="Add"]', 'Try the new ramen place')
await page.click('[aria-label="Add to-do"]')
await page.waitForTimeout(300)
await page.getByText('Game').first().click()
await page.fill('input[placeholder^="Add"]', 'Co-op game night')
await page.click('[aria-label="Add to-do"]')
await page.waitForTimeout(400)
// create a custom category + add to it
try {
  await page.getByRole('button', { name: 'New' }).click()
  await page.fill('input[placeholder^="New category"]', 'Date night')
  await page.getByRole('button', { name: 'Create' }).click()
  await page.waitForTimeout(400)
  await page.fill('input[placeholder^="Add"]', 'Recreate our first date')
  await page.click('[aria-label="Add to-do"]')
  await page.waitForTimeout(400)
} catch (e) {
  console.log('(category create skipped):', e.message)
}
await page.locator('[aria-label="Mark done"]').first().click()
await page.waitForTimeout(300)
await shot('12-todos')
try {
  await page.getByRole('button', { name: 'Edit category' }).first().click()
  await page.waitForTimeout(400)
  await shot('25-edit-category')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
} catch (e) {
  console.log('(edit-category capture skipped):', e.message)
}

// Time capsule
try {
  await page.goto(base + '/capsule', { waitUntil: 'domcontentloaded' })
  await page.click('[aria-label="New time capsule"]')
  await page.waitForTimeout(400)
  await page.locator('input[placeholder="Title (optional)"]').fill('Open on our anniversary')
  await page.locator('textarea').first().fill('Remember building this together')
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: /seal it/i }).click({ timeout: 6000 })
  await page.waitForTimeout(500)
  await shot('13-capsule')
} catch (e) {
  console.log('(capsule capture skipped):', e.message)
}

// Thinking-of-you sheet
await page.goto(base + '/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(900)
try {
  await page.getByText(/Thinking of/).first().click({ timeout: 5000 })
  await page.waitForTimeout(400)
  await shot('14-ping')
  await page.keyboard.press('Escape')
} catch {
  console.log('(ping sheet capture skipped)')
}

await page.goto(base + '/settings', { waitUntil: 'networkidle' })
await page.click('[aria-label="Ocean"]')
await page.waitForTimeout(400)
await shot('10-settings')
await page.getByText('Dark', { exact: true }).click()
await page.waitForTimeout(500)
await shot('23-dark-settings')

// back to home — now with the "our story" stats + todos card; let the counter finish
await page.goto(base + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1300)
await shot('11-home-rich')

console.log('CONSOLE ERRORS:', errors.length ? errors : 'none')
await browser.close()
