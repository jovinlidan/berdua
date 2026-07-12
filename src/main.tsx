import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'

// Self-hosted fonts (offline-reliable for an installed PWA)
import '@fontsource/fraunces/400.css'
import '@fontsource/fraunces/500.css'
import '@fontsource/fraunces/600.css'
import '@fontsource/fraunces/700.css'
import '@fontsource/nunito/400.css'
import '@fontsource/nunito/600.css'
import '@fontsource/nunito/700.css'
import '@fontsource/nunito/800.css'
import '@fontsource/caveat/400.css'
import '@fontsource/caveat/700.css'

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
