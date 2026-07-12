import type { VercelRequest, VercelResponse } from '@vercel/node'
import webpush from 'web-push'
import type { SyncDoc } from '../src/types.js'
import { COUPLES_SET, docKey, redis } from './_lib/kv.js'
import { dueReminders, reminderDeliveryKey } from './_lib/reminders.js'

// Triggered every ~15 min by a free external cron (cron-job.org): GET /api/cron?key=CRON_SECRET
// Reads every couple's doc, sends any due Web Push reminders, prunes dead subscriptions.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (process.env.CRON_SECRET && req.query.key !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  const publicKey = process.env.VITE_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) {
    return res.status(500).json({ error: 'VAPID keys not configured' })
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:berdua@example.com', publicKey, privateKey)

  const now = Date.now()
  const codes = ((await redis.smembers(COUPLES_SET)) as string[]) ?? []
  let sent = 0

  // Fetch every couple's doc in a single round trip instead of one GET per couple.
  const docs = codes.length ? await redis.mget<SyncDoc[]>(...codes.map(docKey)) : []
  let failed = 0
  let pending = 0

  for (let i = 0; i < codes.length; i++) {
    const code = codes[i]
    const key = docKey(code)
    const doc = docs[i]
    if (!doc) continue

    // Event-level keys are retained for backwards compatibility. New deliveries are tracked per
    // device so a transient failure on one phone can retry without notifying the other twice.
    const fresh = dueReminders(doc, now).filter((event) => !doc.remindersSent.includes(event.key))
    if (fresh.length === 0) continue

    let dirty = false
    for (const event of fresh) {
      let delivered = 0
      const targets = doc.subscriptions.filter(
        (sub) => !doc.remindersSent.includes(reminderDeliveryKey(event.key, sub.deviceId)),
      )
      for (const sub of targets) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({ title: event.title, body: event.body, url: event.url, tag: event.key }),
          )
          sent++
          delivered++
          doc.remindersSent.push(reminderDeliveryKey(event.key, sub.deviceId))
          dirty = true
        } catch (err) {
          const code = (err as { statusCode?: number })?.statusCode
          failed++
          if (code === 404 || code === 410) {
            doc.subscriptions = doc.subscriptions.filter((s) => s.endpoint !== sub.endpoint)
            dirty = true
          }
        }
      }
      // An event with no subscription, or any unsuccessful target, remains eligible on the next
      // cron run. Successful devices keep their own delivery key and will not receive a duplicate.
      if (targets.length === 0 && doc.subscriptions.length === 0) pending++
      else if (targets.length > 0 && delivered < targets.length) pending++
    }

    if (doc.remindersSent.length > 300) doc.remindersSent = doc.remindersSent.slice(-300)
    if (dirty) await redis.set(key, doc)
  }

  return res.status(200).json({ ok: true, couples: codes.length, sent, failed, pending })
}
