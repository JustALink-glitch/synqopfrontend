import { AlertBanner } from '@/components/ui/AlertBanner'
import { formatDay, formatTime, plural } from '@/lib/format'
import type { Clashes } from '@/pages/admin/sessions/data'

/** What overlaps, before saving (pilot feedback, Nov 2026). A warning, not a block: someone may be moving a class. */
export function ClashWarning({ clashes, timeZone, trainerName }: { clashes: Clashes | undefined; timeZone: string | undefined; trainerName?: string }) {
  if (!clashes || (!clashes.trainer.length && !clashes.zoom.length)) return null
  const when = (s: { startsAt: string; endsAt: string }) =>
    `${formatDay(s.startsAt, timeZone)}, ${formatTime(s.startsAt, timeZone)}–${formatTime(s.endsAt, timeZone)}`
  const first = clashes.trainer[0]
  const zoom = clashes.zoom[0]
  return (
    <AlertBanner tone="warning" title="This overlaps another class">
      <span className="flex flex-col gap-1">
        {first && (
          <span>
            {trainerName ?? 'The trainer'} is already teaching {first.title} · {first.cohort} on {when(first)}
            {clashes.trainer.length > 1 ? `, and ${plural(clashes.trainer.length - 1, 'other session')}` : ''}.
          </span>
        )}
        {zoom && (
          <span>
            {zoom.hosts === 1
              ? `Your Zoom account can only run one class at a time, and ${zoom.sessions[0]!.title} · ${zoom.sessions[0]!.cohort} is on then.`
              : `All ${zoom.hosts} Zoom hosts are in use then.`}{' '}
            {clashes.zoom.length > 1 ? `${plural(clashes.zoom.length, 'date')} clash. ` : ''}Add a licensed user to your Zoom account, or paste another meeting
            link.
          </span>
        )}
      </span>
    </AlertBanner>
  )
}
