import { useState, type FormEvent } from 'react'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Choice'
import { Dialog } from '@/components/ui/Dialog'
import { SelectField, TextField } from '@/components/ui/TextField'
import { ApiError } from '@/lib/api'
import { useCohort, useCohorts } from '@/pages/admin/programmes/data'
import { useProgrammeSetup } from '@/pages/admin/settings/data'
import { fullNameOf, useAssignTrainer, useDeactivateMember, useEditMember, type Assignment, type MemberDetail } from './members'

const failure = (e: unknown) => (e instanceof ApiError && e.status < 500 ? e.message : 'That didn’t work. Check your connection and try again.')
const fieldErrors = (e: unknown) =>
  e instanceof ApiError && Array.isArray(e.details)
    ? Object.fromEntries((e.details as { field: string; message: string }[]).map((d) => [d.field, d.message]))
    : null

function Radio({ name, checked, onChange, children }: { name: string; checked: boolean; onChange: () => void; children: React.ReactNode }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-body text-primary">
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="size-4 shrink-0 cursor-pointer appearance-none rounded-full border border-strong bg-surface checked:border-[5px] checked:border-brand focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none"
      />
      {children}
    </label>
  )
}

/** B2.04 Assign trainer to a course in a cohort. */
export function AssignDialog({ member, onClose, onDone }: { member: MemberDetail; onClose: () => void; onDone: (message: string) => void }) {
  const cohorts = useCohorts()
  const setup = useProgrammeSetup().data?.settings
  // "Assign trainers: to the whole cohort" in Programme setup: no course to pick.
  const wholeCohort = setup?.trainerAssignment === 'cohort'
  const assistantsOn = setup?.assistantsEnabled ?? true
  const open = (cohorts.data ?? []).filter((c) => c.status === 'active' || c.status === 'upcoming' || c.status === 'draft')
  const [cohortId, setCohortId] = useState('')
  const cohort = useCohort(cohortId)
  const [courseId, setCourseId] = useState('')
  const [role, setRole] = useState<'lead' | 'assistant'>(member.role === 'assistant_trainer' ? 'assistant' : 'lead')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const assign = useAssignTrainer(member.id)
  const course = cohort.data?.courses.find((c) => c.courseId === courseId)
  const lead = course?.trainers.find((t) => t.isLead && t.status !== 'deactivated')
  const already = course?.trainers.find((t) => t.id === member.id)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (!cohortId) next.cohortId = 'Choose a cohort.'
    if (!courseId && !wholeCohort) next.courseId = 'Choose a course.'
    setErrors(next)
    setError(null)
    if (Object.keys(next).length) return
    try {
      const r = await assign.mutateAsync({ cohortId, ...(!wholeCohort && { courseId }), role })
      onDone(
        `${member.firstName} now ${role === 'lead' ? 'leads' : 'assists on'} ${r.course} in ${r.cohort}${r.replaced ? `. ${r.replaced} is now an assistant.` : '.'}`,
      )
    } catch (e) {
      const fields = fieldErrors(e)
      if (fields) setErrors(fields)
      else setError(failure(e))
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={wholeCohort ? `Assign ${fullNameOf(member)} to a cohort` : `Assign ${fullNameOf(member)} to a course`}
      description={
        wholeCohort
          ? `${member.firstName} will teach every course in the cohort, and see its sessions, participants and assignments.`
          : `${member.firstName} will see the course’s sessions, participants and assignments in that cohort.`
      }
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="assign-trainer" disabled={assign.isPending}>
            {assign.isPending ? 'Assigning…' : 'Assign'}
          </Button>
        </>
      }
    >
      <form id="assign-trainer" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {error && <AlertBanner tone="error" title={error} />}
        <SelectField
          label="Cohort"
          value={cohortId}
          onChange={(e) => {
            setCohortId(e.target.value)
            setCourseId('')
            setErrors({})
          }}
          error={errors.cohortId}
          helper={open.length === 0 && !cohorts.isPending ? 'There are no active or upcoming cohorts.' : undefined}
        >
          <option value="">Choose a cohort</option>
          {open.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
        {!wholeCohort && (
          <SelectField
            label="Course"
            value={courseId}
            disabled={!cohortId || cohort.isPending}
            onChange={(e) => {
              setCourseId(e.target.value)
              setErrors({})
            }}
            error={errors.courseId}
            helper="Courses this cohort runs."
          >
            <option value="">{cohortId && cohort.isPending ? 'Loading…' : 'Choose a course'}</option>
            {(cohort.data?.courses ?? []).map((c) => (
              <option key={c.courseId} value={c.courseId}>
                {c.name}
              </option>
            ))}
          </SelectField>
        )}
        {assistantsOn && (
          <fieldset className="flex flex-col gap-2.5">
            <legend className="pb-1 text-caption-strong text-primary">Role</legend>
            <Radio name="assign-role" checked={role === 'lead'} onChange={() => setRole('lead')}>
              Lead — takes attendance, submits session reports
            </Radio>
            <Radio name="assign-role" checked={role === 'assistant'} onChange={() => setRole('assistant')}>
              Assistant — can do what Programme setup allows
            </Radio>
          </fieldset>
        )}
        {course &&
          (already ? (
            <AlertBanner title={`${member.firstName} already ${already.isLead ? 'leads' : 'assists on'} this course here`}>
              Saving changes their role to the one chosen above.
            </AlertBanner>
          ) : role === 'lead' && lead ? (
            <AlertBanner tone="warning" title={`${lead.firstName} ${lead.lastName} leads this course now`}>
              {member.firstName} becomes the lead and {lead.firstName} stays on as an assistant.
            </AlertBanner>
          ) : role === 'lead' ? (
            <AlertBanner title={`This course has no lead trainer in ${cohort.data?.cohort.name} yet`}>
              Trainers are assigned per course in your organisation.
            </AlertBanner>
          ) : null)}
      </form>
    </Dialog>
  )
}

/** B2.05 Edit trainer details. Also used for admins in Settings › Members (pilot feedback, Nov 2026). */
export function EditDialog({
  member,
  onClose,
  onDone,
  emailLocked,
}: {
  member: MemberDetail
  onClose: () => void
  onDone: (message: string) => void
  /** Why the email can't be changed here, e.g. only the owner can change another admin's sign-in email. */
  emailLocked?: string
}) {
  const edit = useEditMember(member.id)
  const [fullName, setFullName] = useState(fullNameOf(member))
  const [email, setEmail] = useState(member.email)
  const [phone, setPhone] = useState(member.phone ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (!fullName.trim().includes(' ')) next.fullName = 'Enter their first and last name.'
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = 'Enter an email address, e.g. name@organisation.org.'
    if (phone.trim() && !/^\+?[\d\s()-]{7,}$/.test(phone.trim())) next.phone = 'Enter a phone number, e.g. +234 806 555 0121.'
    setErrors(next)
    setError(null)
    if (Object.keys(next).length) return
    try {
      await edit.mutateAsync({ fullName: fullName.trim(), email: email.trim().toLowerCase(), phone: phone.trim() || null })
      onDone(email.trim().toLowerCase() !== member.email ? `Details saved. We emailed ${email.trim()} to say the sign-in email changed.` : 'Details saved')
    } catch (e) {
      const fields = fieldErrors(e)
      if (fields) setErrors(fields)
      else setError(failure(e))
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Edit ${member.firstName}’s details`}
      description={
        member.role === 'admin' ? 'Their access stays as it is. To change it, use Change role.' : 'Their courses, sessions and reports stay as they are.'
      }
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="edit-trainer" disabled={edit.isPending}>
            {edit.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form id="edit-trainer" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {error && <AlertBanner tone="error" title={error} />}
        <TextField label="Full name" value={fullName} maxLength={160} onChange={(e) => setFullName(e.target.value)} error={errors.fullName} />
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={Boolean(emailLocked)}
          error={errors.email}
          helper={
            emailLocked ??
            (member.status === 'active' ? 'Their sign-in email. If you change it, we email the new address to let them know.' : 'Where their invitation goes.')
          }
        />
        <TextField label="Phone" optional type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} />
        {(member.role === 'trainer' || member.role === 'assistant_trainer') && (
          <p className="text-caption text-secondary">To change which courses {member.firstName} teaches or their role in them, use Assign to course.</p>
        )}
      </form>
    </Dialog>
  )
}

/** B2.06 Deactivate trainer. */
export function DeactivateDialog({
  member,
  assignments,
  onClose,
  onDone,
}: {
  member: MemberDetail
  assignments: Assignment[]
  onClose: () => void
  onDone: (message: string) => void
}) {
  const deactivate = useDeactivateMember(member.id)
  const [notify, setNotify] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const leading = assignments.filter((a) => a.lead && a.nextSessionAt)

  return (
    <Dialog
      open
      onClose={onClose}
      width={440}
      title={`Deactivate ${fullNameOf(member)}?`}
      description={`${member.firstName} won’t be able to sign in. Their past sessions, attendance, reports and grades stay on record. You can reactivate them later.`}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={deactivate.isPending}
            onClick={async () => {
              setError(null)
              try {
                await deactivate.mutateAsync(notify)
                onDone(`${fullNameOf(member)} was deactivated`)
              } catch (e) {
                setError(failure(e))
              }
            }}
          >
            {deactivate.isPending ? 'Deactivating…' : 'Deactivate trainer'}
          </Button>
        </>
      }
    >
      {leading.length > 0 && (
        <AlertBanner
          tone="warning"
          title={`${member.firstName} leads ${leading.length === 1 ? '1 course' : `${leading.length} courses`} with sessions coming up`}
        >
          {leading.map((a) => `${a.course.name} (${a.cohort.name})`).join(' and ')}. Assign a new lead first, or these sessions will show “No trainer”.
        </AlertBanner>
      )}
      <Checkbox label={`Email ${member.firstName} to let them know`} checked={notify} onChange={(e) => setNotify(e.target.checked)} />
      {error && <p className="text-caption text-error-fg">{error}</p>}
    </Dialog>
  )
}
