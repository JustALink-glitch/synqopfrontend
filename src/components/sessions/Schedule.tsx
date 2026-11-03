import clsx from 'clsx'
import { CalendarDays, List, MapPin, Video } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { monthGrid, type ScheduleView } from './period'
import { Link } from 'react-router'
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/ui/icons'
import { Button } from '@/components/ui/Button'
import { formatDate, formatTime, localDate, plural } from '@/lib/format'

/* Shared by the admin, trainer and participant sessions pages: one look for the week list and the month calendar. */

export function ViewSwitch({ value, onChange }: { value: ScheduleView; onChange: (v: ScheduleView) => void }) {
  const options = [
    { value: 'list' as const, label: 'List', icon: <List aria-hidden className="size-4" /> },
    { value: 'calendar' as const, label: 'Calendar', icon: <CalendarDays aria-hidden className="size-4" /> },
  ]
  return (
    <div role="group" aria-label="View" className="inline-flex h-9 shrink-0 rounded-md border border-default bg-surface p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            'inline-flex items-center gap-1.5 rounded-[5px] px-2.5 text-label-button transition-colors focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none',
            value === o.value ? 'bg-brand-subtle text-brand-text' : 'text-secondary hover:text-primary',
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  )
}

const arrow = 'inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-default bg-surface text-icon hover:bg-surface-hover'

/** Arrows, the period's name, filters, and Today: the bar above both views. */
export function PeriodNav({
  unit,
  label,
  onMove,
  onToday,
  atToday,
  children,
}: {
  unit: 'week' | 'month'
  label: string
  onMove: (step: -1 | 1) => void
  onToday: () => void
  atToday: boolean
  children?: ReactNode
}) {
  return (
    <div className="flex items-center gap-2 max-md:flex-wrap">
      <button type="button" aria-label={`Previous ${unit}`} onClick={() => onMove(-1)} className={arrow}>
        <ChevronLeftIcon size={18} />
      </button>
      <button type="button" aria-label={`Next ${unit}`} onClick={() => onMove(1)} className={arrow}>
        <ChevronRightIcon size={18} />
      </button>
      <h2 className="min-w-0 px-1 text-heading-section text-primary max-md:flex-1" aria-live="polite">
        {label}
      </h2>
      <div className="flex-1 max-md:hidden" />
      {children}
      <Button variant="secondary" onClick={onToday} disabled={atToday}>
        Today
      </Button>
    </div>
  )
}

/**
 * One session in a day list (C1.01 look): time, a mode accent (brand for online, green for in person),
 * the title, then up to three lines of detail, and anything on the right (a badge, a count).
 */
export function ScheduleRow({
  to,
  startsAt,
  endsAt,
  timeZone,
  title,
  detail,
  where,
  mode,
  cancelled,
  note,
  trailing,
}: {
  to: string
  startsAt: string
  endsAt: string
  timeZone: string | undefined
  title: string
  detail?: string | null
  where: string
  mode: 'online' | 'in_person'
  cancelled?: boolean
  note?: ReactNode
  trailing?: ReactNode
}) {
  return (
    <li className="border-b border-default last:border-b-0">
      <Link
        to={to}
        className="flex items-stretch gap-3 rounded-sm py-2.5 hover:bg-surface-hover focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none"
      >
        <span className="flex w-11 shrink-0 flex-col gap-0.5 tabular-nums">
          <span className={clsx('text-body-emphasis', cancelled ? 'text-muted line-through' : 'text-primary')}>{formatTime(startsAt, timeZone)}</span>
          <span className="text-caption text-secondary">{formatTime(endsAt, timeZone)}</span>
        </span>
        <span aria-hidden="true" className={clsx('w-[3px] shrink-0 rounded-full', cancelled ? 'bg-default' : mode === 'online' ? 'bg-brand' : 'bg-success')} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={clsx('truncate text-body-strong', cancelled ? 'text-muted' : 'text-primary')}>{title}</span>
          {detail && <span className="truncate text-caption text-secondary">{detail}</span>}
          <span className="flex min-w-0 items-center gap-1 text-caption text-secondary">
            {mode === 'online' ? <Video aria-hidden className="size-3.5 shrink-0" /> : <MapPin aria-hidden className="size-3.5 shrink-0" />}
            <span className="truncate">{where}</span>
          </span>
          {note}
        </span>
        {trailing && <span className="flex shrink-0 items-start gap-1 pt-0.5">{trailing}</span>}
      </Link>
    </li>
  )
}

/** Sessions grouped by day, newest day last; `row` draws each session. */
export function DayGroups<T extends { id: string; startsAt: string; cancelled?: unknown }>({
  items,
  timeZone,
  today,
  row,
}: {
  items: T[]
  timeZone: string | undefined
  today: string
  row: (item: T) => ReactNode
}) {
  const byDay = new Map<string, T[]>()
  for (const s of items) {
    const d = localDate(s.startsAt, timeZone)
    byDay.set(d, [...(byDay.get(d) ?? []), s])
  }
  return (
    <>
      {[...byDay.entries()].map(([date, list]) => (
        <section key={date} aria-label={formatDate(date)}>
          <h3 className="text-caption text-secondary">
            {date === today ? 'Today · ' : ''}
            {formatDate(date)} · {plural(list.filter((s) => !s.cancelled).length, 'session')}
          </h3>
          <ul>{list.map(row)}</ul>
        </section>
      ))}
    </>
  )
}

export interface CalendarItem {
  id: string
  startsAt: string
  title: string
  mode: 'online' | 'in_person'
  /** Anything truthy: shown struck through. */
  cancelled?: unknown
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/**
 * Month calendar. Wide screens show each day's sessions in the grid; phones show dots. Choosing a day
 * lists its sessions under the grid, drawn with the same rows as the list view.
 */
export function MonthCalendar<T extends CalendarItem>({
  month,
  today,
  items,
  timeZone,
  link,
  row,
}: {
  month: string
  today: string
  items: T[]
  timeZone: string | undefined
  link: (item: T) => string
  row: (item: T) => ReactNode
}) {
  const grid = monthGrid(month)
  const byDay = new Map<string, T[]>()
  for (const s of items) {
    const d = localDate(s.startsAt, timeZone)
    byDay.set(d, [...(byDay.get(d) ?? []), s])
  }
  const inMonth = (d: string) => d.slice(0, 7) === month.slice(0, 7)
  const fallback = inMonth(today) ? today : (grid.days.find((d) => inMonth(d) && byDay.has(d)) ?? month)
  const [picked, setPicked] = useState<string | null>(null)
  const selected = picked && inMonth(picked) ? picked : fallback
  const chosen = byDay.get(selected) ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-md border border-default">
        <div className="grid grid-cols-7 border-b border-default bg-surface-subtle" aria-hidden="true">
          {WEEKDAYS.map((w) => (
            <span key={w} className="py-1.5 text-center text-caption text-secondary">
              <span className="max-md:hidden">{w}</span>
              <span className="md:hidden">{w[0]}</span>
            </span>
          ))}
        </div>
        <ol className="grid grid-cols-7">
          {grid.days.map((d, i) => {
            const list = byDay.get(d) ?? []
            const live = list.filter((s) => !s.cancelled)
            const isSelected = d === selected
            return (
              <li
                key={d}
                className={clsx(
                  'relative flex min-h-[104px] flex-col gap-1 border-default p-1.5 max-md:min-h-14 max-md:items-center max-md:p-1',
                  i % 7 !== 6 && 'border-r',
                  i < 35 && 'border-b',
                  !inMonth(d) && 'bg-surface-subtle',
                  isSelected && 'bg-brand-subtle/40',
                )}
              >
                <button
                  type="button"
                  onClick={() => setPicked(d)}
                  aria-pressed={isSelected}
                  aria-label={`${formatDate(d)}${d === today ? ', today' : ''}: ${list.length ? plural(live.length, 'session') : 'no sessions'}`}
                  className="absolute inset-0 rounded-none focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none"
                />
                <span
                  aria-hidden="true"
                  className={clsx(
                    'pointer-events-none relative inline-flex size-6 items-center justify-center rounded-full text-caption-strong tabular-nums',
                    d === today ? 'bg-brand text-on-brand' : inMonth(d) ? 'text-primary' : 'text-muted',
                  )}
                >
                  {Number(d.slice(8))}
                </span>
                {/* Phones: a dot per session (up to three). */}
                {list.length > 0 && (
                  <span aria-hidden="true" className="pointer-events-none relative flex gap-0.5 md:hidden">
                    {list.slice(0, 3).map((s) => (
                      <span
                        key={s.id}
                        className={clsx('size-1.5 rounded-full', s.cancelled ? 'bg-default' : s.mode === 'online' ? 'bg-brand' : 'bg-success')}
                      />
                    ))}
                  </span>
                )}
                {/* Wide screens: the sessions themselves. */}
                <span className="relative flex min-w-0 flex-col gap-0.5 max-md:hidden">
                  {list.slice(0, 3).map((s) => (
                    <Link
                      key={s.id}
                      to={link(s)}
                      className={clsx(
                        'flex min-w-0 items-center gap-1 rounded-sm border-l-[3px] bg-surface px-1 py-0.5 text-caption hover:bg-surface-hover focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none',
                        s.cancelled
                          ? 'border-default text-muted line-through'
                          : s.mode === 'online'
                            ? 'border-brand text-primary'
                            : 'border-success text-primary',
                      )}
                    >
                      <span className="shrink-0 tabular-nums text-secondary">{formatTime(s.startsAt, timeZone)}</span>
                      <span className="truncate">{s.title}</span>
                    </Link>
                  ))}
                  {list.length > 3 && (
                    <button type="button" onClick={() => setPicked(d)} className="self-start px-1 text-caption-strong text-brand-text hover:underline">
                      +{list.length - 3} more
                    </button>
                  )}
                </span>
              </li>
            )
          })}
        </ol>
      </div>
      <section aria-labelledby="calendar-day-title" className="flex flex-col">
        <h3 id="calendar-day-title" className="text-caption text-secondary">
          {selected === today ? 'Today · ' : ''}
          {formatDate(selected)} · {chosen.length ? plural(chosen.filter((s) => !s.cancelled).length, 'session') : 'No sessions'}
        </h3>
        {chosen.length > 0 && <ul>{chosen.map(row)}</ul>}
      </section>
    </div>
  )
}
