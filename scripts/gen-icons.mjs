// Generates Berdua's PWA icons from an inline SVG. Run: node scripts/gen-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const iconsDir = resolve(root, 'public/icons')
mkdirSync(iconsDir, { recursive: true })

// lucide-style heart path in a 24×24 box
const HEART =
  'M12 21 C 12 21 3 13.8 3 8.6 C 3 5.6 5.4 3 8.6 3 C 10.6 3 12 4.6 12 4.6 C 12 4.6 13.4 3 15.4 3 C 18.6 3 21 5.6 21 8.6 C 21 13.8 12 21 12 21 Z'

const heart = (fill, transform, opacity = 1) =>
  `<path d="${HEART}" fill="${fill}" fill-opacity="${opacity}" transform="${transform}" />`

// scale: heart size, two hearts leaning into each other (the two of us)
function composition({ s = 10, cx = 256 } = {}) {
  const span = 24 * s
  const gap = span * 0.5 // horizontal overlap
  const ax = cx - gap - 120 * (s / 10) // left heart x
  const bx = cx - 120 * (s / 10) + 12 // right heart x
  const y = 256 - span / 2 + 16
  return (
    heart('#FFE9DD', `translate(${ax.toFixed(1)} ${y.toFixed(1)}) scale(${s}) rotate(-11 12 12)`) +
    heart('#F2C879', `translate(${bx.toFixed(1)} ${y.toFixed(1)}) scale(${s}) rotate(11 12 12)`)
  )
}

const bg = `
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#F0A58F"/>
      <stop offset="1" stop-color="#DD7860"/>
    </linearGradient>
    <radialGradient id="h" cx="0.5" cy="0.18" r="0.9">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.28"/>
      <stop offset="0.5" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>`

const appIcon = (maskable = false) => `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  ${bg}
  <rect width="512" height="512" rx="${maskable ? 0 : 112}" fill="url(#g)"/>
  <rect width="512" height="512" rx="${maskable ? 0 : 112}" fill="url(#h)"/>
  <g>${composition({ s: maskable ? 8 : 10 })}</g>
</svg>`

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  ${bg}
  <rect width="512" height="512" rx="112" fill="url(#g)"/>
  <g>${composition({ s: 10 })}</g>
</svg>`

// monochrome badge for Android notifications (white silhouette on transparent)
const badge = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <path d="${HEART}" fill="#ffffff" transform="translate(12 14) scale(3)"/>
</svg>`

const jobs = [
  { svg: appIcon(false), out: 'public/icons/icon-192.png', size: 192 },
  { svg: appIcon(false), out: 'public/icons/icon-512.png', size: 512 },
  { svg: appIcon(true), out: 'public/icons/maskable-512.png', size: 512 },
  { svg: appIcon(false), out: 'public/icons/apple-touch-icon.png', size: 180 },
  { svg: badge, out: 'public/icons/badge-72.png', size: 72 },
]

for (const j of jobs) {
  await sharp(Buffer.from(j.svg)).resize(j.size, j.size).png().toFile(resolve(root, j.out))
  console.log('✓', j.out)
}

writeFileSync(resolve(root, 'public/favicon.svg'), favicon.trim())
console.log('✓ public/favicon.svg')
