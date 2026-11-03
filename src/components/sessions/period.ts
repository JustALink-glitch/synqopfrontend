import { useState } from 'react'
import { formatDate } from '@/lib/format'
import { addDays, weekdayOf } from '@/lib/schedule'

export type ScheduleView = 'list' | 'calendar'

export const mondayOf = (date: string) => addDays(date, 1 - weekdayOf(date))
export const monthOf = (date: string) => `${date.slice(0, 7)}-01`

export function addMonths(month: string, n: number) {
  const [y, m] = month.split('-').map(Number) as [number, number]
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return d.toISOString().slice(0, 10)
}

/** The 6 × 7 days shown for a month, Monday first. */
export function monthGrid(month: string) {
  const first = mondayOf(month)
  return { from: first, to: addDays(first, 41), days: Array.from({ length: 42 }, (_, i) => addDays(first, i)) }
}

export const monthLabel = (month: string) =>
  new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}T12:00:00Z`))

/** "Mon 19 – Sun 25 Oct" (months shown when they differ). */
export function weekRange(start: string): string {
  const a = formatDate(start)
  const b = formatDate(addDays(start, 6))
  return a.split(' ')[2] === b.split(' ')[2] ? `${a.split(' ').slice(0, 2).join(' ')} – ${b}` : `${a} – ${b}`
}

/** List or calendar, remembered per page in this browser. */
export function useScheduleView(key: string): [ScheduleView, (v: ScheduleView) => void] {
  const storageKey = `synqop.sessions-view.${key}`
  const [view, setView] = useState<ScheduleView>(() => {
    try {
      return localStorage.getItem(storageKey) === 'calendar' ? 'calendar' : 'list'
    } catch {
      return 'list'
    }
  })
  return [
    view,
    (v) => {
      setView(v)
      try {
        localStorage.setItem(storageKey, v)
      } catch {
        // Private windows: the choice just isn't remembered.
      }
    },
  ]
}
