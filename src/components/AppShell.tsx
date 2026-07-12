import { motion } from 'framer-motion'
import { Suspense, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { OfflineBanner } from './OfflineBanner'
import { PetCompanion } from './PetCompanion'
import { WaitingBanner } from './WaitingBanner'

function RouteFallback() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <motion.div
        animate={{ scale: [1, 1.25, 1], opacity: [0.5, 1, 0.5] }}
        transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut' }}
        className="h-3 w-3 rounded-full bg-coral"
      />
    </div>
  )
}

/**
 * Phone-width layout: status banners, animated content, fixed bottom nav.
 * Enter-only transition (keyed remount, no AnimatePresence exit) — avoids the
 * React-Router <Outlet> flicker where the outgoing screen briefly shows the new route.
 *
 * IMPORTANT: fade ONLY — no transform. A transform here would create a containing
 * block for the screens' `position: fixed` FABs, making them jump to their real
 * spot when the animation's transform clears. Opacity doesn't do that.
 */
export function AppShell() {
  const location = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])
  // /thinking is a focused conversation view: it owns the bottom with its own message composer,
  // so we hide the global nav + roaming pet there (the screen's back button handles navigation).
  const focusedComposer = location.pathname === '/thinking'
  // /map is a full-bleed canvas: it paints edge-to-edge behind a draggable sheet, so we drop the
  // column padding and the roaming pet — but keep the nav (Map is a peer tab).
  const fullBleed = location.pathname === '/map'
  return (
    <div className="berdua-bg min-h-screen">
      <OfflineBanner />
      <div className="mx-auto w-full max-w-md px-4">
        <WaitingBanner />
      </div>
      <main className={`mx-auto w-full max-w-md ${fullBleed ? 'px-0 pb-0' : 'px-4'} ${focusedComposer || fullBleed ? 'pb-0' : 'pb-28'}`}>
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.24, ease: 'easeOut' }}
        >
          <Suspense fallback={<RouteFallback />}>
            <Outlet />
          </Suspense>
        </motion.div>
      </main>
      {!focusedComposer && !fullBleed && <PetCompanion />}
      {!focusedComposer && <BottomNav />}
    </div>
  )
}
