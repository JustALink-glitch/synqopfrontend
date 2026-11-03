import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '@/auth/useAuth'
import { StatePanel } from '@/components/StatePanel'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { ChevronRightIcon, DownloadIcon, PlusIcon, SearchIcon, UserGroupIcon } from '@/components/ui/icons'
import { EmptyState, FilterChips, Panel } from '@/components/ui/Page'
import { Percent } from '@/components/ui/Percent'
import { FilterSelect, SearchField } from '@/components/ui/SearchField'
import { Cell, Row, Stacked, Table, TableFooter, type Column } from '@/components/ui/Table'
import { plural, relativeDay } from '@/lib/format'
import { paginate } from '@/lib/paginate'
import { initials } from '@/lib/people'
import { ParticipantsHeader } from '@/pages/admin/completion/ParticipantsHeader'
import { AddParticipantDialog } from '@/pages/admin/participants/AddParticipantDialog'
import { useParticipants, type ParticipantSummary } from '@/pages/admin/participants/data'
import { AssignmentsSummary, ParticipantBadge } from '@/pages/admin/participants/ParticipantBadge'
import { useCohorts } from '@/pages/admin/programmes/data'
import { useQueryClient } from '@tanstack/react-query'
import { Download, Mail } from 'lucide-react'
import { BulkBar, CardGrid, ItemCard, LayoutSwitch, RowActions } from '@/components/collection/Collection'
import { useLayout } from '@/components/collection/layout'
import { downloadCsv, runBulk, useSelection } from '@/components/collection/selection'
import { api, ApiError } from '@/lib/api'

type Filter = 'all' | 'on_track' | 'attention' | 'invited' | 'deferred' | 'withdrawn' | 'other'

const columns: Column[] = [
  { label: 'Participant' },
  { label: 'Cohort', width: 220 },
  { label: 'Attendance', width: 110, align: 'right', hideBelow: 'xl' },
  { label: 'Assignments', width: 130, hideBelow: 'xl' },
  { label: 'Status', width: 130 },
  { label: 'Last active', width: 130, hideBelow: 'lg' },
  { label: '', width: 56, align: 'right' },
]

/** Which status filter a participant falls under. */
function bucket(p: ParticipantSummary): Filter {
  const e = p.enrolment?.status
  if (e === 'withdrawn' || e === 'transferred') return 'withdrawn'
  if (e === 'deferred') return 'deferred'
  if (p.status === 'invited') return 'invited'
  if (e !== 'active') return 'other'
  return p.enrolment?.flags ? 'attention' : 'on_track'
}

type Notice = { tone: 'success' | 'warning'; title: string; body: string }

/** /admin/participants — B1.01 Participants, B1.01e empty, B1.01n no results. */
export function ParticipantsPage() {
  const navigate = useNavigate()
  const { state } = useAuth()
  const timeZone = state.status === 'signed-in' ? state.me.organisation?.timeZone : undefined
  const query = useParticipants()
  const cohorts = useCohorts()
  const [filter, setFilter] = useState<Filter>('all')
  const [cohortFilter, setCohortFilter] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  const all = useMemo(() => query.data?.participants ?? [], [query.data])
  const openCohorts = (cohorts.data ?? []).filter((c) => c.status === 'active' || c.status === 'upcoming' || c.status === 'draft')
  const term = search.trim().toLowerCase()
  const inCohort = all.filter((p) => !cohortFilter || p.enrolment?.cohort.id === cohortFilter)
  const visible = inCohort.filter(
    (p) => (filter === 'all' || bucket(p) === filter) && (!term || `${p.firstName} ${p.lastName}`.toLowerCase().includes(term) || p.email.includes(term)),
  )
  const paged = paginate(visible, page)
  const count = (f: Filter) => inCohort.filter((p) => bucket(p) === f).length
  const noCohorts = !cohorts.isPending && openCohorts.length === 0
  const [layout, setLayout] = useLayout('participants')
  const selection = useSelection(paged.rows.map((p) => p.id))
  const chosen = paged.rows.filter((p) => selection.has(p.id))
  const client = useQueryClient()
  const name = (p: ParticipantSummary) => `${p.firstName} ${p.lastName}`.trim()
  const resend = async (p: ParticipantSummary) => {
    if (p.status !== 'invited') throw new ApiError(409, 'already_joined', 'Already joined.')
    return api(`/v1/members/${p.id}/invitation`, { method: 'POST' })
  }
  async function resendAll(items: ParticipantSummary[]) {
    const o = await runBulk('Invitation resent', items, name, resend)
    await client.invalidateQueries({ queryKey: ['participants'] })
    return o
  }
  const rowActions = (p: ParticipantSummary) => (
    <RowActions
      label={name(p)}
      items={[
        { label: 'Open profile', onSelect: () => navigate(p.id) },
        ...(p.enrolment ? [{ label: 'Open cohort', onSelect: () => navigate(`/admin/cohorts/${p.enrolment!.cohort.id}`) }] : []),
        ...(p.status === 'invited'
          ? [
              {
                label: 'Resend invitation',
                onSelect: () =>
                  void resendAll([p]).then((o) =>
                    setNotice(
                      o.done.length
                        ? { tone: 'success', title: `Invitation sent to ${p.email}`, body: 'The new link works for 72 hours.' }
                        : { tone: 'warning', title: 'Couldn’t resend', body: o.skipped[0]?.reason ?? '' },
                    ),
                  ),
              },
            ]
          : []),
      ]}
    />
  )
  const badge = (p: ParticipantSummary) => (
    <ParticipantBadge memberStatus={p.status} invitationExpiresAt={p.invitationExpiresAt} enrolmentStatus={p.enrolment?.status} flags={p.enrolment?.flags} />
  )

  const actions = (
    <>
      <Button
        variant="secondary"
        icon={<DownloadIcon size={16} />}
        onClick={() => navigate('import')}
        disabled={noCohorts}
        title={noCohorts ? 'Create a cohort first' : undefined}
      >
        Import participants
      </Button>
      <Button icon={<PlusIcon size={16} />} onClick={() => setAdding(true)} disabled={noCohorts} title={noCohorts ? 'Create a cohort first' : undefined}>
        Add participant
      </Button>
    </>
  )

  return (
    <>
      <ParticipantsHeader actions={actions} />
      {notice && (
        <AlertBanner tone={notice.tone} title={notice.title}>
          {notice.body}
        </AlertBanner>
      )}

      {query.isPending ? (
        <Panel aria-busy="true" aria-label="Loading participants" className="h-[240px]">
          <span className="sr-only">Loading participants</span>
        </Panel>
      ) : query.isError ? (
        <Panel>
          <StatePanel
            kind="error"
            title="Couldn’t load participants"
            description="Check your connection and try again."
            action={{ label: 'Try again', onClick: () => void query.refetch() }}
          />
        </Panel>
      ) : all.length === 0 ? (
        <Panel className="py-16">
          <EmptyState
            icon={<UserGroupIcon size={24} />}
            title="No participants yet"
            body={
              noCohorts
                ? 'Every participant joins a cohort. Create a cohort first, then add people one by one or import a CSV.'
                : 'Add people one by one or import a CSV. Each person gets an email invitation to set a password.'
            }
            actions={
              noCohorts ? (
                <Button icon={<PlusIcon size={16} />} onClick={() => navigate('/admin/cohorts/new')}>
                  New cohort
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => navigate('import')}>
                  Import participants
                </Button>
              )
            }
          />
        </Panel>
      ) : (
        <>
          <div className="flex items-center gap-3 max-lg:flex-wrap max-md:flex-col max-md:items-stretch">
            <FilterChips
              label="Status"
              value={filter}
              onChange={(value) => {
                setFilter(value)
                setPage(1)
              }}
              options={[
                { value: 'all', label: 'All', count: inCohort.length },
                { value: 'on_track', label: 'On track', count: count('on_track') },
                { value: 'attention', label: 'Needs attention', count: count('attention') },
                { value: 'invited', label: 'Invited', count: count('invited') },
                ...(count('deferred') ? [{ value: 'deferred' as const, label: 'Deferred', count: count('deferred') }] : []),
                ...(count('withdrawn') ? [{ value: 'withdrawn' as const, label: 'Withdrawn', count: count('withdrawn') }] : []),
              ]}
            />
            <div className="flex-1" />
            <FilterSelect
              aria-label="Cohort"
              value={cohortFilter}
              onChange={(e) => {
                setCohortFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="">All cohorts</option>
              {(cohorts.data ?? [])
                .filter((c) => c.status !== 'archived')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </FilterSelect>
            <SearchField
              aria-label="Search participants"
              placeholder="Search by name or email"
              width={260}
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
            noun={['participant', 'participants']}
            actions={[
              {
                label: 'Export CSV',
                icon: <Download aria-hidden className="size-4" />,
                run: async () =>
                  downloadCsv(
                    'Participants.csv',
                    [
                      'First name',
                      'Last name',
                      'Email',
                      'Phone',
                      'Cohort',
                      'Programme',
                      'Enrolment',
                      'Attendance',
                      'Assignments submitted',
                      'Assignments due',
                      'Needs attention',
                      'Last active',
                    ],
                    chosen.map((p) => [
                      p.firstName,
                      p.lastName,
                      p.email,
                      p.phone,
                      p.enrolment?.cohort.name,
                      p.enrolment?.programmeName,
                      p.status === 'invited' ? 'invited' : p.enrolment?.status,
                      p.enrolment?.attendance ? `${p.enrolment.attendance.rate}%` : '',
                      p.enrolment?.assignments?.submitted,
                      p.enrolment?.assignments?.due,
                      p.enrolment?.flags ?? 0,
                      p.lastSignInAt?.slice(0, 10),
                    ]),
                  ),
              },
              {
                label: 'Resend invitation',
                icon: <Mail aria-hidden className="size-4" />,
                confirm: {
                  title: 'Resend invitations?',
                  body: `A new 72-hour link goes to each ticked person who hasn’t joined yet. ${plural(chosen.filter((p) => p.status !== 'invited').length, 'person has', 'people have')} already joined and will be skipped.`,
                  button: 'Resend',
                },
                run: () => resendAll(chosen),
              },
            ]}
          />

          <Panel className="gap-0 max-md:py-2">
            {visible.length === 0 ? (
              <div role="status" className="flex flex-col items-center gap-3 p-8 text-center">
                <span className="flex size-12 items-center justify-center rounded-lg bg-brand-subtle text-icon-brand">
                  <SearchIcon size={24} />
                </span>
                <h2 className="text-heading-section text-primary">{term ? `No participants match “${search.trim()}”` : 'No participants here'}</h2>
                <p className="text-body text-secondary">Check the spelling, or clear filters to search all cohorts.</p>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch('')
                    setFilter('all')
                    setCohortFilter('')
                  }}
                >
                  Clear search
                </Button>
              </div>
            ) : layout === 'grid' ? (
              <div className="py-2">
                <CardGrid label="Participants">
                  {paged.rows.map((p) => (
                    <ItemCard
                      key={p.id}
                      to={p.id}
                      title={name(p)}
                      subtitle={p.email}
                      leading={<Avatar size={40} initials={initials(p.firstName, p.lastName)} seed={p.id} />}
                      badge={badge(p)}
                      select={{ checked: selection.has(p.id), onChange: () => selection.toggle(p.id) }}
                      actions={rowActions(p)}
                      facts={[
                        { label: 'Cohort', value: p.enrolment?.cohort.name ?? 'No cohort' },
                        { label: 'Attendance', value: <Percent value={p.enrolment?.attendance?.rate} /> },
                        { label: 'Assignments', value: <AssignmentsSummary value={p.enrolment?.assignments} /> },
                        { label: 'Last active', value: p.lastSignInAt ? relativeDay(p.lastSignInAt, timeZone) : 'Not signed in' },
                      ]}
                    />
                  ))}
                </CardGrid>
              </div>
            ) : (
              <>
                <div className="max-md:hidden">
                  <Table columns={columns} select={{ checked: selection.header, onChange: selection.toggleAll, label: 'Select all participants on this page' }}>
                    {paged.rows.map((p) => (
                      <Row key={p.id} to={p.id} select={{ checked: selection.has(p.id), onChange: () => selection.toggle(p.id), label: `Select ${name(p)}` }}>
                        <Cell>
                          <span className="flex min-w-0 items-center gap-3">
                            <Avatar initials={initials(p.firstName, p.lastName)} seed={p.id} />
                            <Stacked
                              primary={
                                <Link
                                  to={p.id}
                                  onClick={(e) => e.stopPropagation()}
                                  className="hover:underline focus-visible:underline focus-visible:outline-none"
                                >
                                  {p.firstName} {p.lastName}
                                </Link>
                              }
                            />
                          </span>
                        </Cell>
                        <Cell>
                          {p.enrolment ? (
                            <Stacked primary={p.enrolment.cohort.name} secondary={p.enrolment.programmeName} />
                          ) : (
                            <span className="text-muted">No cohort</span>
                          )}
                        </Cell>
                        <Cell align="right" hideBelow="xl">
                          <Percent value={p.enrolment?.attendance?.rate} />
                        </Cell>
                        <Cell hideBelow="xl">
                          <AssignmentsSummary value={p.enrolment?.assignments} />
                        </Cell>
                        <Cell>
                          <ParticipantBadge
                            memberStatus={p.status}
                            invitationExpiresAt={p.invitationExpiresAt}
                            enrolmentStatus={p.enrolment?.status}
                            flags={p.enrolment?.flags}
                          />
                        </Cell>
                        <Cell hideBelow="lg" className={p.lastSignInAt ? undefined : 'text-muted'}>
                          {p.lastSignInAt ? relativeDay(p.lastSignInAt, timeZone) : 'Not signed in'}
                        </Cell>
                        <Cell align="right">{rowActions(p)}</Cell>
                      </Row>
                    ))}
                  </Table>
                </div>
                <ul className="md:hidden">
                  {paged.rows.map((p) => (
                    <li key={p.id} className="border-b border-default last:border-b-0">
                      <Link to={p.id} className="flex items-center gap-3 py-3">
                        <Avatar size={32} initials={initials(p.firstName, p.lastName)} seed={p.id} />
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="truncate text-body-strong text-primary">
                            {p.firstName} {p.lastName}
                          </span>
                          <span className="truncate text-caption text-secondary">{p.enrolment?.cohort.name ?? p.email}</span>
                        </span>
                        <ParticipantBadge
                          memberStatus={p.status}
                          invitationExpiresAt={p.invitationExpiresAt}
                          enrolmentStatus={p.enrolment?.status}
                          flags={p.enrolment?.flags}
                        />
                        <ChevronRightIcon size={16} className="shrink-0 text-icon-muted" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <TableFooter
              summary={
                visible.length > paged.rows.length
                  ? `Showing ${(paged.page - 1) * 25 + 1}–${(paged.page - 1) * 25 + paged.rows.length} of ${plural(visible.length, 'participant')}`
                  : plural(visible.length, 'participant')
              }
              page={paged.page}
              pageCount={paged.pageCount}
              onPage={setPage}
            />
          </Panel>
        </>
      )}

      <AddParticipantDialog
        open={adding}
        onClose={() => setAdding(false)}
        cohorts={openCohorts}
        defaultCohortId={cohortFilter || undefined}
        onAdded={(result) => {
          setAdding(false)
          setNotice(
            !result.invited
              ? {
                  tone: 'success',
                  title: `${result.name} was added to ${result.cohortName}`,
                  body: 'They already have a Synqop account, so no new invitation was needed.',
                }
              : result.emailSent === false
                ? { tone: 'warning', title: `${result.name} was added, but the email didn’t send`, body: 'Open their profile and choose Resend invitation.' }
                : {
                    tone: 'success',
                    title: 'Invitation sent',
                    body: `${result.name} has 72 hours to set a password from the link we emailed to ${result.email}.`,
                  },
          )
        }}
      />
    </>
  )
}
