import { motion } from 'framer-motion'
import { PARTNER_COLORS } from '../lib/partners'
import type { DailyMoodCheck } from '../types'

/** Self-contained inline SVG: two partner mood lines (1–5) over the window, drawing in. */
export function MoodChart({ data }: { data: DailyMoodCheck[] }) {
  const points = [...data].reverse() // hook returns newest-first → chronological
  const W = 320
  const H = 130
  const pad = 16
  const n = points.length
  const xAt = (i: number) => (n <= 1 ? W / 2 : pad + (i * (W - pad * 2)) / (n - 1))
  const yAt = (v: number) => pad + ((5 - v) / 4) * (H - pad * 2)

  const coords = (key: 'moodA' | 'moodB') =>
    points
      .map((p, i) => (p[key] != null ? { x: xAt(i), y: yAt(p[key] as number) } : null))
      .filter((p): p is { x: number; y: number } => p !== null)

  const lines: { key: 'moodA' | 'moodB'; color: string }[] = [
    { key: 'moodB', color: PARTNER_COLORS.B },
    { key: 'moodA', color: PARTNER_COLORS.A },
  ]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Our moods over time">
      {[1, 3, 5].map((g) => (
        <line key={g} x1={pad} x2={W - pad} y1={yAt(g)} y2={yAt(g)} stroke="#3a2e2b" strokeOpacity={0.06} strokeWidth={1} />
      ))}
      {lines.map(({ key, color }, idx) => {
        const pts = coords(key)
        if (pts.length === 0) return null
        const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
        const last = pts[pts.length - 1]
        return (
          <g key={key}>
            {pts.length > 1 && (
              <motion.path
                d={d}
                fill="none"
                stroke={color}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.9, ease: 'easeOut', delay: idx * 0.15 }}
              />
            )}
            {pts.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={3} fill={color} />
            ))}
            <circle cx={last.x} cy={last.y} r={7} fill={color} fillOpacity={0.18} />
          </g>
        )
      })}
    </svg>
  )
}
