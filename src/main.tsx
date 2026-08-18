import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'

// Self-hosted fonts (offline-reliable for an installed PWA).
//
// Imported per weight AND per subset, because the whole-family imports pull in cyrillic,
// cyrillic-ext and vietnamese, which this app never renders, plus four weights it never uses. All
// of it gets precached by the service worker, so it was paid for on install and again on every
// deploy. The six faces below are the complete set the UI actually computes, checked against every
// screen in the browser rather than by reading class names:
//   Nunito 400/600/700 (body), Fraunces 400/600 (headings, and the pet rename inputs), Caveat 400.
// latin-ext stays for accented names.
import '@fontsource/fraunces/latin-400.css'
import '@fontsource/fraunces/latin-ext-400.css'
import '@fontsource/fraunces/latin-600.css'
import '@fontsource/fraunces/latin-ext-600.css'
import '@fontsource/nunito/latin-400.css'
import '@fontsource/nunito/latin-ext-400.css'
import '@fontsource/nunito/latin-600.css'
import '@fontsource/nunito/latin-ext-600.css'
import '@fontsource/nunito/latin-700.css'
import '@fontsource/nunito/latin-ext-700.css'
import '@fontsource/caveat/latin-400.css'
import '@fontsource/caveat/latin-ext-400.css'

import './index.css'
import App from './App'

// Register the custom service worker (push + offline). autoUpdate keeps it fresh.
registerSW({ immediate: true })

// When a NEW service worker takes control (i.e. an app update), reload once so the user lands on
// the fresh version automatically instead of a blank shell they'd have to refresh by hand. We skip
// the very first install (no prior controller) since that page is already showing fresh content.
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller
  let reloaded = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return
    reloaded = true
    window.location.reload()
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
