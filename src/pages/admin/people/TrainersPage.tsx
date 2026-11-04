import { CalendarDays, ClipboardCheck, Layers } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { StatePanel } from '@/components/StatePanel'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, UserIcon } from '@/components/ui/icons'
import { Badge, EmptyState, FilterChips, PageHeader, Panel } from '@/components/ui/Page'
import { SearchField } from '@/components/ui/SearchField'
import { initials } from '@/lib/people'
import { InviteTrainerDialog } from './InviteTrainerDialog'
import { fullNameOf, TRAINER_ROLES, useMembers, type Member } from './members'
import { StatusBadge } from './StatusBadge'
import { useQueryClient } from '@tanstack/react-query'
import { Download, Mail, UserX } from 'lucide-react'
import { BulkBar, CardGrid, ItemCard, LayoutSwitch, RowActions } from '@/components/collection/Collection'
import { GRID_PANEL, useLayout } from '@/components/collection/layout'
import { downloadCsv, runBulk, useSelection, type Selection } from '@/components/collection/selection'
import { SelectBox } from '@/components/ui/Table'
import { api, ApiError } from '@/lib/api'
import { plural } from '@/lib/format'

const DESCRIPTION = 'People who deliver courses. Trainers only see the cohorts you assign them to.'
const PAGE_SIZE = 25

type Filter = 'all' | 'active' | 'invited'
type Notice = { tone: 'success' | 'warning'; title: string; body: string }

/** /admin/trainers — B2.01 Trainers, B2.01e empty, with B2.03 Invite trainer. */
export function TrainersPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const members = useMembers(TRAINER_ROLES)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [inviting, setInviting] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(() => {
    const revoked = (location.state as { revoked?: string } | null)?.revoked
    return revoked ? { tone: 'success', title: 'Invitation revoked', body: `${revoked}’s link no longer works.` } : null
  })

  const all = useMemo(() => members.data ?? [], [members.data])
  const counts = {
    all: all.length,
    active: all.filter((m) => m.status === 'active').length,
    invited: all.filter((m) => m.status === 'invited').length,
  }
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase()
    return all.filter((m) => (filter === 'all' || m.status === filter) && (!query || fullNameOf(m).toLowerCase().includes(query) || m.email.includes(query)))
  }, [all, filter, search])
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const rows = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const [layout, setLayout] = useLayout('trainers')
  const selection = useSelection(rows.map((m) => m.id))
  const chosen = rows.filter((m) => selection.has(m.id))
  const client = useQueryClient()
  const refresh = () => client.invalidateQueries({ queryKey: ['members'] })
  const resend = (m: Member) =>
    m.status === 'invited' ? api(`/v1/members/${m.id}/invitation`, { method: 'POST' }) : Promise.reject(new ApiError(409, 'joined', 'Already joined.'))
  const deactivate = (m: Member) =>
    m.status === 'active'
      ? api(`/v1/members/${m.id}/deactivate`, { method: 'POST', body: { notify: true } })
      : Promise.reject(new ApiError(409, 'not_active', 'Hasn’t joined, or is already deactivated.'))
  async function bulk(action: string, items: Member[], run: (m: Member) => Promise<unknown>) {
    const o = await runBulk(action, items, fullNameOf, run)
    await refresh()
    return o
  }
  async function one(action: string, m: Member, run: (m: Member) => Promise<unknown>) {
    const o = await bulk(action, [m], run)
    setNotice(
      o.done.length
        ? { tone: 'success', title: `${action}: ${fullNameOf(m)}`, body: '' }
        : { tone: 'warning', title: `Couldn’t do that for ${fullNameOf(m)}`, body: o.skipped[0]?.reason ?? '' },
    )
  }
  const rowActions = (m: Member) => (
    <RowActions
      label={fullNameOf(m)}
      items={[
        { label: 'Open', onSelect: () => navigate(m.id) },
        ...(m.status !== 'deactivated'
          ? [
              { label: 'Edit details', onSelect: () => navigate(m.id, { state: { open: 'edit' } }) },
              { label: 'Assign to a course', onSelect: () => navigate(m.id, { state: { open: 'assign' } }) },
            ]
          : []),
        ...(m.status === 'invited' ? [{ label: 'Resend invitation', onSelect: () => void one('Invitation resent', m, resend) }] : []),
        ...(m.status === 'active' ? [{ label: 'Deactivate', destructive: true, onSelect: () => navigate(m.id, { state: { open: 'deactivate' } }) }] : []),
        ...(m.status === 'deactivated'
          ? [{ label: 'Reactivate', onSelect: () => void one('Reactivated', m, (x) => api(`/v1/members/${x.id}/reactivate`, { method: 'POST' })) }]
          : []),
      ]}
    />
  )

  const inviteButton = (
    <Button icon={<PlusIcon size={16} />} onClick={() => setInviting(true)}>
      Invite trainer
    </Button>
  )

  function onInvited(member: Member, emailSent: boolean) {
    setInviting(false)
    setFilter('all')
    setSearch('')
    setNotice(
      emailSent
        ? { tone: 'success', title: 'Invitation sent', body: `${member.firstName} has 72 hours to set a password from the link we emailed to ${member.email}.` }
        : {
            tone: 'warning',
            title: `${member.firstName} was added, but the email didn’t send`,
            body: 'Open their page and choose Resend invitation.',
          },
    )
    // Clear any "revoked" message carried in from the trainer page.
    if (location.state) navigate('.', { replace: true, state: null })
  }

  return (
    <>
      <PageHeader title="Trainers" description={DESCRIPTION} actions={all.length > 0 || members.isPending ? inviteButton : undefined} />

      {notice && (
        <AlertBanner tone={notice.tone} title={notice.title}>
          {notice.body}
        </AlertBanner>
      )}

      {members.isPending ? (
        <Panel aria-busy="true" aria-label="Loading trainers" className="h-[240px]">
          <span className="sr-only">Loading trainers</span>
        </Panel>
      ) : members.isError ? (
        <Panel>
          <StatePanel
            kind="error"
            title="Couldn’t load trainers"
            description="Check your connection and try again."
            action={{ label: 'Try again', onClick: () => void members.refetch() }}
          />
        </Panel>
      ) : all.length === 0 ? (
        <Panel className="py-16">
          <EmptyState
            icon={<UserIcon size={24} />}
            title="No trainers yet"
            body="Invite trainers by email. They set a password from the link, then you assign them to courses."
            actions={inviteButton}
          />
        </Panel>
      ) : (
        <>
          <div className="flex items-center gap-3 max-md:flex-col max-md:items-stretch">
            <FilterChips
              label="Status"
              value={filter}
              onChange={(value) => {
                setFilter(value)
                setPage(1)
              }}
              options={[
                { value: 'all', label: 'All', count: counts.all },
                { value: 'active', label: 'Active', count: counts.active },
                { value: 'invited', label: 'Invited', count: counts.invited },
              ]}
            />
            <div className="flex-1" />
            <SearchField
              aria-label="Search trainers"
              placeholder="Search trainers"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
            <LayoutSwitch value={layout} onChange={setLayout} />
          </div>
          <BulkBar
            selection={selection}
            noun={['trainer', 'trainers']}
            actions={[
              {
                label: 'Export CSV',
                icon: <Download aria-hidden className="size-4" />,
                run: async () =>
                  downloadCsv(
                    'Trainers.csv',
                    ['First name', 'Last name', 'Email', 'Role', 'Status', 'Cohorts', 'Courses', 'Sessions this week'],
                    chosen.map((m) => [
                      m.firstName,
                      m.lastName,
                      m.email,
                      m.role === 'assistant_trainer' ? 'Assistant trainer' : 'Trainer',
                      m.status,
                      m.teaching.cohorts.map((c) => c.name).join('; '),
                      m.teaching.courses.map((c) => c.name).join('; '),
                      m.sessionsThisWeek ?? 0,
                    ]),
                  ),
              },
              {
                label: 'Resend invitation',
                icon: <Mail aria-hidden className="size-4" />,
                confirm: {
                  title: 'Resend invitations?',
                  body: 'A new 72-hour link goes to each ticked trainer who hasn’t joined yet. Anyone who has joined is skipped.',
                  button: 'Resend',
                },
                run: () => bulk('Invitation resent', chosen, resend),
              },
              {
                label: 'Deactivate',
                icon: <UserX aria-hidden className="size-4" />,
                destructive: true,
                confirm: {
                  title: `Deactivate ${plural(selection.count, 'trainer')}?`,
                  body: 'They can’t sign in, come off the courses they teach and off sessions that haven’t started. What they recorded stays. Each gets an email. You can reactivate them later.',
                  button: 'Deactivate',
                },
                run: () => bulk('Deactivated', chosen, deactivate),
              },
            ]}
          />

          <Panel className={layout === 'grid' ? GRID_PANEL : 'gap-0 py-4 max-md:py-2'}>
            {visible.length === 0 ? (
              <StatePanel kind="no-results" title="No trainers match" description="Try another name or email, or clear the filter." />
            ) : layout === 'grid' ? (
              <CardGrid label="Trainers">
                {rows.map((m) => (
                  <ItemCard
                    key={m.id}
                    to={m.id}
                    title={fullNameOf(m)}
                    description={
                      m.teaching.cohorts.length
                        ? `Teaches ${m.teaching.courses.map((c) => c.name).join(', ') || 'courses'} in ${m.teaching.cohorts.map((c) => c.name).join(', ')}`
                        : `${m.email} · Not assigned yet`
                    }
                    leading={<Avatar size={24} initials={initials(m.firstName, m.lastName)} seed={m.id} />}
                    badge={
                      <>
                        <StatusBadge member={m} />
                        <Badge tone="neutral">{m.role === 'assistant_trainer' ? 'Assistant' : 'Lead trainer'}</Badge>
                      </>
                    }
                    select={{ checked: selection.has(m.id), onChange: () => selection.toggle(m.id) }}
                    selecting={selection.count > 0}
                    actions={rowActions(m)}
                    meta={[
                      { icon: <Layers />, text: plural(m.teaching.cohorts.length, 'cohort') },
                      { icon: <ClipboardCheck />, text: plural(m.teaching.courses.length, 'course') },
                      { icon: <CalendarDays />, text: m.status === 'active' ? `${m.sessionsThisWeek ?? 0} this week` : '—', label: 'Sessions this week' },
                    ]}
                  />
                ))}
              </CardGrid>
            ) : (
              <>
                <TrainerTable rows={rows} selection={selection} actions={rowActions} />
                <TrainerList rows={rows} />
              </>
            )}
            <footer className="flex h-[52px] items-center gap-2 border-t border-default max-md:h-auto max-md:pt-3">
              <p className="flex-1 text-caption text-secondary">
                {counts.all} {counts.all === 1 ? 'trainer' : 'trainers'}
                {counts.invited > 0 && ` · ${counts.invited} ${counts.invited === 1 ? 'invitation' : 'invitations'} pending`}
              </p>
              <p className="text-caption-strong text-primary">
                Page {currentPage} of {pageCount}
              </p>
              <PageButton label="Previous page" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
                <ChevronLeftIcon size={16} />
              </PageButton>
              <PageButton label="Next page" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>
                <ChevronRightIcon size={16} />
              </PageButton>
            </footer>
          </Panel>
        </>
      )}

      <InviteTrainerDialog open={inviting} onClose={() => setInviting(false)} onInvited={onInvited} />
    </>
  )
}

function PageButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-9 items-center justify-center rounded-md border border-default bg-surface text-icon enabled:hover:bg-surface-hover disabled:text-disabled focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none"
    >
      {children}
    </button>
  )
}

/** Desktop and tablet: a real table (B2.01). */
function TrainerTable({ rows, selection, actions }: { rows: Member[]; selection: Selection; actions: (m: Member) => ReactNode }) {
  const navigate = useNavigate()
  const th = 'h-8 px-3 text-left text-caption-strong font-medium text-secondary'
  return (
    <table className="w-full table-fixed border-separate border-spacing-0 max-md:hidden">
      <thead>
        <tr className="bg-surface-subtle">
          <th scope="col" className="h-8 w-10 rounded-l-sm pl-3">
            <SelectBox checked={selection.header} onChange={selection.toggleAll} label="Select all trainers on this page" />
          </th>
          <th scope="col" className={th}>
            Trainer
          </th>
          <th scope="col" className={`${th} w-[200px] max-xl:w-[160px]`}>
            Cohorts
          </th>
          <th scope="col" className={`${th} w-[230px] max-xl:hidden`}>
            Courses
          </th>
          <th scope="col" className={`${th} w-[140px] text-right whitespace-nowrap max-lg:hidden`}>
            Sessions this week
          </th>
          <th scope="col" className={`${th} w-[120px]`}>
            Status
          </th>
          <th scope="col" className="w-14 rounded-r-sm">
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((member) => (
          <tr
            key={member.id}
            onClick={() => navigate(member.id)}
            aria-selected={selection.has(member.id)}
            className={`cursor-pointer hover:bg-surface-hover [&>td]:border-b [&>td]:border-default [&>td]:px-3 [&>td]:py-2.5 last:[&>td]:border-b-0 ${selection.has(member.id) ? 'bg-brand-subtle/40' : ''}`}
          >
            <td className="!pr-0" onClick={(e) => e.stopPropagation()}>
              <SelectBox checked={selection.has(member.id)} onChange={() => selection.toggle(member.id)} label={`Select ${fullNameOf(member)}`} />
            </td>
            <td>
              <div className="flex min-w-0 items-center gap-3">
                <Avatar initials={initials(member.firstName, member.lastName)} seed={member.id} enlarge={`${member.firstName} ${member.lastName}`} />
                <div className="flex min-w-0 flex-col">
                  <Link
                    to={member.id}
                    onClick={(e) => e.stopPropagation()}
                    className="truncate text-body-strong text-primary hover:underline focus-visible:underline focus-visible:outline-none"
                  >
                    {fullNameOf(member)}
                  </Link>
                </div>
              </div>
            </td>
            <td>
              <TeachingCell items={member.teaching.cohorts} one="cohort" empty="No cohorts yet" />
            </td>
            <td className="max-xl:hidden">
              <TeachingCell items={member.teaching.courses} one="course" empty="—" />
            </td>
            <td
              className={`text-right text-body tabular-nums max-lg:hidden ${member.status === 'active' && member.sessionsThisWeek ? 'text-primary' : 'text-muted'}`}
            >
              {member.status === 'active' ? (member.sessionsThisWeek ?? 0) : '—'}
            </td>
            <td>
              <StatusBadge member={member} />
            </td>
            <td className="text-right">{actions(member)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Mobile: a list of rows that open the trainer (B2.01 Mobile). */
function TrainerList({ rows }: { rows: Member[] }) {
  return (
    <ul className="md:hidden">
      {rows.map((member) => (
        <li key={member.id} className="border-b border-default last:border-b-0">
          <Link to={member.id} className="flex items-center gap-3 py-3">
            <Avatar size={32} initials={initials(member.firstName, member.lastName)} seed={member.id} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-body-strong text-primary">{fullNameOf(member)}</span>
              <span className="truncate text-caption text-secondary">
                {member.teaching.cohorts.length ? member.teaching.cohorts.map((c) => c.name).join(' · ') : 'No cohorts yet'}
              </span>
            </span>
            <StatusBadge member={member} />
            <ChevronRightIcon size={16} className="shrink-0 text-icon-muted" />
          </Link>
        </li>
      ))}
    </ul>
  )
}

/** "2 cohorts" over "Cohort 5 · Fellowship 2" (B2.01). */
function TeachingCell({ items, one, empty }: { items: { id: string; name: string }[]; one: string; empty: string }) {
  if (items.length === 0) return <span className="text-body text-muted">{empty}</span>
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="truncate text-body-strong text-primary">
        {items.length} {items.length === 1 ? one : `${one}s`}
      </span>
      <span className="truncate text-caption text-secondary">{items.map((i) => i.name).join(' · ')}</span>
    </div>
  )
}
