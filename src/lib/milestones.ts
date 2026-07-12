import { differenceInCalendarDays, parseISO } from 'date-fns'

export interface AnniversaryInfo {
  date: Date
  years: number
  daysUntil: number
  isToday: boolean
}

/** Next yearly anniversary from the start date. */
export function nextAnniversary(anniversaryISO: string | null): AnniversaryInfo | null {
  if (!anniversaryISO) return null
  // Local-time parse (see daysTogether) so the anniversary month/day isn't shifted a day.
  const start = parseISO(anniversaryISO)
  if (Number.isNaN(start.getTime())) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let next = new Date(today.getFullYear(), start.getMonth(), start.getDate())
  next.setHours(0, 0, 0, 0)
  if (next < today) next = new Date(today.getFullYear() + 1, start.getMonth(), start.getDate())

  return {
    date: next,
    years: next.getFullYear() - start.getFullYear(),
    daysUntil: differenceInCalendarDays(next, today),
    isToday: differenceInCalendarDays(next, today) === 0,
  }
}

const ORDINAL = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th']
export const ordinalYear = (n: number) => ORDINAL[n] ?? `${n}th`
