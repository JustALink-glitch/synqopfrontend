import { useState, type FormEvent, type ReactNode } from 'react'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Choice'
import { Dialog } from '@/components/ui/Dialog'
import { DetailList } from '@/components/ui/FormLayout'
import { SelectField, TextAreaField, TextField } from '@/components/ui/TextField'
import { ApiError } from '@/lib/api'
import { todayIn } from '@/lib/format'
import { useCohort, useCohorts } from '@/pages/admin/programmes/data'
import { validateEmail, validateFullName } from '@/pages/onboarding/validation'
import { DEFER_REASONS, WITHDRAW_REASONS, useChangeEnrolment, useEditParticipant, type Enrolment, type ParticipantDetail } from './data'

type Person = ParticipantDetail['participant']

const errorMessage = (error: unknown, fallback: string) => (error instanceof ApiError && error.status < 500 ? error.message : fallback)

/** B1.06 Edit participant details. */
export function EditParticipantDialog({
  open,
  onClose,
  person,
  current,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  person: Person
  current: Enrolment | undefined
  onSaved: (message: string) => void
}) {
  const edit = useEditParticipant(person.id)
  const [fullName, setFullName] = useState(`${person.firstName} ${person.lastName}`.trim())
  const [email, setEmail] = useState(person.email)
  const [phone, setPhone] = useState(person.phone ?? '')
  const [errors, setErrors] = useState<{ fullName?: string; email?: string }>({})
  const [failed, setFailed] = useState<string | null>(null)
  const joined = person.status !== 'invited'

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const next = { fullName: validateFullName(fullName, 'their'), email: validateEmail(email) }
    setErrors(next)
    setFailed(null)
    if (next.fullName || next.email) return
    try {
      const result = await edit.mutateAsync({ fullName, email: email.trim().toLowerCase(), phone })
      onSaved(result.emailSent ? `Saved. A new invitation link went to ${email.trim().toLowerCase()}; the old one no longer works.` : 'Details saved.')
    } catch (error) {
      if (error instanceof ApiError && (error.details as { field?: string } | undefined)?.field === 'email') setErrors({ email: error.message })
      else setFailed(errorMessage(error, 'Your changes weren’t saved. Try again.'))
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => !edit.isPending && onClose()}
      title={`Edit ${person.firstName}’s details`}
      description={`Changes show everywhere ${person.firstName} appears. Their attendance, grades and history stay as they are.`}
      actions={
        <>
          <Button variant="secondary" onClick={onClose} disabled={edit.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="edit-participant" disabled={edit.isPending}>
            {edit.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form id="edit-participant" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {failed && (
          <AlertBanner tone="error" title="Couldn’t save">
            {failed}
          </AlertBanner>
        )}
        <TextField label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} error={errors.fullName} />
        <TextField
          label="Email"
          type="email"
          value={email}
          disabled={joined}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          helper={
            joined
              ? `${person.firstName} signs in with this email, so it can’t be changed here yet.`
              : 'Used to sign in. Changing it sends a new invitation link to the new address.'
          }
        />
        <TextField label="Phone" optional type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        {current && (
          <TextField
            label="Cohort"
            value={current.cohort.name}
            disabled
            readOnly
            helper={`To move ${person.firstName} to another cohort, use Transfer on their profile.`}
          />
        )}
      </form>
    </Dialog>
  )
}

function ChangeDialog({
  open,
  onClose,
  title,
  description,
  submitLabel,
  destructive,
  pending,
  failed,
  onSubmit,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  description: string
  submitLabel: string
  destructive?: boolean
  pending: boolean
  failed: string | null
  onSubmit: (event: FormEvent) => void
  children: ReactNode
}) {
  return (
    <Dialog
      open={open}
      onClose={() => !pending && onClose()}
      title={title}
      description={description}
      actions={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="enrolment-change" variant={destructive ? 'destructive' : 'primary'} disabled={pending}>
            {pending ? 'Saving…' : submitLabel}
          </Button>
        </>
      }
    >
      <form id="enrolment-change" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {failed && (
          <AlertBanner tone="error" title="Couldn’t save the change">
            {failed}
          </AlertBanner>
        )}
        {children}
      </form>
    </Dialog>
  )
}

interface ChangeProps {
  open: boolean
  onClose: () => void
  person: Person
  enrolment: Enrolment
  timeZone: string | undefined
  onDone: (message: string) => void
}

/** B1.05a Defer participant. */
export function DeferDialog({ open, onClose, person, enrolment, timeZone, onDone }: ChangeProps) {
  const change = useChangeEnrolment(person.id, enrolment.id)
  const cohorts = useCohorts()
  const later = (cohorts.data ?? []).filter(
    (c) => c.programme.id === enrolment.programme.id && c.id !== enrolment.cohort.id && (c.status === 'upcoming' || c.status === 'draft'),
  )
  const [toCohortId, setToCohortId] = useState('')
  const [effectiveOn, setEffectiveOn] = useState(todayIn(timeZone))
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [notify, setNotify] = useState(true)
  const [reasonError, setReasonError] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!reason) return setReasonError('Choose a reason.')
    setFailed(null)
    try {
      await change.mutateAsync({ kind: 'defer', toCohortId: toCohortId || null, effectiveOn, reason, note, notify })
      const target = later.find((c) => c.id === toCohortId)
      onDone(target ? `${person.firstName} is deferred and will join ${target.name}.` : `${person.firstName} is deferred from ${enrolment.cohort.name}.`)
    } catch (error) {
      setFailed(errorMessage(error, 'Nothing changed. Try again.'))
    }
  }

  return (
    <ChangeDialog
      open={open}
      onClose={onClose}
      title={`Defer ${person.firstName} ${person.lastName}`}
      description={`${person.firstName} leaves ${enrolment.cohort.name} now and keeps their attendance, grades and interventions. They can join a later cohort.`}
      submitLabel="Defer participant"
      pending={change.isPending}
      failed={failed}
      onSubmit={onSubmit}
    >
      <SelectField
        label="Join cohort"
        value={toCohortId}
        onChange={(e) => setToCohortId(e.target.value)}
        helper={
          later.length
            ? `Upcoming cohorts in ${enrolment.programme.name}. Choose “Decide later” to leave it open.`
            : `${enrolment.programme.name} has no upcoming cohorts yet, so you can decide later.`
        }
      >
        <option value="">Decide later</option>
        {later.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </SelectField>
      <TextField label="Deferred from" type="date" value={effectiveOn} onChange={(e) => setEffectiveOn(e.target.value)} />
      <SelectField
        label="Reason"
        value={reason}
        onChange={(e) => {
          setReason(e.target.value)
          setReasonError(null)
        }}
        error={reasonError}
      >
        <option value="">Select a reason</option>
        {DEFER_REASONS.map((r) => (
          <option key={r}>{r}</option>
        ))}
      </SelectField>
      <TextAreaField label="Note" optional placeholder="Add context for other admins" value={note} onChange={(e) => setNote(e.target.value)} />
      <Checkbox label={`Email ${person.firstName} about this change`} checked={notify} onChange={(e) => setNotify(e.target.checked)} />
    </ChangeDialog>
  )
}

/** B1.05b Withdraw participant. */
export function WithdrawDialog({ open, onClose, person, enrolment, timeZone, onDone }: ChangeProps) {
  const change = useChangeEnrolment(person.id, enrolment.id)
  const [effectiveOn, setEffectiveOn] = useState(todayIn(timeZone))
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [notify, setNotify] = useState(true)
  const [reasonError, setReasonError] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!reason) return setReasonError('Choose a reason.')
    setFailed(null)
    try {
      await change.mutateAsync({ kind: 'withdraw', effectiveOn, reason, note, notify })
      onDone(`${person.firstName} was withdrawn from ${enrolment.cohort.name}.`)
    } catch (error) {
      setFailed(errorMessage(error, 'Nothing changed. Try again.'))
    }
  }

  return (
    <ChangeDialog
      open={open}
      onClose={onClose}
      title={`Withdraw ${person.firstName} ${person.lastName}?`}
      description={`${person.firstName} loses access to ${enrolment.cohort.name} and stops counting towards attendance and completion. Their records stay in reports.`}
      submitLabel="Withdraw participant"
      destructive
      pending={change.isPending}
      failed={failed}
      onSubmit={onSubmit}
    >
      <TextField label="Withdrawal date" type="date" value={effectiveOn} onChange={(e) => setEffectiveOn(e.target.value)} />
      <SelectField
        label="Reason"
        value={reason}
        onChange={(e) => {
          setReason(e.target.value)
          setReasonError(null)
        }}
        error={reasonError}
      >
        <option value="">Select a reason</option>
        {WITHDRAW_REASONS.map((r) => (
          <option key={r}>{r}</option>
        ))}
      </SelectField>
      <TextAreaField label="Note" optional placeholder="Add context for other admins" value={note} onChange={(e) => setNote(e.target.value)} />
      <Checkbox label={`Email ${person.firstName} about this change`} checked={notify} onChange={(e) => setNotify(e.target.checked)} />
    </ChangeDialog>
  )
}

/** B1.05c Transfer participant. */
export function TransferDialog({ open, onClose, person, enrolment, onDone }: ChangeProps) {
  const change = useChangeEnrolment(person.id, enrolment.id)
  const cohorts = useCohorts()
  const options = (cohorts.data ?? []).filter(
    (c) => c.programme.id === enrolment.programme.id && c.id !== enrolment.cohort.id && ['active', 'upcoming', 'draft'].includes(c.status),
  )
  const [toCohortId, setToCohortId] = useState('')
  const [reason, setReason] = useState('')
  const [notify, setNotify] = useState(true)
  const [targetError, setTargetError] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const target = useCohort(toCohortId)
  const currentCohort = useCohort(enrolment.cohort.id)

  const common = (() => {
    if (!target.data || !currentCohort.data) return null
    const mine = new Set(currentCohort.data.courses.map((c) => c.courseId))
    return target.data.courses.filter((c) => mine.has(c.courseId)).map((c) => c.name)
  })()
  const trainersThere = target.data ? [...new Set(target.data.courses.flatMap((c) => c.trainers.map((t) => `${t.firstName} ${t.lastName}`)))] : []

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!toCohortId) return setTargetError('Choose a cohort.')
    setFailed(null)
    try {
      await change.mutateAsync({ kind: 'transfer', toCohortId, reason, notify })
      onDone(`${person.firstName} moved to ${options.find((c) => c.id === toCohortId)?.name ?? 'the new cohort'}.`)
    } catch (error) {
      setFailed(errorMessage(error, 'Nothing changed. Try again.'))
    }
  }

  return (
    <ChangeDialog
      open={open}
      onClose={onClose}
      title={`Transfer ${person.firstName} to another cohort`}
      description={`${person.firstName} moves now and continues there. Their ${enrolment.cohort.name} attendance and grades stay with ${enrolment.cohort.name}.`}
      submitLabel="Transfer participant"
      pending={change.isPending}
      failed={failed}
      onSubmit={onSubmit}
    >
      <SelectField
        label="Move to"
        value={toCohortId}
        onChange={(e) => {
          setToCohortId(e.target.value)
          setTargetError(null)
        }}
        error={targetError}
        helper={
          options.length
            ? `Active and upcoming cohorts in ${enrolment.programme.name}.`
            : `${enrolment.programme.name} has no other active or upcoming cohorts.`
        }
      >
        <option value="">Select a cohort</option>
        {options.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </SelectField>
      {toCohortId && target.data && (
        <DetailList
          items={[
            { label: 'Courses in common', value: common?.length ? common.join(', ') : <span className="font-normal text-muted">None</span> },
            {
              label: 'Trainers there',
              value: trainersThere.length ? trainersThere.join(', ') : <span className="font-normal text-muted">None assigned yet</span>,
            },
          ]}
        />
      )}
      <TextField label="Reason" optional value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Can only attend weekend sessions" />
      <Checkbox label={`Email ${person.firstName} about this change`} checked={notify} onChange={(e) => setNotify(e.target.checked)} />
    </ChangeDialog>
  )
}
