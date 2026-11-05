import clsx from 'clsx'
import { CalendarDays, List, MapPin, Video } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { dayCount, monthGrid, type ScheduleView } from './period'
import { Link } from 'react-router'
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/ui/icons'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { formatDate, formatTime, formatTimeRange, lengthOf, localDate } from '@/lib/format'

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

/**
 * The bar above both views: the period's name on the left, filters and the view switch, then
 * ‹ This week/month › on the right. On phones the name and arrows share the first row; filters wrap below.
 */
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
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <h2 className="min-w-0 flex-1 text-heading-section text-primary" aria-live="polite">
        {label}
      </h2>
      {children && <div className="flex items-center gap-2 max-md:order-last max-md:w-full max-md:[&>*:first-child]:flex-1">{children}</div>}
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" aria-label={`Previous ${unit}`} onClick={() => onMove(-1)} className={arrow}>
          <ChevronLeftIcon size={18} />
        </button>
        <Button variant="secondary" onClick={onToday} disabled={atToday} className="!px-3">
          {unit === 'month' ? 'This month' : 'This week'}
        </Button>
        <button type="button" aria-label={`Next ${unit}`} onClick={() => onMove(1)} className={arrow}>
          <ChevronRightIcon size={18} />
        </button>
      </div>
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
        <span className="flex w-12 shrink-0 flex-col gap-0.5 tabular-nums">
          <span className={clsx('text-body-emphasis', cancelled ? 'text-muted line-through' : 'text-primary')}>{formatTime(startsAt, timeZone)}</span>
          <span className="text-caption whitespace-nowrap text-secondary">{lengthOf(startsAt, endsAt)}</span>
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
            {formatDate(date)} · {dayCount(list)}
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
  endsAt: string
  title: string
  mode: 'online' | 'in_person'
  /** Anything truthy: shown struck through. */
  cancelled?: unknown
}

/** Soft tints, one per course, so a month reads at a glance (as in the invoices calendar). */
const TINTS = [
  { bg: '#EAF2FF', bar: '#3B82F6', text: '#1E3A8A' },
  { bg: '#E7F6EC', bar: '#22A05B', text: '#14532D' },
  { bg: '#FFF4D6', bar: '#D99A00', text: '#713F00' },
  { bg: '#F2ECFE', bar: '#8B5CF6', text: '#4C1D95' },
  { bg: '#FDECEC', bar: '#E0484B', text: '#7F1D1D' },
  { bg: '#E3F6F6', bar: '#14A3A3', text: '#134E4E' },
]
const CANCELLED = { bg: '#F1F3F5', bar: '#C4CAD3', text: '#6B7480' }

/** The same course keeps the same colour in every view and month. */
function useTints<T>(items: T[], keyOf: (item: T) => string) {
  const keys = [...new Set(items.map(keyOf))].sort()
  const hash = (k: string) => [...k].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
  const used = new Map<string, number>()
  const taken = new Set<number>()
  for (const k of keys) {
    let i = hash(k) % TINTS.length
    // Keep courses on screen apart while there are colours left.
    for (let n = 0; taken.has(i) && n < TINTS.length; n++) i = (i + 1) % TINTS.length
    taken.add(i)
    used.set(k, i)
  }
  return (item: T) => TINTS[used.get(keyOf(item)) ?? 0]!
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/**
 * Month calendar (C1.01 calendar). Each day shows its sessions as tinted chips, one colour per course; phones
 * show coloured dots. Choosing a day opens a popup listing that day's sessions with the same rows as the list.
 */
export function MonthCalendar<T extends CalendarItem>({
  month,
  today,
  items,
  timeZone,
  colourKey,
  colourLabel,
  row,
}: {
  month: string
  today: string
  items: T[]
  timeZone: string | undefined
  /** Sessions with the same key share a colour (the course). */
  colourKey: (item: T) => string
  /** The name shown in the key under the calendar. */
  colourLabel: (item: T) => string
  row: (item: T) => ReactNode
}) {
  const grid = monthGrid(month)
  const byDay = new Map<string, T[]>()
  for (const s of items) {
    const d = localDate(s.startsAt, timeZone)
    byDay.set(d, [...(byDay.get(d) ?? []), s])
  }
  const inMonth = (d: string) => d.slice(0, 7) === month.slice(0, 7)
  const shown = items.filter((s) => inMonth(localDate(s.startsAt, timeZone)))
  const tint = useTints(items, colourKey)
  const legend = [...new Map(shown.map((s) => [colourKey(s), s])).values()]
  const [open, setOpen] = useState<string | null>(null)
  const chosen = open ? (byDay.get(open) ?? []) : []
  const tintOf = (s: T) => (s.cancelled ? CANCELLED : tint(s))

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-md border border-default">
        <div className="grid grid-cols-7 border-b border-default" aria-hidden="true">
          {WEEKDAYS.map((w) => (
            <span key={w} className="py-2 text-center text-caption-strong text-secondary">
              <span className="max-md:hidden">{w}</span>
              <span className="md:hidden">{w[0]}</span>
            </span>
          ))}
        </div>
        <ol className="grid grid-cols-7">
          {grid.days.map((d, i) => {
            const list = byDay.get(d) ?? []
            const extra = list.length - 2
            return (
              <li key={d} className={clsx('border-default', i % 7 !== 6 && 'border-r', i < 35 && 'border-b', !inMonth(d) && 'bg-surface-subtle')}>
                <button
                  type="button"
                  onClick={() => setOpen(d)}
                  aria-haspopup="dialog"
                  aria-label={`${formatDate(d)}${d === today ? ', today' : ''}: ${list.length ? dayCount(list) : 'no sessions'}`}
                  className="flex h-full min-h-[108px] w-full flex-col gap-1 p-1.5 text-left hover:bg-surface-hover focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none max-md:min-h-[58px] max-md:items-center max-md:p-1"
                >
                  <span
                    className={clsx(
                      'inline-flex size-6 shrink-0 items-center justify-center self-end rounded-full text-caption-strong tabular-nums max-md:self-center',
                      d === today ? 'bg-brand text-on-brand' : inMonth(d) ? 'text-primary' : 'text-muted',
                    )}
                  >
                    {String(Number(d.slice(8))).padStart(2, '0')}
                  </span>
                  {/* Phones: a coloured dot per session. */}
                  {list.length > 0 && (
                    <span aria-hidden="true" className="flex flex-wrap justify-center gap-0.5 md:hidden">
                      {list.slice(0, 4).map((s) => (
                        <span key={s.id} className="size-1.5 rounded-full" style={{ background: tintOf(s).bar }} />
                      ))}
                    </span>
                  )}
                  {/* Wide screens: two chips, then +N. */}
                  <span aria-hidden="true" className="flex w-full min-w-0 flex-col gap-1 max-md:hidden">
                    {list.slice(0, extra > 0 ? 1 : 2).map((s) => (
                      <Chip key={s.id} s={s} tint={tintOf(s)} timeZone={timeZone} />
                    ))}
                    {extra > 0 && (
                      <span className="flex min-w-0 gap-1">
                        <span className="min-w-0 flex-1">
                          <Chip s={list[1]!} tint={tintOf(list[1]!)} timeZone={timeZone} />
                        </span>
                        <span className="inline-flex shrink-0 items-center rounded-sm bg-surface-subtle px-1.5 text-caption-strong text-secondary">
                          +{extra}
                        </span>
                      </span>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </div>
      {legend.length > 0 && (
        <ul aria-label="Colours" className="flex flex-wrap gap-x-4 gap-y-1">
          {legend.map((s) => (
            <li key={colourKey(s)} className="flex items-center gap-1.5 text-caption text-secondary">
              <span aria-hidden="true" className="size-2.5 rounded-[3px]" style={{ background: tint(s).bar }} />
              {colourLabel(s)}
            </li>
          ))}
        </ul>
      )}
      <Dialog
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open ? `${open === today ? 'Today · ' : ''}${formatDate(open)}` : ''}
        description={open ? dayCount(chosen) : undefined}
        actions={
          <Button variant="secondary" onClick={() => setOpen(null)}>
            Close
          </Button>
        }
      >
        {chosen.length === 0 ? <p className="text-body text-secondary">Nothing scheduled this day.</p> : <ul className="-my-1">{chosen.map(row)}</ul>}
      </Dialog>
    </div>
  )
}

function Chip({ s, tint, timeZone }: { s: CalendarItem; tint: (typeof TINTS)[number]; timeZone: string | undefined }) {
  return (
    <span className="flex min-w-0 flex-col rounded-[4px] border-l-[3px] px-1.5 py-1" style={{ background: tint.bg, borderColor: tint.bar, color: tint.text }}>
      <span className={clsx('truncate text-caption-strong', Boolean(s.cancelled) && 'line-through')}>{s.title}</span>
      <span className="truncate text-[11px] leading-[14px] tabular-nums opacity-80">
        {formatTimeRange(s.startsAt, s.endsAt, timeZone)}
      </span>
    </span>
  )
}
