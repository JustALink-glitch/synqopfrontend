import clsx from 'clsx'
import { CircleAlert, MapPin, Video } from 'lucide-react'
import { Link } from 'react-router'
import { Checkbox } from '@/components/ui/Choice'
import { UserGroupIcon } from '@/components/ui/icons'
import { Badge } from '@/components/ui/Page'
import { formatTime, lengthOf } from '@/lib/format'
import { whereLabel, type Session, type SessionStatus } from './data'
import { useSessionPaths } from './paths'

export function SessionStatusBadge({ status }: { status: SessionStatus }) {
  if (status === 'scheduled') return <Badge tone="neutral">Scheduled</Badge>
  if (status === 'in_progress') return <Badge tone="info">In progress</Badge>
  if (status === 'held') return <Badge tone="success">Held</Badge>
  return <Badge tone="neutral">Cancelled</Badge>
}

/** What still needs doing, in one line (C1.01 "Status line"). */
function statusLine(s: Session): { text: string; tone: 'warning' | 'muted' } | null {
  if (s.cancelled) return { text: `Cancelled${s.cancelled.reason ? ` — ${s.cancelled.reason}` : ''}`, tone: 'muted' }
  if ((s.status === 'held' || s.status === 'in_progress') && s.attendance.recorded === 0) return { text: 'Attendance not recorded yet', tone: 'warning' }
  return null
}

/**
 * One session in a day list (C1.01, A3.02 Upcoming sessions): time, a mode accent
 * (brand for online, green for in person), course, cohort and trainer, place, and who's expected.
 */
export function SessionRow({
  session: s,
  timeZone,
  showCohort = true,
  select,
}: {
  session: Session
  timeZone: string | undefined
  showCohort?: boolean
  /** A tick box for bulk actions (cancel several), on sessions that can still change. */
  select?: { checked: boolean; onChange: () => void }
}) {
  const paths = useSessionPaths()
  const line = statusLine(s)
  return (
    <li className="flex items-center gap-2 border-b border-default last:border-b-0">
      {select && (
        <Checkbox
          label={<span className="sr-only">Select {s.title}, {formatTime(s.startsAt, timeZone)}</span>}
          checked={select.checked}
          onChange={select.onChange}
          className="-my-2 -ml-2 p-2"
        />
      )}
      <Link
        to={paths.session(s.id)}
        className="flex min-w-0 flex-1 items-stretch gap-3 rounded-sm py-2.5 hover:bg-surface-hover focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none"
      >
        <span className="flex w-12 shrink-0 flex-col gap-0.5 tabular-nums">
          <span className={clsx('text-body-emphasis', s.cancelled ? 'text-muted line-through' : 'text-primary')}>{formatTime(s.startsAt, timeZone)}</span>
          <span className="text-caption whitespace-nowrap text-secondary">{lengthOf(s.startsAt, s.endsAt)}</span>
        </span>
        <span
          aria-hidden="true"
          className={clsx('w-[3px] shrink-0 rounded-full', s.cancelled ? 'bg-default' : s.mode === 'online' ? 'bg-brand' : 'bg-success')}
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={clsx('truncate text-body-strong', s.cancelled ? 'text-muted' : 'text-primary')}>{s.title}</span>
          <span className="truncate text-caption text-secondary">
            {[showCohort && s.cohort.name, s.trainer?.name ?? 'No trainer yet'].filter(Boolean).join(' · ')}
          </span>
          <span className="flex min-w-0 items-center gap-1 text-caption text-secondary">
            {s.mode === 'online' ? <Video aria-hidden className="size-3.5 shrink-0" /> : <MapPin aria-hidden className="size-3.5 shrink-0" />}
            <span className="truncate">{whereLabel(s)}</span>
          </span>
          {line && (
            <span className={clsx('flex min-w-0 items-center gap-1 text-caption', line.tone === 'warning' ? 'text-warning-fg' : 'text-muted')}>
              {line.tone === 'warning' && <CircleAlert aria-hidden className="size-3.5 shrink-0" />}
              <span className="truncate">{line.text}</span>
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-start gap-1 pt-0.5 text-caption text-secondary" title="Participants expected">
          <UserGroupIcon size={14} />
          <span className="tabular-nums">{s.expected}</span>
          <span className="sr-only">participants expected</span>
        </span>
      </Link>
    </li>
  )
}
