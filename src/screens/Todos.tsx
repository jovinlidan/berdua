import { AnimatePresence, type PanInfo, animate, motion, useMotionValue } from 'framer-motion'
import { AlignLeft, ArrowDown, ArrowUp, CalendarClock, CalendarPlus, Check, ChevronDown, Flame, Lock, MapPin, Navigation, Pencil, Plus, Repeat, Search, Tag, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { celebrate } from '../lib/celebrate'
import { BottomSheet } from '../components/BottomSheet'
import { Chip } from '../components/Chip'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { PlaceSearchSheet } from '../components/PlaceSearchSheet'
import { RoutineSheet } from '../components/RoutineSheet'
import { useToast } from '../components/Toast'
import { useCouple, useTodoGroups, useTodos } from '../db/hooks'
import { addTodo, addTodoGroup, clearTodoPlace, clearTodoRoutine, deleteTodo, deleteTodoGroup, moveTodoGroup, setTodoRoutine, toggleTodo, updateTodo, updateTodoGroup } from '../db/repo'
import { todayIso, whenLabel } from '../lib/dates'
import { haptic } from '../lib/haptics'
import { useT } from '../lib/i18n'
import { openNavigation } from '../lib/navlinks'
import { PARTNER_COLORS, partnerName } from '../lib/partners'
import {
  ROUTINE_FREQ_LABELS,
  isTodoDoneNow,
  routineProgress,
  routineStreak,
  routineSummary,
} from '../lib/recurrence'
import { downloadTodoIcs } from '../lib/todoIcs'
import { useSession } from '../store/useSession'
import type { Couple, Routine, Todo, TodoGroup } from '../types'


/** epoch ms → a value the <input type="datetime-local"> understands (local time, no seconds). */
function toLocalInput(ms?: number): string {
  if (!ms) return ''
  const d = new Date(ms - new Date().getTimezoneOffset() * 60000)
  return d.toISOString().slice(0, 16)
}

export default function Todos() {
  const todos = useTodos()
  const groups = useTodoGroups()
  const couple = useCouple()
  const { activePartner, collapsedTodoGroups, toggleTodoGroupCollapsed } = useSession()
  const toast = useToast()
  const t = useT()
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [showNote, setShowNote] = useState(false)
  const [addCat, setAddCat] = useState<string | null>(null)
  const [showDue, setShowDue] = useState(false)
  const [due, setDue] = useState('')
  const [creating, setCreating] = useState(false)
  const [newCat, setNewCat] = useState('')
  const [editGroup, setEditGroup] = useState<TodoGroup | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editEmoji, setEditEmoji] = useState('')
  // editing an existing to-do (title / note / reminder)
  const [editTodo, setEditTodo] = useState<Todo | null>(null)
  const [etTitle, setEtTitle] = useState('')
  const [etNote, setEtNote] = useState('')
  const [etDue, setEtDue] = useState('')
  const [pendingDelete, setPendingDelete] = useState<Todo | null>(null)
  // attaching/changing the place on a wishlist item (opens the shared place-search sheet)
  const [placeTodo, setPlaceTodo] = useState<Todo | null>(null)
  // the repeat rule being composed for a brand-new task (before it exists in the db)
  const [newRoutine, setNewRoutine] = useState<Routine | null>(null)
  // which sheet the routine editor is serving: the quick-add draft, or the to-do being edited
  const [routineFor, setRoutineFor] = useState<'new' | 'edit' | null>(null)

  // A routine is never "done" as a whole, so progress reads its CURRENT occurrence instead. A day
  // with every routine ticked then still counts as finished (and still earns the confetti).
  const todayKey = todayIso()
  const allTodos = todos ?? []
  const donePct = allTodos.length
    ? Math.round((allTodos.filter((t) => isTodoDoneNow(t, todayKey)).length / allTodos.length) * 100)
    : 0
  const celebrated = useRef(false)
  useEffect(() => {
    if (allTodos.length > 0 && donePct === 100 && !celebrated.current) {
      celebrated.current = true
      celebrate()
    }
    if (donePct < 100) celebrated.current = false
  }, [donePct, allTodos.length])

  if (!couple) return null

  const groupList = groups ?? []
  const list = todos ?? []
  const done = list.filter((t) => isTodoDoneNow(t, todayKey))
  const total = list.length
  const target = addCat ?? groupList[0]?.id ?? 'other'
  const groupIds = new Set(groupList.map((g) => g.id))
  // Completed tasks stay inside their own category (just sorted to the bottom, struck through) —
  // they are NOT moved to a separate "Done" section.
  const sortDoneLast = (arr: Todo[]) =>
    [...arr].sort((a, b) => Number(isTodoDoneNow(a, todayKey)) - Number(isTodoDoneNow(b, todayKey)))
  const ungrouped = sortDoneLast(list.filter((t) => !groupIds.has(t.category)))

  async function add() {
    const text = title.trim()
    if (!text) return
    await addTodo({
      title: text,
      note: note.trim() || undefined,
      category: target,
      addedBy: activePartner,
      dueAt: showDue && due ? new Date(due).getTime() : undefined,
      routine: newRoutine ?? undefined,
    })
    setTitle('')
    setNote('')
    setShowNote(false)
    setDue('')
    setShowDue(false)
    setNewRoutine(null)
    haptic(8)
    const label = groupList.find((g) => g.id === target)?.label ?? t('list')
    toast(newRoutine ? t('Routine added to {cat}', { cat: label }) : t('Added to {cat}', { cat: label }))
  }

  /** Export a wishlist item to the phone's own calendar app (a routine goes as one RRULE event). */
  function addToPhoneCalendar(todo: Todo) {
    if (!downloadTodoIcs(todo)) return
    haptic(6)
    toast(t('Calendar file saved'), '🗓️')
  }

  function openEdit(t: Todo) {
    setEditTodo(t)
    setEtTitle(t.title)
    setEtNote(t.note ?? '')
    setEtDue(toLocalInput(t.dueAt))
  }

  async function saveEdit() {
    if (!editTodo) return
    const text = etTitle.trim()
    if (!text) return
    await updateTodo(editTodo.id, {
      title: text,
      note: etNote.trim() || undefined,
      dueAt: etDue ? new Date(etDue).getTime() : undefined,
    })
    haptic(8)
    toast(t('Saved'))
    setEditTodo(null)
  }

  // Switch from the edit sheet to the place-search sheet, persisting any in-progress edits first
  // so they aren't lost when the sheets swap.
  async function openPlaceForEdit() {
    if (!editTodo) return
    const text = etTitle.trim()
    if (text) {
      await updateTodo(editTodo.id, {
        title: text,
        note: etNote.trim() || undefined,
        dueAt: etDue ? new Date(etDue).getTime() : undefined,
      })
    }
    const target = editTodo
    setEditTodo(null)
    setPlaceTodo(target)
  }

  async function createCategory() {
    const name = newCat.trim()
    if (!name) return
    const id = await addTodoGroup(name)
    setAddCat(id)
    setNewCat('')
    setCreating(false)
    haptic(8)
    toast(t('Category created'), '🏷️')
  }

  return (
    <div data-surface="list" className="pt-[calc(0.4rem+env(safe-area-inset-top))]">
      <PageHeader
        title={t('Wishlist, together')}
        subtitle={total ? t('{n} of {total} done', { n: done.length, total }) : t('add your first task below')}
      />

      <Link
        to="/secrets"
        className="mb-4 ml-auto flex w-fit items-center gap-1.5 rounded-full bg-cream-deep px-3.5 py-2 text-sm font-bold text-ink-soft transition active:scale-95"
      >
        <Lock size={14} /> {t('Private list')}
      </Link>

      {/* quick add */}
      <div className="card mb-3 p-3">
        <div className="flex items-center gap-2">
          <input
            className="field"
            placeholder={t('Add a task…')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <button
            type="button"
            onClick={add}
            disabled={!title.trim()}
            aria-label={t('Add to-do')}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-coral text-white transition active:scale-90 disabled:opacity-40"
          >
            <Plus size={24} />
          </button>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowNote((v) => !v)}
            className={`chip ${showNote || note.trim() ? 'bg-coral/15 text-coral-deep' : 'bg-cream-deep text-ink-soft'}`}
          >
            <AlignLeft size={14} /> {note.trim() ? t('Note added') : t('Add a note')}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowDue((v) => !v)
              setNewRoutine(null) // a one-off reminder and a repeat rule are mutually exclusive
            }}
            className={`chip ${showDue ? 'bg-coral/15 text-coral-deep' : 'bg-cream-deep text-ink-soft'}`}
          >
            <CalendarClock size={14} /> {showDue ? t('Reminder on') : t('Add a reminder')}
          </button>
          <button
            type="button"
            onClick={() => setRoutineFor('new')}
            className={`chip ${newRoutine ? 'bg-coral/15 text-coral-deep' : 'bg-cream-deep text-ink-soft'}`}
          >
            <Repeat size={14} /> {newRoutine ? t(ROUTINE_FREQ_LABELS[newRoutine.freq]) : t('Repeat it')}
          </button>
        </div>
        <AnimatePresence>
          {showNote && (
            <motion.textarea
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              rows={2}
              placeholder={t('A little more detail… (optional)')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-2 w-full resize-none rounded-xl bg-cream-deep px-3 py-2 text-sm text-ink placeholder:text-ink-soft/60 outline-none ring-1 ring-transparent focus:ring-coral/40"
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {showDue && (
            <motion.input
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              type="datetime-local"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="mt-2 w-full rounded-xl bg-cream-deep px-3 py-1.5 text-sm text-ink outline-none"
            />
          )}
        </AnimatePresence>
      </div>

      {/* category selector (where new tasks go) + create */}
      <p className="mb-1.5 px-1 text-xs font-bold uppercase tracking-wide text-ink-soft">{t('New tasks go to')}</p>
      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {groupList.map((g) => (
          <Chip key={g.id} active={target === g.id} color={g.tint} onClick={() => setAddCat(g.id)}>
            {g.emoji} {g.label}
          </Chip>
        ))}
        <Chip active={creating} color="#7c8a6f" onClick={() => setCreating((v) => !v)}>
          <Tag size={13} /> {t('New')}
        </Chip>
      </div>
      <AnimatePresence>
        {creating && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="card mb-5 flex items-center gap-2 p-3">
              <input
                className="field"
                placeholder={t('New category name…')}
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createCategory()}
                autoFocus
              />
              <button type="button" className="btn-primary shrink-0" disabled={!newCat.trim()} onClick={createCategory}>
                {t('Create')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* grouped sections */}
      {list.length === 0 ? (
        <EmptyState emoji="🧺" title={t('Nothing to do yet')} subtitle={t('Pick a category above, then add a task.')} />
      ) : (
        <>
          {groupList.map((g) => {
            const groupTodos = sortDoneLast(list.filter((t) => t.category === g.id))
            if (groupTodos.length === 0) return null
            return (
              <GroupSection
                key={g.id}
                group={g}
                todos={groupTodos}
                couple={couple}
                todayKey={todayKey}
                collapsed={collapsedTodoGroups.includes(g.id)}
                onToggle={() => toggleTodoGroupCollapsed(g.id)}
                onEditTodo={openEdit}
                onRequestDelete={setPendingDelete}
                onEdit={() => {
                  setEditGroup(g)
                  setEditLabel(g.label)
                  setEditEmoji(g.emoji)
                }}
              />
            )
          })}
          {ungrouped.length > 0 && (
            <GroupSection
              group={{ id: '_ungrouped', label: t('Uncategorised'), emoji: '📦', tint: '#9CA77F', order: 999, createdAt: 0, updatedAt: 0 }}
              todos={ungrouped}
              couple={couple}
              todayKey={todayKey}
              collapsed={collapsedTodoGroups.includes('_ungrouped')}
              onToggle={() => toggleTodoGroupCollapsed('_ungrouped')}
              onEditTodo={openEdit}
              onRequestDelete={setPendingDelete}
            />
          )}
        </>
      )}


      {/* edit / delete a category */}
      <BottomSheet open={!!editGroup} onClose={() => setEditGroup(null)} title={t('Edit category')}>
        {editGroup && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                value={editEmoji}
                onChange={(e) => setEditEmoji(e.target.value)}
                aria-label={t('Emoji')}
                className="w-16 shrink-0 rounded-2xl bg-cream-deep px-2 py-3 text-center text-2xl outline-none ring-1 ring-transparent focus:ring-coral/40"
              />
              <input
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                placeholder={t('Category name')}
                className="field"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                className="btn-soft flex-1"
                onClick={() => {
                  void moveTodoGroup(editGroup.id, 'up')
                  haptic(6)
                }}
              >
                <ArrowUp size={16} /> {t('Move up')}
              </button>
              <button
                type="button"
                className="btn-soft flex-1"
                onClick={() => {
                  void moveTodoGroup(editGroup.id, 'down')
                  haptic(6)
                }}
              >
                <ArrowDown size={16} /> {t('Move down')}
              </button>
            </div>
            <button
              type="button"
              className="btn-primary w-full"
              disabled={!editLabel.trim()}
              onClick={async () => {
                await updateTodoGroup(editGroup.id, { label: editLabel.trim(), emoji: editEmoji || editGroup.emoji })
                haptic(8)
                toast('Saved')
                setEditGroup(null)
              }}
            >
              {t('Save changes')}
            </button>
            <button
              type="button"
              className="btn-soft mx-auto flex text-coral-deep"
              onClick={async () => {
                if (!window.confirm(t('Delete this category? Its to-dos become uncategorised.'))) return
                await deleteTodoGroup(editGroup.id)
                toast(t('Category deleted'), '🗑️')
                setEditGroup(null)
              }}
            >
              <Trash2 size={16} /> {t('Delete category')}
            </button>
          </div>
        )}
      </BottomSheet>

      {/* edit a to-do (title / note / reminder) */}
      <BottomSheet open={!!editTodo} onClose={() => setEditTodo(null)} title={t('Edit to-do')}>
        {editTodo && (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-bold text-ink-soft">{t('Task')}</label>
              <input
                className="field"
                placeholder={t('What needs doing?')}
                value={etTitle}
                onChange={(e) => setEtTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-bold text-ink-soft">{t('Note (optional)')}</label>
              <textarea
                rows={3}
                className="w-full resize-none rounded-2xl bg-cream-deep px-4 py-3 text-ink placeholder:text-ink-soft/60 outline-none ring-1 ring-transparent focus:ring-coral/40"
                placeholder={t('A little more detail…')}
                value={etNote}
                onChange={(e) => setEtNote(e.target.value)}
              />
            </div>
            {/* A routine carries its own schedule, so it replaces the one-off reminder field. */}
            {!editTodo.routine && (
              <div>
                <label className="mb-1.5 block text-sm font-bold text-ink-soft">{t('Reminder (optional)')}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="datetime-local"
                    className="field"
                    value={etDue}
                    onChange={(e) => setEtDue(e.target.value)}
                  />
                  {etDue && (
                    <button
                      type="button"
                      onClick={() => setEtDue('')}
                      aria-label={t('Clear reminder')}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cream-deep text-ink-soft transition active:scale-90"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-bold text-ink-soft">{t('Repeats')}</label>
              {editTodo.routine ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 rounded-2xl bg-coral/10 px-3 py-2.5 ring-1 ring-coral/20">
                    <Repeat size={16} className="shrink-0 text-coral" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                      {routineSummary(editTodo.routine, t)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setRoutineFor('edit')}
                      className="text-xs font-bold text-coral-deep active:opacity-70"
                    >
                      {t('Change')}
                    </button>
                  </div>
                  <RoutineProgressLine todo={editTodo} todayKey={todayKey} />
                </div>
              ) : (
                <button type="button" className="btn-soft w-full" onClick={() => setRoutineFor('edit')}>
                  <Repeat size={16} /> {t('Make it a routine')}
                </button>
              )}
            </div>

            {(editTodo.routine || editTodo.dueAt) && (
              <button type="button" className="btn-soft w-full" onClick={() => addToPhoneCalendar(editTodo)}>
                <CalendarPlus size={16} /> {t('Add to phone calendar')}
              </button>
            )}
            <div>
              <label className="mb-1.5 block text-sm font-bold text-ink-soft">{t('Place (optional)')}</label>
              {editTodo.place ? (
                <div className="flex items-center gap-2 rounded-2xl bg-coral/10 px-3 py-2.5 ring-1 ring-coral/20">
                  <MapPin size={16} className="shrink-0 text-coral" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{editTodo.place.name}</span>
                  <button type="button" onClick={openPlaceForEdit} className="text-xs font-bold text-coral-deep active:opacity-70">
                    {t('Change')}
                  </button>
                  <button
                    type="button"
                    aria-label={t('Remove from map')}
                    onClick={async () => {
                      await clearTodoPlace(editTodo.id)
                      haptic(6)
                      setEditTodo({ ...editTodo, place: undefined })
                    }}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-soft/60 active:scale-90"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <button type="button" className="btn-soft w-full" onClick={openPlaceForEdit}>
                  <MapPin size={16} /> {t('Pin a place on the map')}
                </button>
              )}
            </div>
            <button type="button" className="btn-primary w-full" disabled={!etTitle.trim()} onClick={saveEdit}>
              {t('Save changes')}
            </button>
          </div>
        )}
      </BottomSheet>

      {/* attach / change a wishlist item's place (shared with the Map screen) */}
      <PlaceSearchSheet open={!!placeTodo} onClose={() => setPlaceTodo(null)} todo={placeTodo ?? undefined} />

      {/* repeat editor, shared by the quick-add draft and the to-do being edited */}
      <RoutineSheet
        open={routineFor !== null}
        onClose={() => setRoutineFor(null)}
        value={routineFor === 'edit' ? editTodo?.routine ?? null : newRoutine}
        onSave={async (routine) => {
          if (routineFor === 'edit' && editTodo) {
            await setTodoRoutine(editTodo.id, routine)
            setEditTodo({ ...editTodo, routine, dueAt: undefined })
            setEtDue('')
            toast(t('Routine saved'), '🔁')
          } else {
            setNewRoutine(routine)
            setShowDue(false) // the routine's own time replaces a one-off reminder
            setDue('')
          }
          setRoutineFor(null)
        }}
        onRemove={
          routineFor === 'edit' && editTodo?.routine
            ? async () => {
                await clearTodoRoutine(editTodo.id)
                setEditTodo({ ...editTodo, routine: undefined })
                setRoutineFor(null)
                toast(t('Stopped repeating'))
              }
            : routineFor === 'new' && newRoutine
              ? () => {
                  setNewRoutine(null)
                  setRoutineFor(null)
                }
              : undefined
        }
      />

      {/* delete confirmation */}
      <BottomSheet open={!!pendingDelete} onClose={() => setPendingDelete(null)} title={t('Delete this task?')}>
        {pendingDelete && (
          <div className="space-y-4">
            <p className="text-sm text-ink-soft">
              {t('“{title}” will be removed for both of you. This can’t be undone.', { title: pendingDelete.title })}
            </p>
            <button
              type="button"
              className="w-full rounded-2xl bg-coral-deep py-3.5 font-bold text-white transition active:scale-[0.98]"
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

/** Progress + streak read-back for a routine (used in the edit sheet). */
function RoutineProgressLine({ todo, todayKey }: { todo: Todo; todayKey: string }) {
  const t = useT()
  const { done, total } = routineProgress(todo)
  const streak = routineStreak(todo, todayKey)
  return (
    <p className="px-1 text-xs text-ink-soft">
      {total === null ? t('{done} done', { done }) : t('{done} of {total} done', { done, total })}
      {streak >= 2 && ` · ${t('{n} in a row', { n: streak })}`}
    </p>
  )
}

function GroupSection({
  group,
  todos,
  couple,
  todayKey,
  collapsed,
  onToggle,
  onEdit,
  onEditTodo,
  onRequestDelete,
}: {
  group: TodoGroup
  todos: Todo[]
  couple: Couple
  todayKey: string
  collapsed: boolean
  onToggle: () => void
  onEdit?: () => void
  onEditTodo: (t: Todo) => void
  onRequestDelete: (t: Todo) => void
}) {
  const tr = useT()
  const openCount = todos.filter((t) => !isTodoDoneNow(t, todayKey)).length
  return (
    <motion.div layout transition={{ type: 'spring', stiffness: 500, damping: 40 }} className="mb-3">
      <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onToggle}
        className="flex flex-1 items-center gap-2 rounded-2xl px-1 py-2 text-left active:opacity-70"
        aria-expanded={!collapsed}
      >
        <span className="text-lg" style={{ color: group.tint }}>
          {group.emoji}
        </span>
        <span className="font-serif text-lg font-semibold text-ink">{group.label}</span>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-bold"
          style={{ backgroundColor: `${group.tint}22`, color: group.tint }}
        >
          {openCount > 0 ? openCount : '✓'}
        </span>
        <ChevronDown
          size={20}
          className={`ml-auto text-ink-soft transition-transform ${collapsed ? '-rotate-90' : ''}`}
        />
      </button>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            aria-label={tr('Edit category')}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-soft/60 transition active:scale-90 hover:text-coral"
          >
            <Pencil size={15} />
          </button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="space-y-1.5 pt-1">
              <AnimatePresence initial={false} mode="popLayout">
                {todos.map((t) => (
                  <TodoRow
                    key={t.id}
                    todo={t}
                    tint={group.tint}
                    couple={couple}
                    todayKey={todayKey}
                    onEdit={() => onEditTodo(t)}
                    onRequestDelete={() => onRequestDelete(t)}
                  />
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

const REVEAL = 84 // px each swipe action latches open to

function TodoRow({
  todo,
  tint,
  couple,
  todayKey,
  onEdit,
  onRequestDelete,
}: {
  todo: Todo
  tint: string
  couple: Couple
  todayKey: string
  onEdit: () => void
  onRequestDelete: () => void
}) {
  const t = useT()
  const activePartner = useSession((s) => s.activePartner)
  const x = useMotionValue(0)
  const [open, setOpen] = useState<'none' | 'done' | 'delete'>('none')
  // True briefly around a drag so the click that fires on release doesn't toggle/edit the row.
  const dragged = useRef(false)
  // For a routine, "done" means the occurrence it's standing on today; the activity itself lives on.
  const doneNow = isTodoDoneNow(todo, todayKey)
  const streak = todo.routine ? routineStreak(todo, todayKey) : 0
  const progress = todo.routine ? routineProgress(todo) : null
  const check = () => {
    haptic(doneNow ? 4 : [8, 20])
    void toggleTodo(todo.id, activePartner)
  }

  const settle = (to: number) => animate(x, to, { type: 'spring', stiffness: 500, damping: 42 })
  const close = () => {
    setOpen('none')
    settle(0)
  }

  function onDragEnd(_e: unknown, info: PanInfo) {
    // Decide from where the card ACTUALLY ended up (not the drag delta), so a small drag back
    // toward center always closes — even from an already-open side.
    const pos = x.get()
    void info
    if (pos < -REVEAL / 2) {
      setOpen('delete')
      settle(-REVEAL)
    } else if (pos > REVEAL / 2) {
      setOpen('done')
      settle(REVEAL)
    } else {
      close()
    }
    window.setTimeout(() => (dragged.current = false), 80)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -40, transition: { duration: 0.18 } }}
      transition={{ type: 'spring', stiffness: 480, damping: 36 }}
      className="relative"
    >
      {/* Latched swipe actions behind the card — tap to act (no auto-fire). */}
      <div className="absolute inset-0 flex items-stretch justify-between overflow-hidden rounded-[var(--radius-row)]">
        <button
          type="button"
          onClick={() => {
            check()
            close()
          }}
          className="flex w-[84px] flex-col items-center justify-center gap-0.5 bg-sage text-xs font-bold text-white"
        >
          <Check size={18} strokeWidth={3} /> {doneNow ? t('Undo') : t('Done')}
        </button>
        <button
          type="button"
          onClick={() => {
            haptic(6)
            close()
            onRequestDelete()
          }}
          className="flex w-[84px] flex-col items-center justify-center gap-0.5 bg-coral-deep text-xs font-bold text-white"
        >
          <Trash2 size={18} /> {t('Delete')}
        </button>
      </div>

      {/* the draggable card */}
      <motion.div
        drag="x"
        dragDirectionLock
        dragMomentum={false}
        dragConstraints={{ left: -REVEAL, right: REVEAL }}
        dragElastic={0.1}
        onDragStart={() => (dragged.current = true)}
        onDragEnd={onDragEnd}
        style={{ x, touchAction: 'pan-y' }}
        className="row relative flex items-center gap-2.5 overflow-hidden p-3"
      >
        {/* Check: bold tinted ring + soft tint fill (clearly tappable) → solid sage + white check when done */}
        <button
          type="button"
          onClick={() => {
            if (dragged.current) return
            if (open !== 'none') {
              close() // an open row: any tap on the card just closes it
              return
            }
            check()
          }}
          aria-label={doneNow ? t('Mark not done') : t('Mark done')}
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-white transition active:scale-90"
          style={
            doneNow
              ? { backgroundColor: '#7C8A6F', boxShadow: 'inset 0 0 0 2px #7C8A6F' }
              : { backgroundColor: `${tint}26`, boxShadow: `inset 0 0 0 2px ${tint}` }
          }
        >
          <AnimatePresence>
            {doneNow && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                <Check size={14} strokeWidth={3} />
              </motion.span>
            )}
          </AnimatePresence>
        </button>
        <button
          type="button"
          onClick={() => {
            if (dragged.current) return
            if (open === 'none') onEdit()
            else close()
          }}
          className="min-w-0 flex-1 text-left active:opacity-70"
          aria-label={t('Edit to-do')}
        >
          <p className={`text-sm font-semibold leading-snug transition ${doneNow ? 'text-ink-soft/60 line-through' : 'text-ink'}`}>
            {todo.title}
          </p>
          {todo.note && (
            <p className={`line-clamp-1 text-xs ${doneNow ? 'text-ink-soft/50' : 'text-ink-soft'}`}>{todo.note}</p>
          )}
          {todo.place && (
            <span className={`mt-0.5 flex items-center gap-1 text-[11px] font-semibold ${doneNow ? 'text-ink-soft/50' : 'text-coral'}`}>
              <MapPin size={11} /> {todo.place.name}
            </span>
          )}
          {todo.routine && (
            <span className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-ink-soft">
              <Repeat size={11} className="shrink-0" />
              <span className="truncate">{routineSummary(todo.routine, t)}</span>
              {/* One stat, never two: a live streak if there is one, otherwise how far a finite
                  routine has got. Colour is reserved for status, so the rule itself stays quiet. */}
              {streak >= 2 ? (
                <span className="flex shrink-0 items-center gap-0.5 text-coral-deep">
                  · <Flame size={11} /> {streak}
                </span>
              ) : progress?.total ? (
                <span className="shrink-0">· {progress.done}/{progress.total}</span>
              ) : null}
            </span>
          )}
          {todo.dueAt && !todo.routine && !todo.done && (
            <span className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-coral-deep">
              <CalendarClock size={11} /> {whenLabel(todo.dueAt)}
            </span>
          )}
        </button>
        {todo.place && (
          <button
            type="button"
            onClick={() => {
              if (dragged.current) return
              if (open !== 'none') {
                close()
                return
              }
              haptic(6)
              openNavigation(todo.place!.lat, todo.place!.lng, todo.title)
            }}
            aria-label={t('Navigate')}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-coral transition active:scale-90"
          >
            <Navigation size={15} />
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (dragged.current) return
            if (open !== 'none') {
              close()
              return
            }
            const q = [todo.title, todo.note].filter(Boolean).join(' ').trim()
            if (!q) return
            haptic(6)
            window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}`, '_blank', 'noopener,noreferrer')
          }}
          aria-label={t('Search on Google')}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-soft/50 transition active:scale-90 hover:text-coral"
        >
          <Search size={15} />
        </button>
        <Avatar name={partnerName(couple, todo.addedBy)} color={PARTNER_COLORS[todo.addedBy]} size={16} />
      </motion.div>
    </motion.div>
  )
}
