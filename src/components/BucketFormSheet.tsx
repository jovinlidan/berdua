import { useEffect, useRef, useState } from 'react'
import { addBucket, updateBucket } from '../db/repo'
import { haptic } from '../lib/haptics'
import { useT } from '../lib/i18n'
import { fetchLinkMeta, isLikelyUrl, LINK_SOURCE, parseLink } from '../lib/links'
import { WISH_LEVELS, WISH_ORDER } from '../lib/taxonomy'
import { useSession } from '../store/useSession'
import type { BucketItem, LinkSource, WishLevel } from '../types'
import { BottomSheet } from './BottomSheet'
import { Chip } from './Chip'


export function BucketFormSheet({
  open,
  onClose,
  existing,
}: {
  open: boolean
  onClose: () => void
  existing?: BucketItem
}) {
  const t = useT()
  const { activePartner } = useSession()
  const [title, setTitle] = useState('')
  const [wishLevel, setWishLevel] = useState<WishLevel>('this_year')
  const [note, setNote] = useState('')
  const [link, setLink] = useState('')
  const [linkSource, setLinkSource] = useState<LinkSource | undefined>()
  const [linkThumb, setLinkThumb] = useState<string | undefined>()
  const [loadingMeta, setLoadingMeta] = useState(false)
  const titleTouched = useRef(false)

  useEffect(() => {
    if (!open) return
    setTitle(existing?.title ?? '')
    setWishLevel(existing?.wishLevel ?? 'this_year')
    setNote(existing?.note ?? '')
    setLink(existing?.link ?? '')
    setLinkSource(existing?.linkSource)
    setLinkThumb(existing?.linkThumb)
    setLoadingMeta(false)
    titleTouched.current = !!existing
  }, [open, existing])

  function onLinkChange(value: string) {
    setLink(value)
    if (isLikelyUrl(value)) {
      const parsed = parseLink(value)
      setLinkSource(parsed.source)
      if (!titleTouched.current) setTitle(parsed.title)
    } else if (!value.trim()) {
      setLinkSource(undefined)
      setLinkThumb(undefined)
    }
  }

  async function enrich() {
    if (!isLikelyUrl(link)) return
    setLoadingMeta(true)
    const meta = await fetchLinkMeta(link)
    setLinkSource(meta.source)
    setLinkThumb(meta.thumb)
    if (!titleTouched.current && meta.title) setTitle(meta.title)
    setLoadingMeta(false)
  }

  const canSave = title.trim().length > 0

  async function save() {
    if (!canSave) return
    const trimmedLink = link.trim() || undefined
    const payload = {
      title: title.trim(),
      wishLevel,
      note: note.trim() || undefined,
      link: trimmedLink,
      linkSource: trimmedLink ? linkSource : undefined,
      linkThumb: trimmedLink ? linkThumb : undefined,
    }
    if (existing) await updateBucket(existing.id, payload)
    else await addBucket({ ...payload, addedBy: activePartner })
    haptic(8)
    onClose()
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={existing ? t('Edit dream') : t('A dream for us')}>
      <div className="space-y-5">
        {/* Paste a link → auto-fills below */}
        <div>
          <input
            className="field"
            inputMode="url"
            placeholder={t('Paste a TikTok / Instagram link… ✨')}
            value={link}
            onChange={(e) => onLinkChange(e.target.value)}
            onBlur={enrich}
          />
          {linkSource && (
            <div className="mt-2 flex items-center gap-3 rounded-2xl bg-cream-deep p-2.5">
              {linkThumb ? (
                <img src={linkThumb} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
              ) : (
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-paper text-2xl">
                  {LINK_SOURCE[linkSource].emoji}
                </span>
              )}
              <span className="text-sm font-semibold text-ink-soft">
                {loadingMeta ? t('Fetching…') : t('From {source}', { source: t(LINK_SOURCE[linkSource].label) })}
              </span>
            </div>
          )}
        </div>

        <input
          className="field"
          placeholder={t('Something we want to do someday…')}
          value={title}
          onChange={(e) => {
            titleTouched.current = true
            setTitle(e.target.value)
          }}
        />
        <div>
          <p className="mb-2 text-sm font-bold text-ink-soft">{t('When-ish?')}</p>
          <div className="flex flex-wrap gap-2">
            {WISH_ORDER.map((w) => (
              <Chip key={w} active={wishLevel === w} color={WISH_LEVELS[w].tint} onClick={() => setWishLevel(w)}>
                {WISH_LEVELS[w].emoji} {t(WISH_LEVELS[w].label)}
              </Chip>
            ))}
          </div>
        </div>
        <textarea
          className="field"
          rows={2}
          placeholder={t('Why it matters (optional)')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button type="button" className="btn-primary w-full" disabled={!canSave} onClick={save}>
          {existing ? t('Save changes') : t('Add to our bucket')}
        </button>
      </div>
    </BottomSheet>
  )
}
