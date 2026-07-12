import type { VercelRequest, VercelResponse } from '@vercel/node'
import webpush from 'web-push'
import type { PartnerKey, SyncDoc } from '../src/types.js'
import { docKey, redis } from './_lib/kv.js'

// POST /api/ping { code, fromPartner, message? } → push "thinking of you" to the OTHER partner's devices.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method not allowed' })
  }
  const { code, fromPartner, message } = (req.body ?? {}) as {
    code?: string
    fromPartner?: PartnerKey
    message?: string
  }
  if (!code || (fromPartner !== 'A' && fromPartner !== 'B')) {
    return res.status(400).json({ error: 'bad request' })
  }

  const publicKey = process.env.VITE_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return res.status(500).json({ error: 'VAPID not configured' })
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:berdua@example.com', publicKey, privateKey)

  const key = docKey(code)
  const doc = await redis.get<SyncDoc>(key)
  if (!doc) return res.status(404).json({ error: 'no couple' })

  const fromName = fromPartner === 'A' ? doc.couple?.partnerAName : doc.couple?.partnerBName
  const body = message?.trim() || `${fromName || 'Someone'} is thinking of you 💕`
  const targets = doc.subscriptions.filter((s) => s.partner !== fromPartner)

  let sent = 0
  let dirty = false
  for (const sub of targets) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title: '💭 Thinking of you', body, url: '/', tag: 'berdua-ping' }),
      )
      sent++
    } catch (err) {
      const sc = (err as { statusCode?: number })?.statusCode
      if (sc === 404 || sc === 410) {
        doc.subscriptions = doc.subscriptions.filter((s) => s.endpoint !== sub.endpoint)
        dirty = true
      }
    }
  }
  if (dirty) await redis.set(key, doc)
  return res.status(200).json({ ok: true, sent })
}
