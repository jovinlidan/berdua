import { useEffect } from 'react'
import { subscribeToPush } from '../lib/notifications'
import { useSession } from '../store/useSession'
import { onChange } from './bus'
import { useSyncStatus } from './status'
import { syncOnce } from './sync'

// Idle polls are now cheap read-only GETs (see syncOnce), so we can space them out — this is the
// main lever on Redis usage for an open app. 30s keeps the partner's changes feeling near-live while
// staying easily within Upstash's free tier; focus/visibility/online events still sync immediately.
const POLL_MS = 30_000
const DEBOUNCE_MS = 1_500

/** Drives phase-2 sync: pull/push on mount, on focus, on a poll, and after local changes. */
export function useSync() {
  useEffect(() => {
    const repairPushSubscription = async () => {
      if (!('Notification' in window) || Notification.permission !== 'granted') return
      const current = useSession.getState()
      const sub = await subscribeToPush(current.activePartner, current.deviceId)
      if (!sub) return
      const saved = useSession.getState().pushSub
      const unchanged =
        saved?.partner === sub.partner &&
        saved.endpoint === sub.endpoint &&
        saved.p256dh === sub.p256dh &&
        saved.auth === sub.auth
      if (!unchanged) useSession.getState().setPushSub(sub)
    }

    const run = () => {
      void syncOnce()
    }
    run()
    void repairPushSubscription()

    const poll = window.setInterval(run, POLL_MS)
    const onFocus = () => run()
    const onVisible = () => document.visibilityState === 'visible' && run()
    const onOnline = () => run() // sync the moment connectivity returns
    const onOffline = () => useSyncStatus.getState().set('offline')
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    let debounce: number | undefined
    const offChange = onChange(() => {
      window.clearTimeout(debounce)
      debounce = window.setTimeout(run, DEBOUNCE_MS)
    })

    return () => {
      window.clearInterval(poll)
      window.clearTimeout(debounce)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      offChange()
    }
  }, [])
}
