import { chromium } from 'playwright'
const base = process.env.BASE || 'http://localhost:5174'
const b = await chromium.launch(); const page = await b.newPage()
const errors = []; page.on('console', m=>m.type()==='error'&&errors.push(m.text())); page.on('pageerror', e=>errors.push(String(e)))
await page.goto(base+'/', {waitUntil:'networkidle'})
if((await page.locator('input[placeholder="You"]').count())>0){
  await page.fill('input[placeholder="You"]','Alex'); await page.fill('input[placeholder="Them"]','Sayang')
  await page.fill('input[type="date"]','2022-07-01'); await page.click('text=Begin, together'); await page.waitForTimeout(400)
}
// go to first idea, plan it
await page.goto(base+'/ideas', {waitUntil:'networkidle'})
await page.locator('a[href^="/ideas/"]').first().click()
await page.waitForURL(/\/ideas\/.+/); await page.waitForTimeout(300)
await page.click('text=Plan this date'); await page.waitForURL(/\/plan\/.+/); await page.waitForTimeout(300)
await page.click('text=Add to our plans'); await page.waitForURL(/\/$|\/$/, {timeout:5000}).catch(()=>{}); await page.waitForTimeout(400)
// back to the idea detail
await page.goto(base+'/ideas', {waitUntil:'networkidle'})
await page.locator('a[href^="/ideas/"]').first().click(); await page.waitForTimeout(400)
const hasBtn = await page.locator('text=Add to calendar').count()
console.log('Add-to-calendar button shown when planned:', hasBtn>0)
let downloaded=null
if(hasBtn>0){
  const [dl] = await Promise.all([ page.waitForEvent('download',{timeout:4000}).catch(()=>null), page.click('text=Add to calendar') ])
  downloaded = dl
  console.log('Download triggered:', !!dl, dl?('('+dl.suggestedFilename()+')'):'')
}
console.log('CONSOLE ERRORS:', errors.length?errors:'none')
await b.close(); process.exit(0)
