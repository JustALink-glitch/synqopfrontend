import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Choice'
import { Dialog } from '@/components/ui/Dialog'
import { MailIcon } from '@/components/ui/icons'
import { TextField } from '@/components/ui/TextField'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { ApiError } from '@/lib/api'
import { splitFullName } from '@/lib/people'
import { validateEmail, validateFullName } from '@/pages/onboarding/validation'
import { useCohorts } from '@/pages/admin/programmes/data'
import { useProgrammeSetup } from '@/pages/admin/settings/data'
import { useInviteMember, type Member } from './members'

type Errors = { fullName?: string | undefined; email?: string | undefined; cohorts?: string | undefined }

/**
 * B2.03 Invite trainer. Pilot feedback (Nov 2026): pick lead or assistant, and assign cohorts straight away. A cohort
 * ticked here means every course in it; single courses are assigned later from the trainer's page.
 */
export function InviteTrainerDialog({
  open,
  onClose,
  onInvited,
}: {
  open: boolean
  onClose: () => void
  onInvited: (member: Member, emailSent: boolean) => void
}) {
  const invite = useInviteMember()
  const cohorts = useCohorts()
  const setup = useProgrammeSetup().data?.settings
  const assistantsOn = setup?.assistantsEnabled ?? false
  const open_ = (cohorts.data ?? []).filter((c) => c.status === 'active' || c.status === 'upcoming' || c.status === 'draft')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'trainer' | 'assistant_trainer'>('trainer')
  const [picked, setPicked] = useState<string[]>([])
  const [errors, setErrors] = useState<Errors>({})
  const [failed, setFailed] = useState<string | null>(null)

  function close() {
    if (invite.isPending) return
    setFullName('')
    setEmail('')
    setRole('trainer')
    setPicked([])
    setErrors({})
    setFailed(null)
    invite.reset()
    onClose()
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const next: Errors = { fullName: validateFullName(fullName, 'their'), email: validateEmail(email) }
    setErrors(next)
    setFailed(null)
    if (next.fullName || next.email) return

    try {
      const { firstName, lastName } = splitFullName(fullName)
      const result = await invite.mutateAsync({
        email: email.trim().toLowerCase(),
        firstName,
        lastName,
        role: assistantsOn ? role : 'trainer',
        assignments: picked.map((cohortId) => ({ cohortId })),
      })
      setFullName('')
      setEmail('')
      setRole('trainer')
      setPicked([])
      onInvited(result.member, result.emailSent)
    } catch (error) {
      if (error instanceof ApiError && error.code === 'email_in_use') {
        setErrors({ email: 'This email is already in use on Synqop. One email can belong to one organisation.' })
      } else if (error instanceof ApiError && error.status === 400 && (error.details as { field: string }[] | undefined)?.some((d) => d.field === 'cohortId')) {
        const d = (error.details as { field: string; message: string }[]).find((x) => x.field === 'cohortId')!
        setErrors({ cohorts: d.message })
      } else if (error instanceof ApiError && error.status === 409 && error.code === 'assistants_off') {
        setErrors({ cohorts: error.message })
      } else if (error instanceof ApiError && error.status === 400) {
        const fields = ((error.details as { field: string; message: string }[] | undefined) ?? []).map((d) => d.field)
        setErrors({
          fullName: fields.some((f) => f === 'firstName' || f === 'lastName') ? 'Enter their first and last name.' : undefined,
          email: fields.includes('email') ? 'Enter an email address like name@organisation.org.' : undefined,
        })
      } else {
        setFailed('The invitation wasn’t sent. Check your connection and try again.')
      }
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Invite a trainer"
      description="They get an email to set up their account. They only see the cohorts you assign."
      actions={
        <>
          <Button variant="secondary" onClick={close} disabled={invite.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="invite-trainer" icon={<MailIcon size={16} />} disabled={invite.isPending}>
            {invite.isPending ? 'Sending…' : 'Send invitation'}
          </Button>
        </>
      }
    >
      <form id="invite-trainer" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {failed && (
          <AlertBanner tone="error" title="Couldn’t send the invitation">
            {failed}
          </AlertBanner>
        )}
        <TextField
          label="Full name"
          autoComplete="off"
          autoFocus
          value={fullName}
          onChange={(e) => {
            setFullName(e.target.value)
            setErrors((prev) => ({ ...prev, fullName: undefined }))
          }}
          error={errors.fullName}
        />
        <TextField
          label="Work email"
          type="email"
          autoComplete="off"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            setErrors((prev) => ({ ...prev, email: undefined }))
          }}
          error={errors.email}
        />
        {assistantsOn && (
          <fieldset className="flex flex-col gap-2.5">
            <legend className="pb-1 text-caption-strong text-primary">Role</legend>
            {(
              [
                ['trainer', 'Lead trainer', 'Runs sessions, takes attendance and writes session reports.'],
                ['assistant_trainer', 'Assistant trainer', 'Supports the lead. Can do what Programme setup allows.'],
              ] as const
            ).map(([value, label, help]) => (
              <label key={value} className="flex cursor-pointer items-start gap-2">
                <input
                  type="radio"
                  name="invite-role"
                  checked={role === value}
                  onChange={() => setRole(value)}
                  className="mt-0.5 size-4 shrink-0 cursor-pointer appearance-none rounded-full border border-strong bg-surface checked:border-[5px] checked:border-brand focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none"
                />
                <span className="flex flex-col">
                  <span className="text-body text-primary">{label}</span>
                  <span className="text-caption text-secondary">{help}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}
        <fieldset className="flex flex-col gap-2.5" aria-describedby="invite-cohorts-help">
          <legend className="flex gap-1.5 pb-1 text-caption-strong">
            <span className="text-primary">Assign to cohorts</span>
            <span className="text-caption text-muted">Optional</span>
          </legend>
          {cohorts.isPending ? (
            <p className="text-body text-secondary">Loading cohorts…</p>
          ) : open_.length === 0 ? (
            <p className="text-body text-secondary">You don’t have any active or upcoming cohorts yet.</p>
          ) : (
            <div className="flex max-h-48 flex-col gap-2 overflow-y-auto">
              {open_.map((c) => (
                <Checkbox
                  key={c.id}
                  checked={picked.includes(c.id)}
                  onChange={(e) => {
                    setErrors((prev) => ({ ...prev, cohorts: undefined }))
                    setPicked((prev) => (e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)))
                  }}
                  label={
                    <span>
                      {c.name} <span className="text-secondary">· {c.programme.name}</span>
                    </span>
                  }
                />
              ))}
            </div>
          )}
          {errors.cohorts ? (
            <p id="invite-cohorts-help" className="text-caption text-error-fg">
              {errors.cohorts}
            </p>
          ) : (
            <p id="invite-cohorts-help" className="text-caption text-secondary">
              {setup?.trainerAssignment === 'cohort'
                ? 'They teach every course in the cohorts you tick.'
                : 'They’re assigned to every course in the cohorts you tick. To assign single courses, use Assign on their page later.'}
            </p>
          )}
        </fieldset>
      </form>
    </Dialog>
  )
}
