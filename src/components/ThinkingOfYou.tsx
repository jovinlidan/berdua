import { Heart } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCouple, useThinkingPings } from '../db/hooks'
import { useT } from '../lib/i18n'
import { otherPartner, partnerName } from '../lib/partners'
import { useSession } from '../store/useSession'

export function ThinkingOfYou() {
  const couple = useCouple()
  const pings = useThinkingPings()
  const { activePartner, lastSeenThinkingAt } = useSession()
  const t = useT()

  if (!couple) return null
  const partner = partnerName(couple, otherPartner(activePartner))

  // The newest ping the partner sent us — drives the teaser line + the unread dot.
  const latestReceived = (pings ?? []).find((p) => p.fromPartner !== activePartner)
  const unread = !!latestReceived && latestReceived.createdAt > lastSeenThinkingAt

  return (
    <Link
      to="/thinking"
      className="card flex w-full items-center gap-3 p-4 text-left transition active:scale-[0.99]"
    >
      <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-coral/15 text-coral">
        <Heart size={22} fill="currentColor" />
        {unread && (
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-coral ring-2 ring-paper" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold text-ink">{t('Thinking of {partner}?', { partner })}</span>
        {latestReceived ? (
          <span className="block truncate text-sm text-ink-soft">
            💭 “{latestReceived.message}”
          </span>
        ) : (
          <span className="block text-sm text-ink-soft">{t('Send a little ping 💭')}</span>
        )}
      </span>
    </Link>
  )
}
