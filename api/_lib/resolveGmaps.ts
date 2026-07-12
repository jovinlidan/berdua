// Resolve a shared Google Maps link to coordinates. Runs server-side because the browser can't
// follow Google's cross-origin redirects or read the resulting page. Lets the user paste a Maps
// "Share" link instead of typing — handy for spots OpenStreetMap doesn't have. Host-allowlisted
// to avoid SSRF (we only ever fetch Google's own short/long map URLs).
const ALLOWED_HOSTS = new Set([
  'maps.app.goo.gl',
  'goo.gl',
  'maps.google.com',
  'www.google.com',
  'google.com',
  'g.co',
])

export interface ResolvedPlace {
  name?: string
  lat: number
  lng: number
}

export async function resolveGmapsUrl(input: string): Promise<ResolvedPlace | null> {
  let parsed: URL
  try {
    parsed = new URL(input.trim())
  } catch {
    return null
  }
  const host = parsed.hostname.replace(/^www\./, '')
  if (!ALLOWED_HOSTS.has(parsed.hostname) && !ALLOWED_HOSTS.has(host)) return null

  // Fast path: a full Maps URL already carries coordinates — no network call needed.
  const direct = extractCoords(parsed.toString())
  if (direct) return { ...direct, name: extractName(parsed.toString()) }

  // Otherwise it's a short link (e.g. maps.app.goo.gl) — follow the redirect and parse the result.
  // Hard 6s timeout so a slow/looping redirect can never hang the request.
  let finalUrl = parsed.toString()
  let body = ''
  try {
    const res = await fetch(finalUrl, {
      redirect: 'follow',
      signal: AbortSignal.timeout(6000),
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; BerduaBot/1.0)',
        'accept-language': 'en-US,en;q=0.9',
        // skip Google's cookie-consent interstitial so we land on the real map page
        cookie: 'CONSENT=YES+cb',
      },
    })
    finalUrl = res.url || finalUrl
    body = await res.text()
  } catch {
    // network error / timeout — still try to parse coords out of the (possibly long) input URL
  }

  // For a followed short link, ONLY trust place-specific signals — never the viewport center, which
  // Google geolocates to the *server's* region. (Datacenter IPs often get a stripped page with only
  // the viewport, so we'd rather return nothing than a confidently-wrong location.)
  const coords = extractCoords(`${finalUrl}\n${body}`, true)
  if (!coords) return null
  return { lat: coords.lat, lng: coords.lng, name: extractName(finalUrl) }
}

function valid(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  )
}

function extractCoords(s: string, placeOnly = false): { lat: number; lng: number } | null {
  if (!s) return null
  // Place-specific signals first — reliable and region-independent:
  const placePatterns = [
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, // the place's exact location
    /[?&](?:q|query|destination|daddr)=(-?\d+\.\d+)(?:,|%2C)(-?\d+\.\d+)/, // searched / destination place
    /\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\]/, // place coords in the embedded app state
  ]
  for (const re of placePatterns) {
    const m = s.match(re)
    if (m && valid(+m[1], +m[2])) return { lat: +m[1], lng: +m[2] }
  }
  // The map's viewport center depends on the requester's region — only usable for a URL the user
  // pasted directly (then @ is the place they were looking at), never for a server-followed link.
  if (placeOnly) return null
  const viewportPatterns = [
    /[?&](?:ll|center)=(-?\d+\.\d+)(?:,|%2C)(-?\d+\.\d+)/,
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
  ]
  for (const re of viewportPatterns) {
    const m = s.match(re)
    if (m && valid(+m[1], +m[2])) return { lat: +m[1], lng: +m[2] }
  }
  return null
}

function extractName(s: string): string | undefined {
  const m = s.match(/\/maps\/place\/([^/@?]+)/)
  if (!m) return undefined
  try {
    return decodeURIComponent(m[1].replace(/\+/g, ' ')).trim() || undefined
  } catch {
    return undefined
  }
}
