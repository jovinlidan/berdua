import { Bell, Heart, Share, SquarePlus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { haptic } from '../lib/haptics'
import { useT } from '../lib/i18n'
import { notificationSupport, requestPermission, subscribeToPush } from '../lib/notifications'
import { useSession } from '../store/useSession'
import { joinCouple } from '../sync/sync'

export default function Welcome() {
  const t = useT()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [anniversary, setAnniversary] = useState('')
  const [code, setCode] = useState('')
  const [notifGranted, setNotifGranted] = useState(false)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const support = notificationSupport()
  const { activePartner, deviceId, setPushSub } = useSession()

  const canBegin = name.trim().length > 0 && code.trim().length > 0 && !joining

  async function enableNotifs() {
    const result = await requestPermission()
    let subscribed = false
    if (result === 'granted') {
      const sub = await subscribeToPush(activePartner, deviceId)
      if (sub) {
        setPushSub(sub)
        subscribed = true
      }
    }
    setNotifGranted(subscribed)
    haptic(8)
  }

  async function begin() {
    if (!canBegin) return
    setError(null)
    setJoining(true)
    const result = await joinCouple({
      name: name.trim(),
      code: code.trim(),
      anniversary: anniversary || null,
    })
    setJoining(false)
    if (result.status === 'name_taken') {
      setError(t('Your partner already uses that name. Pick a different name for yourself.'))
      haptic([20, 60, 20])
      return
    }
    if (result.status === 'full') {
      setError(
        t('This code is already used by two people. If one of them is you, enter the name you signed up with.'),
      )
      haptic([20, 60, 20])
      return
    }
    if (result.status === 'offline') {
      setError(t('Couldn’t reach the server. Check your connection and try again.'))
      return
    }
    haptic([10, 40, 10])
    navigate('/', { replace: true })
  }

  return (
    <div className="berdua-bg min-h-screen">
      <div className="mx-auto w-full max-w-md px-5 pb-12 pt-[calc(2.5rem+env(safe-area-inset-top))]">
        <div className="mb-8 text-center">
          <Heart className="mx-auto mb-2 text-coral" size={40} fill="currentColor" />
          <h1 className="font-serif text-5xl font-semibold text-ink">Berdua</h1>
          <p className="mt-1 font-script text-3xl text-coral">{t('just the two of us')}</p>
          <p className="mx-auto mt-3 max-w-xs text-sm text-ink-soft">
            {t('A warm little pocket-world for your dates, dreams, and the memories you make together.')}
          </p>
        </div>

        <div className="card space-y-4 p-5">
          <div>
            <label className="mb-1.5 block text-sm font-bold text-ink-soft">{t('Your name')}</label>
            <input className="field" placeholder={t('You')} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-bold text-ink-soft">{t('The day it began 💞 (optional)')}</label>
            <input
              type="date"
              className="field"
              value={anniversary}
              onChange={(e) => setAnniversary(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-bold text-ink-soft">{t('Your couple code')}</label>
            <input
              className="field"
              placeholder={t('A secret word, just for the two of you')}
              value={code}
              onChange={(e) => {
                setCode(e.target.value)
                setError(null)
              }}
            />
            <p className="mt-1.5 text-xs text-ink-soft/80">
              {t('Pick a word and share it with your partner. Whoever enters the')} <em>{t('same')}</em>{' '}
              {t('code on their phone pairs with you — only the two of you, no one else.')}
            </p>
            <p className="mt-1.5 text-xs text-ink-soft/80">
              {t('Already set up in your browser? Enter the same code and name here to bring everything over.')}
            </p>
          </div>
          {error && <p className="rounded-2xl bg-coral/10 px-4 py-2.5 text-sm font-bold text-coral">{error}</p>}
        </div>

        {/* Gentle reminders */}
        {support.supported && (
          <button
            type="button"
            onClick={enableNotifs}
            className={`card mt-4 flex w-full items-center gap-3 p-4 text-left transition active:scale-[0.99] ${notifGranted ? 'ring-2 ring-sage/40' : ''}`}
          >
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-cream-deep text-coral">
              <Bell size={22} />
            </span>
            <span className="flex-1">
              <span className="block font-bold text-ink">
                {notifGranted ? t('Reminders are on 🌿') : t('Turn on gentle reminders')}
              </span>
              <span className="block text-sm text-ink-soft">
                {t('A soft nudge before a date, never spammy.')}
              </span>
            </span>
          </button>
        )}

        {/* iOS add-to-home hint */}
        {!support.isStandalone && (
          <div className="card mt-4 p-4">
            <p className="font-bold text-ink">{t('Make it feel like a real app')}</p>
            <p className="mt-1 flex flex-wrap items-center gap-1 text-sm text-ink-soft">
              {t('On iPhone: tap')} <Share size={15} className="inline text-coral" /> {t('Share, then')}
              <SquarePlus size={15} className="inline text-coral" /> {t('“Add to Home Screen”.')}
              {t('On Android: menu → “Install app”. Notifications need this on iPhone.')}
            </p>
          </div>
        )}

        <button type="button" className="btn-primary mt-6 w-full py-4 text-lg" disabled={!canBegin} onClick={begin}>
          {joining ? t('Linking…') : t('Begin, together')}
        </button>
      </div>
    </div>
  )
}
