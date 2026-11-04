import { initials } from '@/lib/people'
import { Avatar } from '@/components/ui/Avatar'
import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { useAuth } from '@/auth/useAuth'
import { StatePanel } from '@/components/StatePanel'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { BookOpenIcon, MailIcon, PencilIcon, PlusIcon } from '@/components/ui/icons'
import { Badge, EmptyState, PageHeader, Panel, PanelHeader } from '@/components/ui/Page'
import { ApiError } from '@/lib/api'
import { formatDay, formatTime } from '@/lib/format'
import { roleLabel } from '@/lib/people'
import { useRemind } from '@/pages/reports/data'
import { Cell, Row, Table } from '@/components/ui/Table'
import { AssignDialog, DeactivateDialog, EditDialog } from './TrainerDialogs'
import {
  fullNameOf,
  invitationExpired,
  useMember,
  useReactivateMember,
  useUnassignTrainer,
  type Assignment,
  type TrainerReport,
  useResendInvitation,
  useRevokeInvitation,
  type HistoryEntry,
  type MemberDetail,
} from './members'
import { StatusBadge } from './StatusBadge'

type Notice = { tone: 'success' | 'warning' | 'error'; title: string; body: string }

/** /admin/trainers/:id — B2.02 Trainer detail, B2.02i Invitation pending. */
export function TrainerDetailPage() {
  const { id = '' } = useParams()
  const query = useMember(id)

  if (query.isPending) return <div aria-busy="true" aria-label="Loading trainer" className="h-40" />
  if (query.isError) {
    const missing = query.error instanceof ApiError && query.error.status === 404
    return (
      <>
        <PageHeader title={missing ? 'Trainer not found' : 'Couldn’t load this trainer'} breadcrumb={[{ label: 'Trainers', to: '/admin/trainers' }]} />
        <Panel>
          <StatePanel
            kind={missing ? 'no-results' : 'error'}
            title={missing ? 'This person isn’t in your organisation' : 'Something went wrong'}
            description={missing ? 'Their invitation may have been revoked.' : 'Check your connection and try again.'}
          />
        </Panel>
      </>
    )
  }
  return <TrainerDetail member={query.data.member} history={query.data.history} assignments={query.data.assignments ?? []} reports={query.data.reports ?? []} />
}

function TrainerDetail({
  member,
  history,
  assignments,
  reports,
}: {
  member: MemberDetail
  history: HistoryEntry[]
  assignments: Assignment[]
  reports: TrainerReport[]
}) {
  const { state } = useAuth()
  const navigate = useNavigate()
  const timeZone = state.status === 'signed-in' ? state.me.organisation?.timeZone : undefined
  const when = (value: string) => `${formatDay(value, timeZone)}, ${formatTime(value, timeZone)}`

  const resend = useResendInvitation(member.id)
  const revoke = useRevokeInvitation(member.id)
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  // Opened from a ⋯ menu on the Trainers list ("Deactivate", "Edit", "Assign").
  const opened = (useLocation().state as { open?: 'assign' | 'edit' | 'deactivate' } | null)?.open ?? null
  const [dialog, setDialog] = useState<'assign' | 'edit' | 'deactivate' | null>(opened)
  const reactivate = useReactivateMember(member.id)
  const unassign = useUnassignTrainer(member.id)
  const deactivated = member.status === 'deactivated'
  const done = (title: string) => {
    setDialog(null)
    setNotice({ tone: 'success', title, body: '' })
  }

  const name = fullNameOf(member)
  const invited = member.status === 'invited'
  const expired = invitationExpired(member)

  const meta = [
    roleLabel[member.role],
    member.email,
    invited && member.invitedAt
      ? `Invited ${when(member.invitedAt)}${member.invitedBy ? ` by ${member.invitedBy}` : ''}`
      : member.joinedAt
        ? `Joined ${formatDay(member.joinedAt, timeZone)}`
        : null,
  ]
    .filter(Boolean)
    .join(' · ')

  async function onResend() {
    setNotice(null)
    try {
      const result = await resend.mutateAsync()
      setNotice(
        result.emailSent
          ? { tone: 'success', title: 'New invitation sent', body: `We emailed a new link to ${member.email}. The previous link no longer works.` }
          : { tone: 'warning', title: 'The email didn’t send', body: 'A new link was created, but we couldn’t email it. Try again in a moment.' },
      )
    } catch (error) {
      setNotice({
        tone: 'error',
        title: 'Couldn’t resend the invitation',
        body: error instanceof ApiError && error.status < 500 ? error.message : 'Check your connection and try again.',
      })
    }
  }

  async function onRevoke() {
    try {
      await revoke.mutateAsync()
      navigate('/admin/trainers', { state: { revoked: name } })
    } catch (error) {
      setConfirmRevoke(false)
      setNotice({
        tone: 'error',
        title: 'Couldn’t revoke the invitation',
        body: error instanceof ApiError && error.status < 500 ? error.message : 'Check your connection and try again.',
      })
    }
  }

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: 'Trainers', to: '/admin/trainers' }, { label: name }]}
        title={name}
        leading={<Avatar size={40} initials={initials(member.firstName, member.lastName)} seed={member.id} enlarge={name} />}
        badge={member.status === 'active' ? undefined : <StatusBadge member={member} />}
        description={meta}
        actions={
          invited ? (
            <>
              <Button variant="secondary" onClick={() => setConfirmRevoke(true)} disabled={resend.isPending}>
                Revoke invitation
              </Button>
              <Button variant="secondary" icon={<PencilIcon size={16} />} onClick={() => setDialog('edit')}>
                Edit
              </Button>
              <Button icon={<MailIcon size={16} />} onClick={onResend} disabled={resend.isPending}>
                {resend.isPending ? 'Sending…' : 'Resend invitation'}
              </Button>
            </>
          ) : deactivated ? (
            <Button
              onClick={() =>
                reactivate.mutate(undefined, {
                  onSuccess: () => done(`${name} can sign in again`),
                  onError: () => setNotice({ tone: 'error', title: 'Couldn’t reactivate', body: 'Try again.' }),
                })
              }
              disabled={reactivate.isPending}
            >
              {reactivate.isPending ? 'Reactivating…' : 'Reactivate'}
            </Button>
          ) : (
            <>
              <Button variant="secondary" icon={<PencilIcon size={16} />} onClick={() => setDialog('edit')}>
                Edit
              </Button>
              <Button icon={<PlusIcon size={16} />} onClick={() => setDialog('assign')}>
                Assign to course
              </Button>
            </>
          )
        }
      />

      {notice && (
        <AlertBanner tone={notice.tone} title={notice.title}>
          {notice.body || undefined}
        </AlertBanner>
      )}
      {deactivated && (
        <AlertBanner title={`${member.firstName} is deactivated`}>
          They can’t sign in{member.deactivatedAt ? ` since ${formatDay(member.deactivatedAt, timeZone)}` : ''}. Their courses are kept, so reactivating brings
          everything back.
        </AlertBanner>
      )}

      {invited &&
        !notice &&
        member.invitationExpiresAt &&
        (expired ? (
          <AlertBanner tone="warning" title={`${member.firstName}’s invitation link has expired`}>
            It expired {when(member.invitationExpiresAt)}. Resend to email a new link that lasts 72 hours.
          </AlertBanner>
        ) : (
          <AlertBanner title={`Waiting for ${member.firstName} to set a password`}>
            The invitation link expires {when(member.invitationExpiresAt)} — 72 hours after it was sent. Resending sends a new link and cancels the old one.
          </AlertBanner>
        ))}

      <div className="flex items-start gap-4 max-lg:flex-col">
        <div className="flex min-w-0 flex-1 flex-col gap-4 max-lg:w-full">
          <Panel aria-labelledby="teaching-title" className="gap-3">
            <PanelHeader
              id="teaching-title"
              title="Teaching"
              description={
                invited ? `Courses ${member.firstName} will lead or assist once signed in.` : `Courses ${member.firstName} leads or assists, by cohort.`
              }
            />
            {assignments.length > 0 ? (
              <Table
                columns={[
                  { label: 'Course' },
                  { label: 'Role', width: 100 },
                  { label: 'Sessions held', width: 120, align: 'right', hideBelow: 'lg' },
                  { label: 'Next session', width: 170, hideBelow: 'lg' },
                  { label: '', width: 90 },
                ]}
              >
                {assignments.map((a) => (
                  <Row key={a.cohortCourseId}>
                    <Cell>
                      <Link to={`/admin/cohorts/${a.cohort.id}/courses`} className="flex min-w-0 flex-col">
                        <span className="truncate text-body-strong text-primary">{a.course.name}</span>
                        <span className="truncate text-caption text-secondary">{a.cohort.name}</span>
                      </Link>
                    </Cell>
                    <Cell>{a.lead ? 'Lead' : 'Assistant'}</Cell>
                    <Cell align="right" hideBelow="lg" className="font-medium">
                      {a.held} of {a.planned}
                    </Cell>
                    <Cell hideBelow="lg">{a.nextSessionAt ? when(a.nextSessionAt) : '—'}</Cell>
                    <Cell align="right">
                      {!deactivated && (
                        <button
                          type="button"
                          aria-label={`Take ${member.firstName} off ${a.course.name} in ${a.cohort.name}`}
                          onClick={() =>
                            unassign.mutate(a.cohortCourseId, {
                              onSuccess: () => done(`${member.firstName} was taken off ${a.course.name} in ${a.cohort.name}`),
                            })
                          }
                          className="text-caption-strong text-secondary hover:text-error-fg hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </Cell>
                  </Row>
                ))}
              </Table>
            ) : (
              <EmptyState
                icon={<BookOpenIcon size={24} />}
                title="Not assigned to a course yet"
                body={`Assign ${member.firstName} to a course in a cohort to give them its sessions, participants and assignments.${invited ? ' They’ll see it after they sign in for the first time.' : ''}`}
                actions={
                  deactivated ? undefined : (
                    <Button icon={<PlusIcon size={16} />} onClick={() => setDialog('assign')}>
                      Assign to course
                    </Button>
                  )
                }
              />
            )}
          </Panel>

          {reports.length > 0 && (
            <Panel aria-labelledby="reports-title" className="gap-3">
              <PanelHeader id="reports-title" title="Session reports" description="Their latest sessions and whether the report is in." />
              <Table
                columns={[{ label: 'Session' }, { label: 'Held', width: 130, hideBelow: 'lg' }, { label: 'Report', width: 120 }, { label: '', width: 90 }]}
              >
                {reports.map((r) => (
                  <Row key={r.sessionId}>
                    <Cell>
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-body-strong text-primary">{r.course}</span>
                        <span className="truncate text-caption text-secondary">
                          {r.cohort} · Session {r.number}
                        </span>
                      </span>
                    </Cell>
                    <Cell hideBelow="lg">{formatDay(r.startsAt, timeZone)}</Cell>
                    <Cell>
                      <Badge tone={r.status === 'submitted' ? 'success' : r.status === 'overdue' ? 'error' : 'neutral'}>
                        {r.status === 'submitted' ? 'Submitted' : r.status === 'overdue' ? 'Overdue' : 'Due'}
                      </Badge>
                    </Cell>
                    <Cell align="right">
                      {r.status === 'overdue' && !deactivated ? (
                        <RemindButton sessionId={r.sessionId} onSent={(to) => setNotice({ tone: 'success', title: `Reminder sent to ${to}`, body: '' })} />
                      ) : (
                        <Link to={`/admin/courses/reports/${r.sessionId}`} className="text-body-strong text-brand-text hover:underline">
                          View
                        </Link>
                      )}
                    </Cell>
                  </Row>
                ))}
              </Table>
            </Panel>
          )}
        </div>

        <div className="flex w-[356px] shrink-0 flex-col gap-4 max-lg:w-full">
          <Panel aria-labelledby="details-title" className="gap-0">
            <PanelHeader id="details-title" title="Details" />
            <dl className="mt-2 flex flex-col">
              {[
                ['Email', member.email],
                ['Phone', member.phone ?? '—'],
                ['Role', roleLabel[member.role]],
                ['Last signed in', member.lastActiveAt ? when(member.lastActiveAt) : invited ? 'Not yet' : '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-3 border-b border-default py-3 text-body last:border-b-0">
                  <dt className="w-[110px] shrink-0 text-secondary">{label}</dt>
                  <dd className="min-w-0 text-body-strong break-words text-primary">{value}</dd>
                </div>
              ))}
            </dl>
            {member.status === 'active' && (
              <button type="button" onClick={() => setDialog('deactivate')} className="self-start pt-3 text-caption-strong text-error-fg hover:underline">
                Deactivate {member.firstName}
              </button>
            )}
          </Panel>
          <Panel aria-labelledby="sees-title" className="gap-1">
            <PanelHeader id="sees-title" title={`What ${member.firstName} can see`} />
            <p className="text-body text-secondary">Participants, sessions and assignments in the cohorts they teach. Nothing from other cohorts.</p>
          </Panel>
        </div>
      </div>

      {history.length > 0 && member.status !== 'active' && (
        <Panel aria-labelledby="history-title">
          <PanelHeader id="history-title" title="Invitation history" />
          <ol>
            {history.map((entry, index) => (
              <li key={`${entry.at}-${index}`} className="flex gap-4 border-b border-default py-2.5 last:border-b-0 max-md:flex-col max-md:gap-0.5">
                <time dateTime={entry.at} className="w-40 shrink-0 text-body text-secondary tabular-nums">
                  {when(entry.at)}
                </time>
                <span className="text-body-strong text-primary">{describe(entry, member)}</span>
              </li>
            ))}
          </ol>
        </Panel>
      )}

      <Dialog
        open={confirmRevoke}
        onClose={() => !revoke.isPending && setConfirmRevoke(false)}
        width={440}
        title={`Revoke ${member.firstName}’s invitation?`}
        description={`The link in their email stops working and ${name} is removed from Trainers. You can invite them again later.`}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirmRevoke(false)} disabled={revoke.isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onRevoke} disabled={revoke.isPending}>
              {revoke.isPending ? 'Revoking…' : 'Revoke invitation'}
            </Button>
          </>
        }
      />
      {dialog === 'assign' && <AssignDialog member={member} onClose={() => setDialog(null)} onDone={done} />}
      {dialog === 'edit' && <EditDialog member={member} onClose={() => setDialog(null)} onDone={done} />}
      {dialog === 'deactivate' && <DeactivateDialog member={member} assignments={assignments} onClose={() => setDialog(null)} onDone={done} />}
    </>
  )
}

function RemindButton({ sessionId, onSent }: { sessionId: string; onSent: (to: string) => void }) {
  const remind = useRemind(sessionId)
  return (
    <button
      type="button"
      disabled={remind.isPending}
      onClick={() => remind.mutate(undefined, { onSuccess: (r) => onSent(r.to) })}
      className="text-body-strong text-brand-text hover:underline disabled:text-disabled"
    >
      {remind.isPending ? 'Sending…' : 'Remind'}
    </button>
  )
}

function describe(entry: HistoryEntry, member: MemberDetail): string {
  const by = entry.actor ? ` by ${entry.actor}` : ''
  switch (entry.action) {
    case 'member.invited':
      return `Invitation sent${by}`
    case 'member.invitation_resent':
      return `Invitation resent${by} — the earlier link stopped working`
    case 'member.invitation_renewed':
      return `${member.firstName} asked for a new link — it was emailed automatically`
    case 'member.joined':
      return `${member.firstName} set a password and joined`
    default:
      return 'Updated'
  }
}
