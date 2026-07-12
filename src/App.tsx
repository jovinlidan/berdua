import { lazy, useEffect } from 'react'
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

const Bucket = lazy(() => import('./screens/Bucket'))
const Calendar = lazy(() => import('./screens/Calendar'))
const Capsule = lazy(() => import('./screens/Capsule'))
const DailyCheckIn = lazy(() => import('./screens/DailyCheckIn'))
const Map = lazy(() => import('./screens/Map'))
const PetHabitat = lazy(() => import('./screens/PetHabitat'))
const Secrets = lazy(() => import('./screens/Secrets'))
const Settings = lazy(() => import('./screens/Settings'))
const Story = lazy(() => import('./screens/Story'))
const Thinking = lazy(() => import('./screens/Thinking'))
const Todos = lazy(() => import('./screens/Todos'))

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
