// Display metadata for the small fixed taxonomies. Kept in one place so chips,
// filters and cards all read identically.
import type { TodoCategory, WishLevel } from '../types'

export const WISH_LEVELS: Record<WishLevel, { label: string; emoji: string; tint: string }> = {
  soon: { label: 'Soon', emoji: '🌱', tint: '#E8927C' },
  this_year: { label: 'This year', emoji: '🌤️', tint: '#D98C5F' },
  someday: { label: 'Someday', emoji: '🌙', tint: '#7C8A6F' },
}
export const WISH_ORDER: WishLevel[] = ['soon', 'this_year', 'someday']

export const TODO_CATEGORIES: Record<TodoCategory, { label: string; emoji: string; tint: string }> = {
  food: { label: 'Food', emoji: '🍜', tint: '#E8927C' },
  movie: { label: 'Movie', emoji: '🎬', tint: '#9d8ec9' },
  game: { label: 'Game', emoji: '🎮', tint: '#6f93d9' },
  travel: { label: 'Travel', emoji: '✈️', tint: '#7C8A6F' },
}
export const TODO_CATEGORY_ORDER: TodoCategory[] = ['food', 'movie', 'game', 'travel']

// Daily check-in 1–5 mood scale (distinct from memory MOODS).
export const DAILY_MOODS: { value: number; emoji: string; label: string }[] = [
  { value: 1, emoji: '😔', label: 'Low' },
  { value: 2, emoji: '😕', label: 'Meh' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' },
]
export const moodEmoji = (v?: number) => DAILY_MOODS.find((m) => m.value === v)?.emoji ?? '·'
