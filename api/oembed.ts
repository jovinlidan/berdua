import type { VercelRequest, VercelResponse } from '@vercel/node'

// GET /api/oembed?url=... → { title, thumbnail, author } for TikTok/YouTube (public oEmbed).
// Instagram's public oEmbed needs an app token, so we return {} and the client falls back
// to URL-parsed titles. Server-side fetch avoids the browser CORS wall.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = req.query.url as string | undefined
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'missing url' })

  // cache successful lookups at the edge for a day
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate')

  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    let endpoint: string | null = null
    if (host.includes('tiktok')) endpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`
    else if (host.includes('youtube') || host.includes('youtu.be'))
      endpoint = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`

    if (endpoint) {
      const r = await fetch(endpoint, { signal: AbortSignal.timeout(5000) })
      if (r.ok) {
        const d = (await r.json()) as { title?: string; thumbnail_url?: string; author_name?: string }
        return res.status(200).json({ title: d.title, thumbnail: d.thumbnail_url, author: d.author_name })
      }
    }
    return res.status(200).json({})
  } catch {
    return res.status(200).json({})
  }
}
