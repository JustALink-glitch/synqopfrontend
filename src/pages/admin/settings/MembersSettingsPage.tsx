import { useState, type FormEvent } from 'react'
import { useAuth } from '@/auth/useAuth'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { MailIcon, PlusIcon } from '@/components/ui/icons'
import { Menu } from '@/components/ui/Menu'
import { Badge, Panel, PanelHeader } from '@/components/ui/Page'
import { Cell, Row, Table } from '@/components/ui/Table'
import { TextField } from '@/components/ui/TextField'
import { api, ApiError } from '@/lib/api'
import { checkPassword } from '@/lib/password-check'
import { plural, relativeDay } from '@/lib/format'
import { initials, roleLabel, splitFullName } from '@/lib/people'
import type { Role } from '@/lib/roles'
import {
  fullNameOf,
  invitationExpired,
  useChangeRole,
  useInvitationAction,
  useInviteMember,
  useMember,
  useRemoveMember,
  useStaff,
  type StaffMember,
} from '@/pages/admin/people/members'
import { EditDialog } from '@/pages/admin/people/TrainerDialogs'
import { RadioList, SettingsLoader } from './SettingsBits'
import { SettingsTitle } from './SettingsLayout'
import type { Notice } from './settingsForm'

type StaffRole = 'admin' | 'trainer' | 'assistant_trainer'

const roleHelp: Record<StaffRole, string> = {
  admin: 'full access to programmes, people and settings',
  trainer: 'only the cohorts you assign',
  assistant_trainer: 'helps a lead trainer, within what Programme setup allows',
}

const roles: { role: string; text: string }[] = [
  { role: 'Owner', text: 'Everything an Admin can do, plus the plan, billing and transferring ownership.' },
  { role: 'Admin', text: 'Runs programmes, people, reports and settings. Programme managers use this role.' },
  { role: 'Trainer', text: 'Delivers assigned cohorts and courses: sessions, attendance, assignments, grading and session reports.' },
  { role: 'Participant', text: 'Completes training. Managed under Participants, not here.' },
]

type Open = { kind: 'invite' } | { kind: 'role' | 'remove' | 'cancel' | 'edit' | 'transfer'; member: StaffMember } | null

/** /admin/settings/members — F1.02 Members & roles, with Invite (F1.02a), Change role (F1.02b) and Remove (F1.02c). */
export function MembersSettingsPage() {
  const query = useStaff()
  const auth = useAuth()
  const isOwner = auth.state.status === 'signed-in' && auth.state.me.membership.role === 'owner'
  const [open, setOpen] = useState<Open>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const invitation = useInvitationAction()

  const done = (n: Notice) => {
    setOpen(null)
    setNotice(n)
  }

  async function resend(member: StaffMember) {
    setNotice(null)
    try {
      const result = (await invitation.mutateAsync({ id: member.id, action: 'resend' })) as { emailSent?: boolean }
      setNotice(
        result.emailSent === false
          ? { tone: 'warning', title: 'The new link was made, but the email didn’t send', body: 'Try again in a minute.' }
          : { tone: 'success', title: `New invitation sent to ${member.email}`, body: 'The old link no longer works.' },
      )
    } catch {
      setNotice({ tone: 'error', title: 'The invitation wasn’t sent. Try again.' })
    }
  }

  return (
    <>
      <SettingsTitle
        title="Members & roles"
        description={
          isOwner
            ? 'Staff who can sign in. Participants are managed under Participants. To hand over ownership, choose Edit › Transfer ownership on an admin.'
            : 'Staff who can sign in. Participants are managed under Participants.'
        }
        action={
          <Button
            onClick={() => {
              setNotice(null)
              setOpen({ kind: 'invite' })
            }}
            className="max-md:w-full"
          >
            <PlusIcon size={16} />
            Invite member
          </Button>
        }
      />
      {notice && (
        <AlertBanner tone={notice.tone} title={notice.title}>
          {notice.body}
        </AlertBanner>
      )}
      <SettingsLoader query={query}>
        {(members) => <MembersTable members={members} onOpen={(o) => (setNotice(null), setOpen(o))} onResend={resend} />}
      </SettingsLoader>
      <Panel aria-labelledby="roles-title" className="gap-0">
        <PanelHeader id="roles-title" title="Roles" description="What each role can do." />
        <dl className="mt-2 flex flex-col">
          {roles.map((r) => (
            <div key={r.role} className="flex gap-4 border-b border-default py-3 text-body max-md:flex-col max-md:gap-1">
              <dt className="w-[134px] shrink-0 text-secondary">{r.role}</dt>
              <dd className="text-primary">{r.text}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <InviteDialog open={open?.kind === 'invite'} onClose={() => setOpen(null)} onDone={done} />
      {open && open.kind === 'role' && <RoleDialog member={open.member} onClose={() => setOpen(null)} onDone={done} />}
      {open && open.kind === 'edit' && <EditMemberDialog member={open.member} onClose={() => setOpen(null)} onDone={done} />}
      {open && open.kind === 'transfer' && <TransferDialog member={open.member} onClose={() => setOpen(null)} onDone={done} />}
      {open && (open.kind === 'remove' || open.kind === 'cancel') && <RemoveDialog member={open.member} onClose={() => setOpen(null)} onDone={done} />}
    </>
  )
}

function MembersTable({ members, onOpen, onResend }: { members: StaffMember[]; onOpen: (open: Open) => void; onResend: (m: StaffMember) => void }) {
  const { state } = useAuth()
  const me = state.status === 'signed-in' ? state.me : null
  const timeZone = me?.organisation?.timeZone
  const pending = members.filter((m) => m.status === 'invited').length
  const sorted = [...members].sort((a, b) => rank(a) - rank(b) || fullNameOf(a).localeCompare(fullNameOf(b)))

  const actions = (m: StaffMember) => {
    if (m.role === 'owner' || m.id === me?.membership.id) return null
    const items =
      m.status === 'invited'
        ? [
            { label: 'Edit details', onSelect: () => onOpen({ kind: 'edit', member: m }) },
            { label: 'Resend invitation', onSelect: () => onResend(m) },
            { label: 'Cancel invitation', onSelect: () => onOpen({ kind: 'cancel', member: m }), destructive: true },
          ]
        : [
            { label: 'Edit details', onSelect: () => onOpen({ kind: 'edit', member: m }) },
            { label: 'Change role', onSelect: () => onOpen({ kind: 'role', member: m }) },
            ...(me?.membership.role === 'owner' && m.role === 'admin' && m.status === 'active'
              ? [{ label: 'Transfer ownership', onSelect: () => onOpen({ kind: 'transfer', member: m }) }]
              : []),
            { label: 'Remove member', onSelect: () => onOpen({ kind: 'remove', member: m }), destructive: true },
          ]
    return <Menu variant="link" label="Edit" accessibleLabel={`Edit ${fullNameOf(m)}`} items={items} />
  }

  const status = (m: StaffMember) =>
    m.status === 'active' ? (
      <Badge tone="success">Active</Badge>
    ) : (
      <Badge tone={invitationExpired(m) ? 'warning' : 'neutral'}>{invitationExpired(m) ? 'Expired' : 'Invited'}</Badge>
    )

  return (
    <Panel aria-labelledby="members-title" className="gap-3">
      <PanelHeader
        id="members-title"
        title="Members"
        description={`${plural(members.length, 'person', 'people')}${pending ? ` · ${plural(pending, 'invitation')} pending` : ''}`}
      />
      <div className="max-md:hidden">
        <Table
          columns={[
            { label: 'Member' },
            { label: 'Role', width: 150 },
            { label: 'Status', width: 120 },
            { label: 'Last active', width: 130 },
            { label: '', width: 72 },
          ]}
        >
          {sorted.map((m) => (
            <Row key={m.id}>
              <Cell>
                <span className="flex min-w-0 items-center gap-2.5">
                  <Avatar initials={initials(m.firstName, m.lastName)} seed={m.id} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-body-strong text-primary">{fullNameOf(m)}</span>
                    {m.status === 'invited' && <span className="truncate text-caption text-secondary">{m.email}</span>}
                  </span>
                </span>
              </Cell>
              <Cell>{roleLabel[m.role]}</Cell>
              <Cell>{status(m)}</Cell>
              <Cell className="text-secondary">{m.lastActiveAt ? relativeDay(m.lastActiveAt, timeZone) : '—'}</Cell>
              <Cell align="right">{actions(m)}</Cell>
            </Row>
          ))}
        </Table>
      </div>
      <ul className="flex flex-col md:hidden">
        {sorted.map((m) => (
          <li key={m.id} className="flex items-center gap-3 border-b border-default py-3 last:border-b-0">
            <Avatar size={32} initials={initials(m.firstName, m.lastName)} seed={m.id} />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate text-body-strong text-primary">{fullNameOf(m)}</span>
              <span className="flex flex-wrap items-center gap-2 text-caption text-secondary">
                {roleLabel[m.role]}
                {status(m)}
              </span>
            </div>
            {actions(m)}
          </li>
        ))}
      </ul>
    </Panel>
  )
}

const rank = (m: StaffMember) => ({ owner: 0, admin: 1, trainer: 2, assistant_trainer: 3, participant: 4 })[m.role]

const failure = (error: unknown) => (error instanceof ApiError && error.status < 500 ? error.message : 'That didn’t work. Check your connection and try again.')

function InviteDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (n: Notice) => void }) {
  const invite = useInviteMember()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'trainer'>('admin')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const close = () => {
    setFullName('')
    setEmail('')
    setRole('admin')
    setErrors({})
    invite.reset()
    onClose()
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const name = splitFullName(fullName)
    const errs: Record<string, string> = {}
    if (!name.firstName) errs.fullName = 'Enter their full name.'
    else if (!name.lastName) errs.fullName = 'Enter their first and last name.'
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) errs.email = 'Enter an email address, e.g. name@organisation.org.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    try {
      const result = await invite.mutateAsync({ email: email.trim(), ...name, role })
      close()
      onDone(
        result.emailSent
          ? {
              tone: 'success',
              title: 'Invitation sent',
              body: `${result.member.firstName} has 72 hours to set a password from the link we emailed to ${result.member.email}.`,
            }
          : { tone: 'warning', title: `${result.member.firstName} was added, but the email didn’t send`, body: 'Choose Edit › Resend invitation.' },
      )
    } catch (error) {
      if (error instanceof ApiError && error.code === 'email_in_use') setErrors({ email: error.message })
      else if (error instanceof ApiError && Array.isArray(error.details))
        setErrors(
          Object.fromEntries(
            (error.details as { field: string; message: string }[]).map((d) => [
              d.field === 'firstName' || d.field === 'lastName' ? 'fullName' : d.field,
              d.message,
            ]),
          ),
        )
      else setErrors({ form: failure(error) })
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Invite a member"
      description="They get an email with a one-time link to set their password. The link expires after 72 hours."
      actions={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" form="invite-member" disabled={invite.isPending}>
            <MailIcon size={16} />
            {invite.isPending ? 'Sending…' : 'Send invitation'}
          </Button>
        </>
      }
    >
      <form id="invite-member" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <TextField
          label="Full name"
          autoComplete="off"
          value={fullName}
          maxLength={160}
          onChange={(e) => setFullName(e.target.value)}
          error={errors.fullName}
        />
        <TextField label="Work email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <RoleChoice value={role} onChange={(r) => setRole(r as 'admin' | 'trainer')} options={['admin', 'trainer']} />
        {errors.form && <p className="text-caption text-error-fg">{errors.form}</p>}
      </form>
    </Dialog>
  )
}

function RoleChoice({ value, onChange, options }: { value: StaffRole; onChange: (r: StaffRole) => void; options: StaffRole[] }) {
  return (
    <div className="[&>fieldset]:border-0 [&>fieldset]:py-0">
      <RadioList label="Role" value={value} onChange={onChange} options={options.map((r) => ({ value: r, label: `${roleLabel[r]} — ${roleHelp[r]}` }))} />
    </div>
  )
}

function RoleDialog({ member, onClose, onDone }: { member: StaffMember; onClose: () => void; onDone: (n: Notice) => void }) {
  const change = useChangeRole()
  const current = member.role as StaffRole
  const [role, setRole] = useState<StaffRole>(current)
  const [error, setError] = useState<string | null>(null)
  const options: StaffRole[] = current === 'assistant_trainer' ? ['admin', 'trainer', 'assistant_trainer'] : ['admin', 'trainer']
  const losing = current === 'admin' && role !== 'admin'

  async function submit() {
    if (role === current) return onClose()
    try {
      await change.mutateAsync({ id: member.id, role: role as Role })
      onDone({
        tone: 'success',
        title: `${fullNameOf(member)} is now ${role === 'admin' ? 'an Admin' : `a ${roleLabel[role]}`}`,
        body: 'It applies the next time they load a page.',
      })
    } catch (e) {
      setError(failure(e))
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      width={440}
      title={`Change ${member.firstName} ${member.lastName}’s role`}
      description="Changes apply the next time they load a page."
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={change.isPending || role === current}>
            {change.isPending ? 'Changing…' : 'Change role'}
          </Button>
        </>
      }
    >
      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">Role</legend>
        {options.map((r) => (
          <label key={r} className="inline-flex cursor-pointer items-center gap-2 text-body text-primary">
            <input
              type="radio"
              name="member-role"
              checked={role === r}
              onChange={() => setRole(r)}
              className="size-4 shrink-0 cursor-pointer appearance-none rounded-full border border-strong bg-surface checked:border-[5px] checked:border-brand focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none"
            />
            {roleLabel[r]}
          </label>
        ))}
      </fieldset>
      {losing && (
        <AlertBanner tone="warning" title={`${member.firstName} will lose access to settings and reports`}>
          As a {roleLabel[role]} they only see cohorts you assign. Their past interventions and reports stay in the record.
        </AlertBanner>
      )}
      {error && <p className="text-caption text-error-fg">{error}</p>}
    </Dialog>
  )
}

function RemoveDialog({ member, onClose, onDone }: { member: StaffMember; onClose: () => void; onDone: (n: Notice) => void }) {
  const { state } = useAuth()
  const organisation = state.status === 'signed-in' ? state.me.organisation?.name : null
  const remove = useRemoveMember()
  const invitation = useInvitationAction()
  const invited = member.status === 'invited'
  const [error, setError] = useState<string | null>(null)
  const name = fullNameOf(member)
  const teaching = member.teaching.cohorts.length

  async function submit() {
    try {
      if (invited) await invitation.mutateAsync({ id: member.id, action: 'cancel' })
      else await remove.mutateAsync(member.id)
      onDone(
        invited
          ? { tone: 'success', title: `Invitation to ${name} cancelled`, body: 'The link no longer works.' }
          : { tone: 'success', title: `${name} was removed`, body: 'They can no longer sign in.' },
      )
    } catch (e) {
      setError(failure(e))
    }
  }

  const pending = remove.isPending || invitation.isPending
  return (
    <Dialog
      open
      onClose={onClose}
      width={440}
      title={invited ? `Cancel ${name}’s invitation?` : `Remove ${name}?`}
      description={
        invited
          ? 'The link we emailed stops working. You can invite them again later.'
          : `They can no longer sign in to ${organisation ?? 'your organisation'}. Interventions, attendance edits and reports they made stay in the record with their name.`
      }
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            {invited ? 'Keep invitation' : 'Cancel'}
          </Button>
          <Button variant="destructive" onClick={submit} disabled={pending}>
            {pending ? 'Working…' : invited ? 'Cancel invitation' : 'Remove member'}
          </Button>
        </>
      }
    >
      {!invited && (
        <div className="flex flex-col gap-2 text-body text-secondary">
          {teaching > 0 && <p>They’ll also come off the {plural(teaching, 'cohort')} they teach. Assign someone else from each cohort’s Courses tab.</p>}
          <p>To give access again, invite them with the same email.</p>
        </div>
      )}
      {error && <p className="text-caption text-error-fg">{error}</p>}
    </Dialog>
  )
}

/** Edit another member's name, email and phone (pilot feedback, Nov 2026). Loads their full details first. */
function EditMemberDialog({ member, onClose, onDone }: { member: StaffMember; onClose: () => void; onDone: (notice: Notice) => void }) {
  const { state } = useAuth()
  const owner = state.status === 'signed-in' && state.me.membership.role === 'owner'
  const detail = useMember(member.id)
  if (!detail.data) return null
  return (
    <EditDialog
      member={detail.data.member}
      onClose={onClose}
      onDone={(title) => onDone({ tone: 'success', title })}
      emailLocked={member.role === 'admin' && !owner ? 'Only the owner can change another admin’s sign-in email.' : undefined}
    />
  )
}

/** Ownership transfer (pilot feedback, Nov 2026): the owner hands over to an active admin, after entering their password. */
function TransferDialog({ member, onClose, onDone }: { member: StaffMember; onClose: () => void; onDone: (notice: Notice) => void }) {
  const { state, refresh } = useAuth()
  const me = state.status === 'signed-in' ? state.me : null
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const name = fullNameOf(member)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setFailed(null)
    if (!password) return setError('Enter your password.')
    setBusy(true)
    try {
      if (!(await checkPassword(me?.user.email ?? '', password))) {
        setError('That password isn’t right.')
        return
      }
      await api(`/v1/members/${member.id}/transfer-ownership`, { method: 'POST', body: {} })
      await refresh()
      onDone({ tone: 'success', title: `${name} is now the owner`, body: 'You’re an admin now. We emailed you both.' })
    } catch (e) {
      setFailed(e instanceof ApiError && e.status < 500 ? e.message : 'Ownership wasn’t transferred. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onClose={() => !busy && onClose()}
      width={440}
      title={`Make ${name} the owner?`}
      description={`${member.firstName} gets full control: billing, data export and deletion, and every member. You become an admin. Only ${member.firstName} can give ownership back.`}
      actions={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="transfer-ownership" variant="destructive" disabled={busy}>
            {busy ? 'Transferring…' : 'Transfer ownership'}
          </Button>
        </>
      }
    >
      <form id="transfer-ownership" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {failed && <AlertBanner tone="error" title={failed} />}
        <TextField
          label="Your password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => (setPassword(e.target.value), setError(null))}
          error={error}
          helper="We ask again because this changes who controls your organisation."
        />
      </form>
    </Dialog>
  )
}
