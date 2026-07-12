// Notification pipeline. Phase 1 proves the path locally (permission → SW shows notification).
// Phase 2: subscribe to Push and sync the subscription so the cloud cron can reach this device.
import type { PartnerKey, PushSub } from '../types'

// Public VAPID key (safe to ship). Override per-deploy with VITE_VAPID_PUBLIC_KEY.
// The matching PRIVATE key lives only in the serverless env (VAPID_PRIVATE_KEY).
const VAPID_PUBLIC_KEY =
  import.meta.env.VITE_VAPID_PUBLIC_KEY ||
  'BDI6K_ZUmV1Orf9VrrCYzju5FC-h8zjI9T-eS9x2RJ5zjMH7ZBQP_V6tfY6mq_CHAyKFHHfaMP53rqcVl6Hv8pM'

export type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported'

export function notificationSupport(): {
  supported: boolean
  permission: PermissionState
  isStandalone: boolean
} {
  const supported =
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  const permission: PermissionState = supported ? (Notification.permission as PermissionState) : 'unsupported'
  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      // @ts-expect-error iOS-only Safari flag
      window.navigator.standalone === true)
  return { supported, permission, isStandalone }
}

export async function requestPermission(): Promise<PermissionState> {
  if (!('Notification' in window)) return 'unsupported'
  return (await Notification.requestPermission()) as PermissionState
}

/** Subscribe this device to Web Push and return a syncable subscription record. */
export async function subscribeToPush(partner: PartnerKey, deviceId: string): Promise<PushSub | null> {
  if (!VAPID_PUBLIC_KEY) return null
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null
  try {
    const reg = await navigator.serviceWorker.ready
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      }))
    const json = sub.toJSON()
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return null
    return {
      deviceId,
      partner,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      updatedAt: Date.now(),
    }
  } catch {
    return null
  }
}

/** Fire a notification through the service worker — proves the SW pipeline end to end. */
export async function sendDemoNotification(coupleName = 'you two'): Promise<void> {
  if (Notification.permission !== 'granted') return
  const reg = await navigator.serviceWorker.ready
  await reg.showNotification('A little nudge from Berdua 💌', {
    body: `Thinking of ${coupleName} 💞`,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    tag: 'berdua-demo',
    data: { url: '/' },
  })
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}
