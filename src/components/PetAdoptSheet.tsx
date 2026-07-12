import { Heart } from 'lucide-react'
import { useState } from 'react'
import { adoptPet } from '../db/repo'
import { haptic } from '../lib/haptics'
import { useT } from '../lib/i18n'
import { SPECIES } from '../lib/pet'
import type { PetSpecies } from '../types'
import { BottomSheet } from './BottomSheet'

/** Adopt a new pet (species + name). Used from the roaming companion and the habitat screen. */
export function PetAdoptSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const [species, setSpecies] = useState<PetSpecies>('chicken')
  const [name, setName] = useState('')

  async function adoptNow() {
    if (!name.trim()) return
    haptic([10, 40, 10])
    await adoptPet({ name, species })
    setName('')
    onClose()
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={t('Adopt a pet together')}>
      <div className="space-y-5">
        <p className="text-sm text-ink-soft">{t('Raise a little one together — feed it, play, and watch it grow.')}</p>
        <div>
          <label className="mb-1.5 block text-sm font-bold text-ink-soft">{t('Choose a friend')}</label>
          <div className="flex justify-between gap-2">
            {SPECIES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSpecies(s.id)
                  haptic(5)
                }}
                aria-pressed={species === s.id}
                className={`grid h-14 flex-1 place-items-center rounded-2xl text-2xl transition active:scale-90 ${
                  species === s.id ? 'bg-coral/20 ring-2 ring-coral' : 'bg-cream-deep'
                }`}
              >
                {s.pick}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-bold text-ink-soft">{t('Name your pet')}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('e.g. Mochi')}
            className="w-full rounded-2xl bg-cream-deep px-4 py-3 text-ink placeholder:text-ink-soft/60 outline-none ring-1 ring-transparent focus:ring-coral/40"
          />
        </div>
        <button type="button" className="btn-primary w-full py-3.5" disabled={!name.trim()} onClick={adoptNow}>
          <Heart size={18} fill="currentColor" /> {t('Adopt {name}', { name: name.trim() || '…' })}
        </button>
      </div>
    </BottomSheet>
  )
}
