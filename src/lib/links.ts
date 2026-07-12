import type { LinkSource } from '../types'

export const LINK_SOURCE: Record<LinkSource, { label: string; emoji: string }> = {
  tiktok: { label: 'TikTok', emoji: '🎵' },
  instagram: { label: 'Instagram', emoji: '📸' },
  youtube: { label: 'YouTube', emoji: '▶️' },
  link: { label: 'Link', emoji: '🔗' },
}

export function isLikelyUrl(s: string): boolean {
  const t = s.trim()
  return /^https?:\/\//i.test(t) || /\b(tiktok\.com|instagram\.com|youtu)/i.test(t)
}

/** Derive a source + sensible title purely from the URL string (works offline). */
export function parseLink(raw: string): { source: LinkSource; title: string } {
  let url = raw.trim()
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    if (host.includes('tiktok')) {
      const handle = u.pathname.match(/@([^/]+)/)?.[1]
      return { source: 'tiktok', title: handle ? `TikTok by @${handle}` : 'Saved from TikTok' }
    }
    if (host.includes('instagram')) {
      if (/\/reels?\//.test(u.pathname)) return { source: 'instagram', title: 'Instagram reel' }
      if (/\/p\//.test(u.pathname)) return { source: 'instagram', title: 'Instagram post' }
      const seg = u.pathname.split('/').filter(Boolean)[0]
      return { source: 'instagram', title: seg ? `@${seg} on Instagram` : 'Saved from Instagram' }
    }
    if (host.includes('youtube') || host.includes('youtu.be')) return { source: 'youtube', title: 'Saved from YouTube' }
    return { source: 'link', title: host }
  } catch {
    return { source: 'link', title: 'Saved link' }
  }
}

/** Enrich a link via the serverless oEmbed proxy; gracefully falls back to URL parsing. */
export async function fetchLinkMeta(
  url: string,
): Promise<{ title: string; source: LinkSource; thumb?: string }> {
  const parsed = parseLink(url)
  try {
    const res = await fetch(`/api/oembed?url=${encodeURIComponent(url.trim())}`)
    if (res.ok) {
      const data = (await res.json()) as { title?: string; thumbnail?: string }
      if (data && (data.title || data.thumbnail)) {
        return { title: data.title?.trim() || parsed.title, source: parsed.source, thumb: data.thumbnail }
      }
    }
  } catch {
    /* offline / no backend — use the parsed fallback */
  }
  return { title: parsed.title, source: parsed.source }
}
