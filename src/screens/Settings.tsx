import { formatDistanceToNowStrict } from 'date-fns'
import { AlertTriangle, Bell, BellRing, Check, Download, Languages, Monitor, Moon, RefreshCw, Send, Share, SquarePlus, Sun, Upload } from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { LANGS, useT } from '../lib/i18n'
import { BottomSheet } from '../components/BottomSheet'
import { PageHeader } from '../components/PageHeader'
import { SwitchTrack } from '../components/Switch'
import { useToast } from '../components/Toast'
import { db } from '../db/database'
import { useCouple } from '../db/hooks'
import { updateCouple } from '../db/repo'
import { exportBackup, importBackup } from '../lib/backup'
import { haptic } from '../lib/haptics'
import { ACCENTS } from '../lib/theme'
import { useInstallPrompt } from '../lib/useInstallPrompt'
import {
  type PermissionState,
  notificationSupport,
  requestPermission,
  sendDemoNotification,
  subscribeToPush,
} from '../lib/notifications'
import { useSyncStatus } from '../sync/status'
import { eraseRemote, syncOnce } from '../sync/sync'
import { useSession } from '../store/useSession'

const ERASE_COOLDOWN_S = 5 // a deliberate pause so erasing everything can't be a reflex tap


export default function Settings() {
  const couple = useCouple()
  const {
    activePartner,
    deviceId,
    lang,
    setLang,
    notifPrefs,
    setNotifPrefs,
    pushSub,
    setPushSub,
    themeMode,
    setThemeMode,
  } = useSession()
  const t = useT()
  const support = notificationSupport()
  const { status, lastSyncedAt } = useSyncStatus()
  const { canInstall, promptInstall } = useInstallPrompt()
  const toast = useToast()
  const importRef = useRef<HTMLInputElement>(null)
  const [perm, setPerm] = useState<PermissionState>(support.permission)
  const [eraseOpen, setEraseOpen] = useState(false)
  const [eraseText, setEraseText] = useState('')
  const [cooldown, setCooldown] = useState(ERASE_COOLDOWN_S)
  const [erasing, setErasing] = useState(false)

  function openEraseSheet() {
    setCooldown(ERASE_COOLDOWN_S)
    setEraseText('')
    setEraseOpen(true)
  }

  function closeEraseSheet() {
    if (erasing) return
    setEraseOpen(false)
    setCooldown(ERASE_COOLDOWN_S)
    setEraseText('')
  }

  // Run the cool-down countdown only while the erase sheet is open.
  useEffect(() => {
    if (!eraseOpen || cooldown <= 0) return
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => window.clearTimeout(t)
  }, [eraseOpen, cooldown])

  if (!couple) return null

  // Each phone is one person now — you edit only your own name; your partner's is read-only.
  const myName = (activePartner === 'A' ? couple.partnerAName : couple.partnerBName) || ''
  const partnerName = ((activePartner === 'A' ? couple.partnerBName : couple.partnerAName) || '').trim()

  async function onImport(file?: File | null) {
    if (!file) return
    try {
      await importBackup(file)
      toast(t('Backup restored'), '✅')
    } catch {
      toast(t('That file isn’t a Berdua backup'), '⚠️')
    }
  }

  async function enable() {
    const result = await requestPermission()
    setPerm(result)
    if (result === 'granted') {
      const sub = await subscribeToPush(activePartner, deviceId)
      if (sub) {
        setPushSub(sub)
        await syncOnce(true)
      }
    }
    haptic(8)
  }

  const canErase = cooldown <= 0 && eraseText.trim().toUpperCase() === 'CONFIRM' && !erasing

  async function eraseEverything() {
    if (!canErase) return
    setErasing(true)
    haptic([10, 40, 10])
    // Wipe the couple's shared doc from Redis first (frees both slots), then nuke local state.
    if (couple?.coupleSpaceCode) await eraseRemote(couple.coupleSpaceCode)
    await db.delete()
    localStorage.removeItem('berdua-session')
    localStorage.removeItem('berdua-device-id') // start over as a brand-new device
    window.location.href = '/welcome'
  }

  return (
    <div className="pt-[calc(0.4rem+env(safe-area-inset-top))]">
      <PageHeader title={t('Settings')} />

      {/* Profile */}
      <Section title={t('The two of you')}>
        <LabeledInput
          label={t('You')}
          defaultValue={myName}
          onSave={(v) => {
            const next = v.trim() || myName
            if (partnerName && next.toLowerCase() === partnerName.toLowerCase()) {
              toast(t('Your partner already uses that name'), '⚠️')
              return
            }
            updateCouple(activePartner === 'A' ? { partnerAName: next } : { partnerBName: next })
          }}
        />
        <div className="mt-3">
          <label className="mb-1.5 block text-sm font-bold text-ink-soft">{t('Partner')}</label>
          <div className="field flex items-center">
            {partnerName ? (
              <span className="text-ink">{partnerName}</span>
            ) : (
              <span className="text-ink-soft/70">{t('Waiting for them to join…')}</span>
            )}
          </div>
        </div>
        <div className="mt-3">
          <label className="mb-1.5 block text-sm font-bold text-ink-soft">{t('Anniversary')}</label>
          <input
            type="date"
            className="field"
            defaultValue={couple.anniversaryDate ?? ''}
            onChange={(e) => updateCouple({ anniversaryDate: e.target.value || null })}
          />
        </div>
        <div className="mt-3">
          <label className="mb-1.5 block text-sm font-bold text-ink-soft">{t('Your couple code')}</label>
          <div className="field flex items-center justify-between gap-2">
            <span className="font-bold text-ink">{couple.coupleSpaceCode}</span>
            <span className="text-xs text-ink-soft/70">{t('shared with your partner')}</span>
          </div>
          <p className="mt-1.5 text-xs text-ink-soft/80">
            {t('To re-pair with a different code, use “Start over” at the bottom.')}
          </p>
        </div>
      </Section>

      {/* Language */}
      <Section title={t('Language')}>
        <div className="grid grid-cols-2 gap-2">
          {LANGS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setLang(value)
                haptic(6)
              }}
              aria-pressed={lang === value}
              className={`flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold transition active:scale-95 ${
                lang === value ? 'bg-coral-deep text-white shadow-sm' : 'bg-cream-deep text-ink-soft'
              }`}
            >
              <Languages size={18} />
              {label}
            </button>
          ))}
        </div>
      </Section>

      {/* Theme */}
      <Section title={t('Theme')}>
        <div className="mb-4 grid grid-cols-3 gap-2">
          {([
            ['light', 'Light', Sun],
            ['dark', 'Dark', Moon],
            ['auto', 'Auto', Monitor],
          ] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setThemeMode(key)
                haptic(6)
              }}
              aria-pressed={themeMode === key}
              className={`flex flex-col items-center gap-1 rounded-2xl py-3 text-sm font-bold transition active:scale-95 ${
                themeMode === key ? 'bg-coral-deep text-white shadow-sm' : 'bg-cream-deep text-ink-soft'
              }`}
            >
              <Icon size={18} />
              {t(label)}
            </button>
          ))}
        </div>
        <p className="mb-2 text-sm font-bold text-ink-soft">{t('Accent')}</p>
        <div className="flex flex-wrap gap-3">
          {ACCENTS.map((a) => {
            const cur = couple.themeAccent?.toLowerCase()
            const active = cur === a.key || cur === a.coral
            return (
              <button
                key={a.key}
                type="button"
                onClick={() => {
                  updateCouple({ themeAccent: a.key })
                  haptic(6)
                }}
                aria-label={t(a.label)}
                aria-pressed={active}
                className="grid h-11 w-11 place-items-center rounded-full transition active:scale-90"
                style={{
                  backgroundColor: a.coral,
                  boxShadow: active ? `0 0 0 3px #fffdfb, 0 0 0 5px ${a.coral}` : undefined,
                }}
              >
                {active && <Check size={18} className="text-white" />}
              </button>
            )
          })}
        </div>
      </Section>

      {/* Notifications */}
      <Section title={t('Gentle reminders')}>
        {!support.supported ? (
          <p className="text-sm text-ink-soft">{t('This browser doesn’t support notifications.')}</p>
        ) : perm === 'granted' && pushSub ? (
          <>
            <div className="mb-3 flex items-center gap-2 rounded-2xl bg-sage/10 px-4 py-3 font-bold text-sage">
              <BellRing size={18} /> {t('Reminders are on')}
            </div>
            <button
              type="button"
              className="btn-soft w-full"
              onClick={() => sendDemoNotification(`${couple.partnerAName} & ${couple.partnerBName}`)}
            >
              <Send size={16} /> {t('Send a test notification')}
            </button>
            <Toggle
              label={t('Weekend planner nudge')}
              checked={notifPrefs.weekendNudge}
              onChange={(v) => setNotifPrefs({ weekendNudge: v })}
            />
            <Toggle
              label={t('Anniversary & monthly-versary')}
              checked={notifPrefs.anniversaryReminder}
              onChange={(v) => setNotifPrefs({ anniversaryReminder: v })}
            />
            <Toggle
              label={t('When your partner seals a memory')}
              checked={notifPrefs.partnerActivity}
              onChange={(v) => setNotifPrefs({ partnerActivity: v })}
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-ink-soft">{t('Quiet hours')}</span>
              <div className="flex items-center gap-1.5 text-sm">
                <HourSelect value={notifPrefs.quietHoursStart} onChange={(v) => setNotifPrefs({ quietHoursStart: v })} />
                <span className="text-ink-soft">{t('to')}</span>
                <HourSelect value={notifPrefs.quietHoursEnd} onChange={(v) => setNotifPrefs({ quietHoursEnd: v })} />
              </div>
            </div>
          </>
        ) : (
          <>
            <button type="button" className="btn-primary w-full" onClick={enable}>
              <Bell size={18} /> {t('Turn on reminders')}
            </button>
            {perm === 'denied' && (
              <p className="mt-2 text-xs text-ink-soft">
                {t('Notifications are blocked. Enable them for this site in your browser settings.')}
              </p>
            )}
            {!support.isStandalone && (
              <p className="mt-2 text-xs text-ink-soft">
                {t('On iPhone, add Berdua to your Home Screen first — push only works once installed.')}
              </p>
            )}
          </>
        )}
      </Section>

      {/* Secret space */}
      <Section title={t('Just for you')}>
        <Link to="/secrets" className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cream-deep text-xl">🔒</span>
          <span className="flex-1">
            <span className="block font-bold text-ink">{t('Secret space')}</span>
            <span className="block text-sm text-ink-soft">{t('Private to you, hidden from your partner')}</span>
          </span>
        </Link>
      </Section>

      {/* Sync */}
      <Section title={t('Sync between phones')}>
        {couple.coupleSpaceCode ? (
          <>
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{
                  backgroundColor:
                    status === 'ok'
                      ? '#7c8a6f'
                      : status === 'syncing'
                        ? '#f2c879'
                        : status === 'offline'
                          ? '#d87862'
                          : '#c9bbb4',
                }}
              />
              <span className="font-bold text-ink">
                {status === 'syncing'
                  ? t('Syncing…')
                  : status === 'ok'
                    ? t('Synced')
                    : status === 'offline'
                      ? t('Offline — saved on this device')
                      : t('Ready')}
              </span>
            </div>
            <p className="mt-1.5 text-sm text-ink-soft">
              {t('Both phones using the code “{code}” share everything automatically.', {
                code: couple.coupleSpaceCode,
              })}
            </p>
            {lastSyncedAt && (
              <p className="mt-1 text-xs text-ink-soft/80">
                {t('Last synced {ago} ago', { ago: formatDistanceToNowStrict(lastSyncedAt) })}
              </p>
            )}
            <button
              type="button"
              className="btn-soft mt-3 w-full"
              onClick={async () => {
                haptic(6)
                const ok = await syncOnce(true) // manual sync always pushes our state
                toast(ok ? t('Synced ✓') : t('Couldn’t reach the cloud'), ok ? '✅' : '⚠️')
              }}
            >
              <RefreshCw size={16} className={status === 'syncing' ? 'animate-spin' : ''} /> {t('Sync now')}
            </button>
          </>
        ) : (
          <p className="text-sm text-ink-soft">
            {t('Set a matching couple-space code above on both phones to sync.')}
          </p>
        )}
      </Section>

      {/* Install */}
      <Section title={t('Install on your phones')}>
        {canInstall && (
          <button type="button" className="btn-primary mb-3 w-full" onClick={() => void promptInstall()}>
            <Download size={18} /> {t('Install Berdua')}
          </button>
        )}
        <p className="flex flex-wrap items-center gap-1 text-sm text-ink-soft">
          <strong className="text-ink">{t('iPhone:')}</strong> {t('tap')}{' '}
          <Share size={15} className="inline text-coral" /> {t('Share →')}
          <SquarePlus size={15} className="inline text-coral" /> {t('Add to Home Screen.')}
        </p>
        <p className="mt-1.5 text-sm text-ink-soft">
          <strong className="text-ink">{t('Android:')}</strong>{' '}
          {t('menu (⋮) → Install app / Add to Home screen.')}
        </p>
      </Section>

      {/* Backup */}
      <Section title={t('Your data')}>
        <div className="flex gap-3">
          <button type="button" className="btn-soft flex-1" onClick={() => void exportBackup()}>
            <Download size={18} /> {t('Export')}
          </button>
          <button type="button" className="btn-soft flex-1" onClick={() => importRef.current?.click()}>
            <Upload size={18} /> {t('Restore')}
          </button>
        </div>
        <p className="mt-2 text-xs text-ink-soft">
          {t('Download a backup of everything (photos stay on your device).')}
        </p>
        <input
          ref={importRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => onImport(e.target.files?.[0])}
        />
      </Section>

      <button
        type="button"
        onClick={openEraseSheet}
        className="mx-auto mt-2 flex text-sm font-bold text-coral-deep/70"
      >
        {t('Start over (erase everything)')}
      </button>
      <p className="mt-8 text-center font-script text-2xl text-coral-soft">{t('made with love, just for us')}</p>

      {/* Erase confirmation — type CONFIRM + a short cool-down before the button arms */}
      <BottomSheet open={eraseOpen} onClose={closeEraseSheet} title={t('Erase everything?')}>
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl bg-coral/10 p-4">
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-coral-deep" />
            <p className="text-sm text-ink">
              {t('This permanently erases')} <strong>{t('all your shared data')}</strong>{' '}
              {t('— on this device and from the cloud (your partner’s phone will lose it on their next sync). This can’t be undone.')}
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-bold text-ink-soft">
              {t('Type')} <span className="font-mono text-coral-deep">CONFIRM</span> {t('to continue')}
            </label>
            <input
              className="field"
              placeholder="CONFIRM"
              value={eraseText}
              autoCapitalize="characters"
              onChange={(e) => setEraseText(e.target.value)}
            />
          </div>
          <button
            type="button"
            disabled={!canErase}
            onClick={eraseEverything}
            className="w-full rounded-2xl bg-coral-deep py-3.5 font-bold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {erasing
              ? t('Erasing…')
              : cooldown > 0
                ? t('Please wait {n}s…', { n: cooldown })
                : eraseText.trim().toUpperCase() === 'CONFIRM'
                  ? t('Erase everything')
                  : t('Type CONFIRM above')}
          </button>
          <button
            type="button"
            disabled={erasing}
            onClick={closeEraseSheet}
            className="mx-auto flex text-sm font-bold text-ink-soft active:scale-95"
          >
            {t('Cancel')}
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-5">
      <h2 className="mb-2 px-1 text-sm font-bold uppercase tracking-wide text-ink-soft">{title}</h2>
      <div className="card p-5">{children}</div>
    </section>
  )
}

function LabeledInput({
  label,
  defaultValue,
  placeholder,
  onSave,
}: {
  label?: string
  defaultValue: string
  placeholder?: string
  onSave: (v: string) => void
}) {
  return (
    <div>
      {label && <label className="mb-1.5 block text-sm font-bold text-ink-soft">{label}</label>}
      <input
        className="field"
        defaultValue={defaultValue}
        placeholder={placeholder}
        onBlur={(e) => onSave(e.target.value.trim())}
      />
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  // The whole row is the target, label included, so this owns the button and uses the bare track.
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="mt-3 flex w-full items-center justify-between gap-3"
    >
      <span className="text-left text-sm font-semibold text-ink">{label}</span>
      <SwitchTrack checked={checked} />
    </button>
  )
}

function HourSelect({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="rounded-xl bg-cream-deep px-2 py-1.5 font-semibold text-ink outline-none"
    >
      {Array.from({ length: 24 }, (_, h) => (
        <option key={h} value={h}>
          {String(h).padStart(2, '0')}:00
        </option>
      ))}
    </select>
  )
}
