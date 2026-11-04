import { ChevronRightIcon } from '@/components/ui/icons'
import { Badge } from '@/components/ui/Page'
import { openFile, fileKind, fileSize } from '@/lib/files'
import type { MyResource, MySession } from './data'

const markTone = { present: 'success', absent: 'warning', excused: 'info' } as const
const markLabel = { present: 'Present', absent: 'Absent', excused: 'Excused' } as const

/** Upcoming · Live now · Present / Absent / Excused / Not recorded · Cancelled (P3.02, P4.01). */
export function SessionBadge({ session: s }: { session: MySession }) {
  if (s.status === 'cancelled') return <Badge tone="neutral">Cancelled</Badge>
  if (s.status === 'in_progress') return <Badge tone="info">Live now</Badge>
  if (s.status === 'scheduled') return <Badge tone="neutral">Upcoming</Badge>
  return s.attendance ? <Badge tone={markTone[s.attendance.status]}>{markLabel[s.attendance.status]}</Badge> : <Badge tone="neutral">Not recorded</Badge>
}

/** One resource: a file opens a download, a link opens in a new tab. */
export function ResourceRow({ resource: r }: { resource: MyResource }) {
  const meta =
    r.kind === 'link'
      ? [r.url ? new URL(r.url).hostname.replace(/^www\./, '') : null, 'Link'].filter(Boolean).join(' · ')
      : [fileKind(r.name), r.size !== null ? fileSize(r.size) : null].filter(Boolean).join(' · ')
  const body = (
    <>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body-strong text-primary">{r.name}</span>
        <span className="text-caption text-secondary">{meta}</span>
      </span>
      <ChevronRightIcon size={16} className="shrink-0 text-icon-muted" />
    </>
  )
  const cls =
    'flex w-full items-center gap-3 border-b border-default py-2.5 text-left last:border-b-0 hover:bg-surface-hover focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none'
  return r.kind === 'link' && r.url ? (
    <a href={r.url} target="_blank" rel="noreferrer" className={cls}>
      {body}
    </a>
  ) : (
    <button type="button" className={cls} onClick={() => void openFile(`/v1/my/resources/${r.id}`, r.name, r.type)}>
      {body}
    </button>
  )
}
