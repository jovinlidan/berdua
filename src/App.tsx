import { type ComponentType, lazy, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastProvider } from './components/Toast'
import { useCouple } from './db/hooks'
import { ensureDefaultTodoGroups } from './db/repo'
import { applyAccent, applyMode } from './lib/theme'
import { useSession } from './store/useSession'
import { useSync } from './sync/useSync'
// Home + Welcome stay eager (entry points); everything else code-splits for a smaller initial bundle.
import Home from './screens/Home'
import Welcome from './screens/Welcome'

const RELOADED_KEY = 'berdua-chunk-reload'

/** Shown when a screen's code cannot be fetched at all, in place of crashing the whole app. */
function ScreenUnavailable() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-6 text-center">
      <div>
        <p className="text-5xl">🌙</p>
        <p className="mt-3 font-serif text-lg font-semibold text-ink">This part needs a connection</p>
        <p className="mt-1 text-sm text-ink-soft">
          Everything already on your phone still works. Try again once you are back online.
        </p>
      </div>
    </div>
  )
}

/**
 * Lazy-load a screen, surviving the two ways its chunk can fail to arrive.
 *
 * A deploy gives every chunk a new hashed name, so a tab that has been open across one asks for a
 * file that no longer exists; one reload picks up the new index.html and fixes it for good. Offline,
 * a reload cannot help, so the screen says so instead. Without this, either case rejects the lazy
 * import and takes down the whole app through the root ErrorBoundary.
 */
function lazyScreen(load: () => Promise<{ default: ComponentType }>) {
  return lazy(() =>
    load()
      .then((mod) => {
        sessionStorage.removeItem(RELOADED_KEY)
        return mod
      })
      .catch(() => {
        const canRetry = navigator.onLine && !sessionStorage.getItem(RELOADED_KEY)
        if (!canRetry) return { default: ScreenUnavailable }
        sessionStorage.setItem(RELOADED_KEY, '1') // once only, so a real 404 cannot loop
        window.location.reload()
        return new Promise<{ default: ComponentType }>(() => {}) // the reload takes over
      }),
  )
}

const Bucket = lazyScreen(() => import('./screens/Bucket'))
const Calendar = lazyScreen(() => import('./screens/Calendar'))
const Capsule = lazyScreen(() => import('./screens/Capsule'))
const DailyCheckIn = lazyScreen(() => import('./screens/DailyCheckIn'))
const Map = lazyScreen(() => import('./screens/Map'))
const PetHabitat = lazyScreen(() => import('./screens/PetHabitat'))
const Routines = lazyScreen(() => import('./screens/Routines'))
const Secrets = lazyScreen(() => import('./screens/Secrets'))
const Settings = lazyScreen(() => import('./screens/Settings'))
const Story = lazyScreen(() => import('./screens/Story'))
const Thinking = lazyScreen(() => import('./screens/Thinking'))
const Todos = lazyScreen(() => import('./screens/Todos'))

function Splash() {
  return (
    <div className="berdua-bg grid min-h-screen place-items-center">
      <div className="animate-pulse text-center">
        <div className="font-serif text-4xl font-semibold text-coral">Berdua</div>
        <p className="mt-1 font-script text-2xl text-ink-soft">just the two of us</p>
      </div>
    </div>
  )
}

/** When a notification is tapped while the app is open, the SW asks us to deep-link. */
function ServiceWorkerNavBridge() {
  const navigate = useNavigate()
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'berdua-navigate' && typeof e.data.url === 'string') {
        navigate(e.data.url)
      }
    }
    navigator.serviceWorker.addEventListener('message', handler)
    return () => navigator.serviceWorker.removeEventListener('message', handler)
  }, [navigate])
  return null
}

/** Applies the couple's accent (synced) + this device's light/dark mode (per-device). */
function ThemeApplier() {
  const couple = useCouple()
  const themeMode = useSession((s) => s.themeMode)
  useEffect(() => {
    applyAccent(couple?.themeAccent)
  }, [couple?.themeAccent])
  useEffect(() => {
    applyMode(themeMode)
    if (themeMode !== 'auto') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyMode('auto')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [themeMode])
  return null
}

/** Gate the main app behind onboarding. undefined = loading, null = needs onboarding. */
function CoupleGate() {
  const couple = useCouple()
  if (couple === undefined) return <Splash />
  if (couple === null) return <Navigate to="/welcome" replace />
  return <AppShell />
}

export default function App() {
  useSync()
  useEffect(() => {
    void ensureDefaultTodoGroups()
  }, [])

  return (
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <ServiceWorkerNavBridge />
          <ThemeApplier />
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  )
}

function AppRoutes() {
  return (
    <Routes>
        <Route path="/welcome" element={<Welcome />} />
        <Route element={<CoupleGate />}>
          <Route path="/" element={<Home />} />
          <Route path="/bucket" element={<Bucket />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/map" element={<Map />} />
          <Route path="/pet" element={<PetHabitat />} />
          <Route path="/todos" element={<Todos />} />
          <Route path="/routines" element={<Routines />} />
          <Route path="/capsule" element={<Capsule />} />
          <Route path="/checkin" element={<DailyCheckIn />} />
          <Route path="/secrets" element={<Secrets />} />
          <Route path="/story" element={<Story />} />
          <Route path="/thinking" element={<Thinking />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
