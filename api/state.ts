import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { SyncDoc, SyncSnapshot } from '../src/types.js'
import { COUPLES_SET, docKey, redis } from './_lib/kv.js'
import { emptyDoc, joinAndMerge } from './_lib/merge.js'

// GET    /api/state?code=...           → the merged shared doc (read-only pull; one Redis op)
// POST   /api/state { code, doc, ... }  → merge the client's snapshot in, return the merged doc
// DELETE /api/state?code=...            → erase the couple's doc (frees both A/B slots)
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const code =
    req.method === 'POST' ? (req.body?.code as string | undefined) : (req.query.code as string | undefined)

  if (!code || typeof code !== 'string' || code.length > 200) {
    return res.status(400).json({ error: 'missing or invalid code' })
  }
  const key = docKey(code)

  try {
    if (req.method === 'GET') {
      const doc = (await redis.get<SyncDoc>(key)) ?? emptyDoc()
      return res.status(200).json(doc)
    }

    if (req.method === 'DELETE') {
      // One round trip: drop the doc and forget the code so the cron stops scanning it.
      await redis.pipeline().del(key).srem(COUPLES_SET, code).exec()
      return res.status(200).json({ ok: true })
    }

    if (req.method === 'POST') {
      const incoming = req.body?.doc as SyncSnapshot | undefined
      if (!incoming) return res.status(400).json({ error: 'missing doc' })
      const deviceId = req.body?.deviceId as string | undefined
      const myName = req.body?.myName as string | undefined
      const stored = (await redis.get<SyncDoc>(key)) ?? emptyDoc()
      const result = joinAndMerge(stored, incoming, deviceId, myName, Date.now())
      if (result.full || !result.doc) return res.status(409).json({ error: result.error ?? 'couple_full' })
      // Persist the merged doc and ensure membership in one round trip instead of two.
      await redis.pipeline().set(key, result.doc).sadd(COUPLES_SET, code).exec()
      return res.status(200).json({ ...result.doc, assignedPartner: result.assignedPartner })
    }

    res.setHeader('Allow', 'GET, POST, DELETE')
    return res.status(405).json({ error: 'method not allowed' })
  } catch (err) {
    console.error('state error', err)
    return res.status(500).json({ error: 'sync failed' })
  }
}
