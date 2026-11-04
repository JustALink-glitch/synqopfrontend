import { useInfiniteQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/auth/useAuth'
import { StatePanel } from '@/components/StatePanel'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Panel } from '@/components/ui/Page'
import { SelectField } from '@/components/ui/TextField'
import { api } from '@/lib/api'
import { formatTime, relativeDay } from '@/lib/format'
import { initials, roleLabel } from '@/lib/people'
import type { Role } from '@/lib/roles'
import { SettingsTitle } from './SettingsLayout'

type ActivityEvent = {
  id: string
  action: string
  at: string
  actor: { id: string; name: string; role: Role } | null
  entity: { type: string; id: string | null; name: string | null; detail: string | null }
  data: Record<string, unknown>
}
type Page = { events: ActivityEvent[]; next: string | null }

const WHO = [
  { value: 'staff', label: 'Admins and trainers' },
  { value: 'admins', label: 'Admins' },
  { value: 'trainers', label: 'Trainers' },
  { value: 'participants', label: 'Participants' },
  { value: 'all', label: 'Everyone' },
] as const

const GROUPS = [
  { value: '', label: 'Everything' },
  { value: 'sessions', label: 'Sessions, attendance and reports' },
  { value: 'people', label: 'People and enrolments' },
  { value: 'programmes', label: 'Programmes, cohorts and courses' },
  { value: 'work', label: 'Assignments and grades' },
  { value: 'flags', label: 'Needs attention' },
  { value: 'resources', label: 'Resources' },
  { value: 'announcements', label: 'Announcements' },
  { value: 'reports', label: 'Reports and exports' },
  { value: 'settings', label: 'Settings and Zoom' },
] as const

/** What each recorded action reads as after the person's name. Unknown actions fall back to a plain form. */
const VERBS: Record<string, string> = {
  'session.updated': 'changed a session',
  'session.cancelled': 'cancelled a session',
  'sessions.scheduled': 'scheduled sessions in',
  'session.feedback_left': 'left feedback on a session',
  'session_report.submitted': 'submitted the session report for',
  'session_report.updated': 'updated the session report for',
  'session_report.draft_saved': 'saved a draft session report for',
  'session_report.reminded': 'sent a report reminder for',
  'attendance.register_saved': 'saved the register for',
  'attendance.zoom_matched': 'matched Zoom attendees for',
  'resource.added': 'added a resource to',
  'resource.removed': 'removed a resource from',
  'assignment.published': 'published the assignment',
  'assignment.drafted': 'drafted the assignment',
  'assignment.updated': 'edited the assignment',
  'grade.created': 'graded',
  'grade.updated': 'changed the grade for',
  'submission.created': 'handed in',
  'submission.replaced': 'replaced their work for',
  'attention.resolved': 'resolved the flag for',
  'intervention.recorded': 'recorded a follow-up with',
  'outcome.recorded': 'recorded an outcome for',
  'certificates.issued': 'issued certificates in',
  'participant.enrolled': 'enrolled',
  'participant.updated': 'updated',
  'participants.imported': 'imported participants into',
  'enrolment.deferred': 'deferred',
  'enrolment.withdrawn': 'withdrew',
  'enrolment.transferred': 'transferred',
  'member.invited': 'invited',
  'member.joined': 'joined',
  'member.assigned': 'assigned',
  'member.unassigned': 'unassigned',
  'member.role_changed': 'changed the role of',
  'member.deactivated': 'deactivated',
  'member.reactivated': 'reactivated',
  'member.removed': 'removed',
  'member.updated': 'updated',
  'member.profile_updated': 'updated their profile',
  'member.invitation_resent': 'resent the invitation to',
  'member.invitation_renewed': 'renewed the invitation for',
  'member.invitation_revoked': 'revoked the invitation for',
  'programme.created': 'created the programme',
  'programme.updated': 'edited the programme',
  'programme.archived': 'archived the programme',
  'programme.restored': 'restored the programme',
  'cohort.created': 'created the cohort',
  'cohort.updated': 'edited the cohort',
  'cohort.archived': 'archived the cohort',
  'cohort.restored': 'restored the cohort',
  'course.created': 'created the course',
  'course.updated': 'edited the course',
  'course.archived': 'archived the course',
  'course.restored': 'restored the course',
  'announcement.posted': 'posted the announcement',
  'announcement.edited': 'edited the announcement',
  'announcement.deleted': 'deleted an announcement',
  'report.generated': 'generated the report',
  'report.downloaded': 'downloaded the report',
  'report.deleted': 'deleted a report',
  'data.exported': 'exported the organisation’s data',
  'data.export_downloaded': 'downloaded the data export',
  'settings.attention_rules_updated': 'changed the Needs attention rules',
  'settings.completion_updated': 'changed completion and certificate settings',
  'settings.session_reports_updated': 'changed session report settings',
  'organisation.created': 'created the organisation',
  'organisation.updated': 'changed organisation details',
  'organisation.deletion_scheduled': 'scheduled the organisation for deletion',
  'organisation.deletion_cancelled': 'cancelled the organisation’s deletion',
  'organisation.ownership_transferred': 'transferred ownership',
  'zoom.connected': 'connected Zoom',
  'zoom.disconnected': 'disconnected Zoom',
}

const plain = (action: string) => action.replace(/[._]/g, ' ')

function linkFor(e: ActivityEvent): string | null {
  if (!e.entity.id || !e.entity.name) return null
  switch (e.entity.type) {
    case 'session':
      return `/admin/courses/sessions/${e.entity.id}`
    case 'cohort':
      return `/admin/cohorts/${e.entity.id}`
    case 'programme':
      return `/admin/programmes/${e.entity.id}`
    case 'course':
      return `/admin/courses/library/${e.entity.id}`
    default:
      return null
  }
}

/** /admin/settings/activity — everything recorded in the organisation, newest first (pilot feedback, Nov 2026). */
export function ActivityLogPage() {
  const { state } = useAuth()
  const timeZone = state.status === 'signed-in' ? state.me.organisation?.timeZone : undefined
  const [who, setWho] = useState<(typeof WHO)[number]['value']>('staff')
  const [group, setGroup] = useState<(typeof GROUPS)[number]['value']>('')
  const query = useInfiniteQuery({
    queryKey: ['activity', who, group],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      api<Page>(`/v1/activity?who=${who}${group ? `&group=${group}` : ''}${pageParam ? `&before=${pageParam}` : ''}`, { signal }),
    getNextPageParam: (last) => last.next,
  })
  const events = query.data?.pages.flatMap((p) => p.events) ?? []

  // Group by day, in the organisation's time zone.
  const days: { label: string; events: ActivityEvent[] }[] = []
  for (const e of events) {
    const label = relativeDay(e.at, timeZone)
    if (days.at(-1)?.label !== label) days.push({ label, events: [] })
    days.at(-1)!.events.push(e)
  }

  return (
    <>
      <SettingsTitle
        title="Activity log"
        description="What admins, trainers and participants have done in Synqop, newest first. Only owners and admins see this."
      />
      <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
        <SelectField label="Who" value={who} onChange={(e) => setWho(e.target.value as typeof who)}>
          {WHO.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </SelectField>
        <SelectField label="What" value={group} onChange={(e) => setGroup(e.target.value as typeof group)}>
          {GROUPS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </SelectField>
      </div>
      {query.isPending ? (
        <Panel aria-busy="true" aria-label="Loading activity" className="h-[240px]">
          <span className="sr-only">Loading activity</span>
        </Panel>
      ) : query.isError ? (
        <Panel>
          <StatePanel
            kind="error"
            title="Couldn’t load the activity log"
            description="Check your connection and try again."
            action={{ label: 'Try again', onClick: () => void query.refetch() }}
          />
        </Panel>
      ) : events.length === 0 ? (
        <Panel>
          <StatePanel kind="no-results" title="Nothing recorded yet" description="Try another person or kind of activity." />
        </Panel>
      ) : (
        <Panel className="gap-0 py-2">
          {days.map((d) => (
            <section key={d.label} aria-label={d.label}>
              <h2 className="pt-3 pb-1 text-caption-strong text-secondary">{d.label}</h2>
              <ul>
                {d.events.map((e) => {
                  const to = linkFor(e)
                  const target = e.entity.name ?? null
                  return (
                    <li key={e.id} className="flex items-start gap-3 border-b border-default py-3 last:border-b-0">
                      {e.actor ? (
                        <Avatar size={32} initials={initials(e.actor.name)} seed={e.actor.id} />
                      ) : (
                        <span className="size-8 shrink-0 rounded-full bg-neutral-bg" aria-hidden="true" />
                      )}
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-body text-primary">
                          <span className="text-body-strong">{e.actor?.name ?? 'Synqop'}</span> {VERBS[e.action] ?? plain(e.action)}
                          {target && (
                            <>
                              {' '}
                              {to ? (
                                <Link to={to} className="text-body-strong text-brand-text hover:underline">
                                  {target}
                                </Link>
                              ) : (
                                <span className="text-body-strong">{target}</span>
                              )}
                            </>
                          )}
                        </span>
                        <span className="text-caption text-secondary">
                          {[formatTime(e.at, timeZone), e.actor && roleLabel[e.actor.role], e.entity.detail].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
          {query.hasNextPage && (
            <div className="flex justify-center py-3">
              <Button variant="secondary" onClick={() => void query.fetchNextPage()} disabled={query.isFetchingNextPage}>
                {query.isFetchingNextPage ? 'Loading…' : 'Show older activity'}
              </Button>
            </div>
          )}
        </Panel>
      )}
    </>
  )
}
