// Routines live here, apart from the wishlist: a wishlist item is finished once, a routine keeps
// coming back. Same synced records underneath (see db/hooks useWishlist/useRoutines), two screens.
import { format, parseISO } from 'date-fns'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarPlus, Check, Flame, Plus, Repeat, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Avatar } from '../components/Avatar'
import { BottomSheet } from '../components/BottomSheet'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { RoutineSheet } from '../components/RoutineSheet'
import { useToast } from '../components/Toast'
import { useCouple, useRoutines } from '../db/hooks'
import {
  addTodo,
  clearTodoRoutine,
  deleteTodo,
  setTodoRoutine,
  toggleRoutineOccurrence,
  updateTodo,
} from '../db/repo'
import { todayIso } from '../lib/dates'
import { haptic } from '../lib/haptics'
import { activeDateLocale, useT } from '../lib/i18n'
import { PARTNER_COLORS, partnerName } from '../lib/partners'
import {
  isOccurrenceDone,
  nextOccurrenceKey,
  occursOn,
  routineProgress,
  routineStreak,
  routineSummary,
  withinLimits,
} from '../lib/recurrence'
import { downloadTodoIcs } from '../lib/todoIcs'
import { useSession } from '../store/useSession'
import type { Couple, Routine, Todo } from '../types'

/** New routines carry their own category, so they never mingle with the wishlist's groups. */
const ROUTINE_CATEGORY = 'routine'
const dailyFromToday = (): Routine => ({ freq: 'daily', interval: 1, startDate: todayIso() })

export default function Routines() {
  const couple = useCouple()
  const routines = useRoutines()
  const activePartner = useSession((s) => s.activePartner)
  const toast = useToast()
  const t = useT()
  const [title, setTitle] = useState('')
  // A routine always has a rule, so the composer starts with one instead of an empty state.
  const [draft, setDraft] = useState<Routine>(dailyFromToday)
  const [editing, setEditing] = useState<Todo | null>(null)
  const [edTitle, setEdTitle] = useState('')
  const [edNote, setEdNote] = useState('')
  const [rulesFor, setRulesFor] = useState<'new' | 'edit' | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Todo | null>(null)

  if (!couple) return null

  const todayKey = todayIso()
  const list = routines ?? []
  const dueToday = list.filter((r) => r.routine && occursOn(r.routine, todayKey) && withinLimits(r.routine, todayKey))
  const todayIds = new Set(dueToday.map((r) => r.id))
  const later = list.filter((r) => !todayIds.has(r.id))
  const doneToday = dueToday.filter((r) => isOccurrenceDone(r, todayKey)).length

  async function add() {
    const text = title.trim()
    if (!text) return
    await addTodo({ title: text, category: ROUTINE_CATEGORY, addedBy: activePartner, routine: draft })
    setTitle('')
    setDraft(dailyFromToday())
    haptic(8)
    toast(t('Routine added'), '🔁')
  }

  function openEdit(routine: Todo) {
    setEditing(routine)
    setEdTitle(routine.title)
    setEdNote(routine.note ?? '')
  }

  async function saveEdit() {
    if (!editing) return
    const text = edTitle.trim()
    if (!text) return
    await updateTodo(editing.id, { title: text, note: edNote.trim() || undefined })
    haptic(8)
    toast(t('Saved'))
    setEditing(null)
  }

  return (
    <div data-surface="list" className="pt-[calc(0.4rem+env(safe-area-inset-top))]">
      <PageHeader
        title={t('Our routines')}
        subtitle={
          dueToday.length
            ? t('{done} of {total} done today', { done: doneToday, total: dueToday.length })
            : t('the things you two keep coming back to')
        }
      />

      {/* compose: a title plus the rule that makes it a routine */}
      <div className="card mb-5 p-3">
        <div className="flex items-center gap-2">
          <input
            className="field"
            placeholder={t('Add a routine…')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <button
            type="button"
            onClick={add}
            disabled={!title.trim()}
            aria-label={t('Add routine')}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-coral-deep text-white transition active:scale-90 disabled:opacity-40"
          >
            <Plus size={24} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => setRulesFor('new')}
          className="chip mt-2.5 bg-cream-deep text-ink-soft"
        >
          <Repeat size={14} /> {routineSummary(draft, t)}
        </button>
      </div>

      {list.length === 0 ? (
        <EmptyState
          emoji="🔁"
          title={t('No routines yet')}
          subtitle={t('Add something you do together often, and it will come back on every one of its days.')}
        />
      ) : (
        <>
          {dueToday.length > 0 && (
            <Section label={t('Today')}>
              {dueToday.map((r) => (
                <RoutineRow
                  key={r.id}
                  routine={r}
                  couple={couple}
                  todayKey={todayKey}
                  onCheck={() => {
                    haptic(isOccurrenceDone(r, todayKey) ? 4 : [8, 20])
                    void toggleRoutineOccurrence(r.id, todayKey, activePartner)
                  }}
                  onEdit={() => openEdit(r)}
                />
              ))}
            </Section>
          )}
          {later.length > 0 && (
            <Section label={dueToday.length > 0 ? t('Coming up') : t('All routines')}>
              {later.map((r) => (
                <RoutineRow key={r.id} routine={r} couple={couple} todayKey={todayKey} onEdit={() => openEdit(r)} />
              ))}
            </Section>
          )}
        </>
      )}

      {/* edit one routine */}
      <BottomSheet open={!!editing} onClose={() => setEditing(null)} title={t('Edit routine')}>
        {editing && (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-bold text-ink-soft">{t('Routine')}</label>
              <input
                className="field"
                placeholder={t('What do you two do together?')}
                value={edTitle}
                onChange={(e) => setEdTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-bold text-ink-soft">{t('Note (optional)')}</label>
              <textarea
                rows={3}
                className="field resize-none"
                placeholder={t('A little more detail…')}
                value={edNote}
                onChange={(e) => setEdNote(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-bold text-ink-soft">{t('Repeats')}</label>
              <button
                type="button"
                onClick={() => setRulesFor('edit')}
                className="field flex items-center gap-2 text-left"
              >
                <Repeat size={16} className="shrink-0 text-ink-soft" />
                <span className="min-w-0 flex-1 truncate font-semibold text-ink">
                  {editing.routine ? routineSummary(editing.routine, t) : t('Set the repeat')}
                </span>
                <span className="shrink-0 text-xs font-bold text-coral-deep">{t('Change')}</span>
              </button>
              <ProgressLine routine={editing} todayKey={todayKey} />
            </div>
            <button
              type="button"
              className="btn-soft w-full"
              onClick={() => {
                if (!downloadTodoIcs(editing)) return
                haptic(6)
                toast(t('Calendar file saved'), '🗓️')
              }}
            >
              <CalendarPlus size={16} /> {t('Add to phone calendar')}
            </button>
            <button type="button" className="btn-primary w-full" disabled={!edTitle.trim()} onClick={saveEdit}>
              {t('Save changes')}
            </button>
            <div className="flex justify-between">
              <button
                type="button"
                className="text-sm font-bold text-ink-soft active:scale-95"
                onClick={async () => {
                  // Stops repeating, so it becomes an ordinary wishlist item again.
                  await clearTodoRoutine(editing.id)
                  setEditing(null)
                  toast(t('Moved to the wishlist'))
                }}
              >
                {t('Stop repeating')}
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5 text-sm font-bold text-coral-deep active:scale-95"
                onClick={() => {
                  const target = editing
                  setEditing(null)
                  setPendingDelete(target)
                }}
              >
                <Trash2 size={15} /> {t('Delete')}
              </button>
            </div>
          </div>
        )}
      </BottomSheet>

      {/* the repeat rule, for the composer or the routine being edited */}
      <RoutineSheet
        open={rulesFor !== null}
        onClose={() => setRulesFor(null)}
        value={rulesFor === 'edit' ? editing?.routine ?? null : draft}
        onSave={async (rule) => {
          if (rulesFor === 'edit' && editing) {
            await setTodoRoutine(editing.id, rule)
            setEditing({ ...editing, routine: rule })
            toast(t('Routine saved'), '🔁')
          } else {
            setDraft(rule)
          }
          setRulesFor(null)
        }}
      />

      {/* delete confirmation */}
      <BottomSheet open={!!pendingDelete} onClose={() => setPendingDelete(null)} title={t('Delete this routine?')}>
        {pendingDelete && (
          <div className="space-y-4">
            <p className="text-sm text-ink-soft">
              {t('“{title}” and its history will be removed for both of you. This can’t be undone.', {
                title: pendingDelete.title,
              })}
            </p>
            <button
              type="button"
              className="w-full rounded-full bg-coral-deep py-3.5 font-bold text-white transition active:scale-[0.98]"
              onClick={() => {
                haptic([10, 40, 10])
                void deleteTodo(pendingDelete.id)
                setPendingDelete(null)
              }}
            >
              {t('Delete')}
            </button>
            <button
              type="button"
              className="mx-auto flex text-sm font-bold text-ink-soft active:scale-95"
              onClick={() => setPendingDelete(null)}
            >
              {t('Cancel')}
            </button>
          </div>
        )}
      </BottomSheet>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <p className="mb-1.5 px-1 text-xs font-bold uppercase tracking-wide text-ink-soft">{label}</p>
      <div className="space-y-1.5">
        <AnimatePresence initial={false} mode="popLayout">
          {children}
        </AnimatePresence>
      </div>
    </section>
  )
}

/** Ticked occurrences and the current streak, in one quiet line. */
function ProgressLine({ routine, todayKey }: { routine: Todo; todayKey: string }) {
  const t = useT()
  const { done, total } = routineProgress(routine)
  const streak = routineStreak(routine, todayKey)
  return (
    <p className="mt-1.5 px-1 text-xs text-ink-soft">
      {total === null ? t('{done} done', { done }) : t('{done} of {total} done', { done, total })}
      {streak >= 2 && ` · ${t('{n} in a row', { n: streak })}`}
    </p>
  )
}

/**
 * One routine. With `onCheck` it is today's occurrence and the circle ticks it off; without, it is
 * a future one, so the slot shows the repeat mark instead of a control that would tick the wrong day.
 */
function RoutineRow({
  routine,
  couple,
  todayKey,
  onCheck,
  onEdit,
}: {
  routine: Todo
  couple: Couple
  todayKey: string
  onCheck?: () => void
  onEdit: () => void
}) {
  const t = useT()
  const locale = activeDateLocale()
  const rule = routine.routine
  const done = isOccurrenceDone(routine, todayKey)
  const streak = routineStreak(routine, todayKey)
  const progress = routineProgress(routine)
  const next = rule ? nextOccurrenceKey(rule, todayKey) : null

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -40, transition: { duration: 0.18 } }}
      transition={{ type: 'spring', stiffness: 480, damping: 36 }}
      className="row flex items-center gap-3 p-3"
    >
      {onCheck ? (
        <button
          type="button"
          onClick={onCheck}
          aria-label={done ? t('Mark not done') : t('Mark done')}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-white transition active:scale-90"
          style={
            done
              ? { backgroundColor: '#7C8A6F', boxShadow: 'inset 0 0 0 2px #7C8A6F' }
              : { backgroundColor: 'rgba(200,106,81,0.15)', boxShadow: 'inset 0 0 0 2px #c86a51' }
          }
        >
          <AnimatePresence>
            {done && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                <Check size={15} strokeWidth={3} />
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      ) : (
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-cream-deep text-ink-soft">
          <Repeat size={14} />
        </span>
      )}

      <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left active:opacity-70">
        <p className={`font-semibold leading-snug ${done ? 'text-ink-soft/60 line-through' : 'text-ink'}`}>
          {routine.title}
        </p>
        {/* The rule, plus ONE more fact: when it next comes around for a future one, how far a
            finite one has got otherwise. Three facts crowd the line and truncate the rule. */}
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-soft">
          <span className="truncate">{rule ? routineSummary(rule, t) : ''}</span>
          {!onCheck && next ? (
            <span className="shrink-0">· {t('next {date}', { date: format(parseISO(next), 'EEE, MMM d', { locale }) })}</span>
          ) : progress.total ? (
            <span className="shrink-0">· {progress.done}/{progress.total}</span>
          ) : null}
        </p>
      </button>

      {streak >= 2 && (
        <span className="flex shrink-0 items-center gap-0.5 text-xs font-bold text-coral-deep">
          <Flame size={13} /> {streak}
        </span>
      )}
      <Avatar name={partnerName(couple, routine.addedBy)} color={PARTNER_COLORS[routine.addedBy]} size={16} />
    </motion.div>
  )
}
