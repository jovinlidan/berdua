import type { VercelRequest, VercelResponse } from '@vercel/node'
import { resolveGmapsUrl } from './_lib/resolveGmaps.js'

// GET /api/resolve-place?url=<google maps share link> → { name?, lat, lng }
// Resolves a pasted Google Maps link to coordinates (server-side redirect-follow + parse).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = (req.query.url as string | undefined) ?? (req.body?.url as string | undefined)
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'missing url' })
  try {
    const place = await resolveGmapsUrl(url)
    if (!place) return res.status(422).json({ error: 'no_location' })
    return res.status(200).json(place)
  } catch {
    return res.status(500).json({ error: 'resolve_failed' })
  }
}
