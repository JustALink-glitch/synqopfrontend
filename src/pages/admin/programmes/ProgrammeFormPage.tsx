import { useState, type FormEvent } from 'react'
import { PermanentDeleteSection } from '@/components/admin/PermanentDelete'
import { useNavigate, useParams } from 'react-router'
import { StatePanel } from '@/components/StatePanel'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Choice'
import { Dialog } from '@/components/ui/Dialog'
import { FormLayout, FormSection, NextSteps } from '@/components/ui/FormLayout'
import { PageHeader, Panel } from '@/components/ui/Page'
import { SelectField, TextAreaField, TextField } from '@/components/ui/TextField'
import { ApiError } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { useMembers } from '@/pages/admin/people/members'
import {
  useArchiveProgramme,
  useCreateProgramme,
  useProgramme,
  useProgrammes,
  useUpdateProgramme,
  type CohortSummary,
  type Programme,
  type ProgrammeInput,
} from './data'

/** Pre-ticked on a new programme (A1.03). */
const PRESELECTED = ['Employed', 'Internship', 'Further study']
const FALLBACK_OUTCOMES = ['Employed', 'Internship', 'Further study', 'Started a business', 'Freelancing']

/** Organisation defaults (F1.05). */
const COMPLETION_NOTE = 'Follows your organisation’s completion rule. Change it in Settings › Completion & certificates.'

/** /admin/programmes/new — A1.03 New programme. */
export function NewProgrammePage() {
  const programmes = useProgrammes()
  if (programmes.isPending) return <div aria-busy="true" className="h-40" />
  const options = programmes.data?.defaultOutcomes ?? FALLBACK_OUTCOMES
  return <ProgrammeForm initial={{ name: '', description: '', leadMemberId: null, outcomes: PRESELECTED }} outcomeOptions={options} />
}

/** /admin/programmes/:id/edit — A1.04 Edit programme (with A1.05 archive). */
export function EditProgrammePage() {
  const { id = '' } = useParams()
  const query = useProgramme(id)
  if (query.isPending) return <div aria-busy="true" className="h-40" />
  if (query.isError) {
    return (
      <Panel>
        <StatePanel kind="no-results" title="Programme not found" description="It may have been removed." />
      </Panel>
    )
  }
  const { programme, outcomes, cohorts } = query.data
  const options = [...FALLBACK_OUTCOMES, ...outcomes.filter((o) => !FALLBACK_OUTCOMES.some((f) => f.toLowerCase() === o.toLowerCase()))]
  return (
    <ProgrammeForm
      existing={programme}
      cohorts={cohorts}
      initial={{ name: programme.name, description: programme.description ?? '', leadMemberId: programme.lead?.id ?? null, outcomes }}
      outcomeOptions={options}
    />
  )
}

function ProgrammeForm({
  existing,
  cohorts = [],
  initial,
  outcomeOptions,
}: {
  existing?: Programme
  cohorts?: CohortSummary[]
  initial: ProgrammeInput
  outcomeOptions: string[]
}) {
  const navigate = useNavigate()
  const admins = useMembers(['owner', 'admin'])
  const create = useCreateProgramme()
  const update = useUpdateProgramme(existing?.id ?? '')
  const [form, setForm] = useState(initial)
  const [errors, setErrors] = useState<{ name?: string; leadMemberId?: string }>({})
  const [failed, setFailed] = useState<string | null>(null)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const saving = create.isPending || update.isPending
  const editing = Boolean(existing)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!form.name.trim()) {
      setErrors({ name: 'Enter a programme name.' })
      return
    }
    setErrors({})
    setFailed(null)
    try {
      if (existing) {
        await update.mutateAsync(form)
        navigate(`/admin/programmes/${existing.id}`)
      } else {
        const result = await create.mutateAsync(form)
        navigate(`/admin/programmes/${result.programme.id}`, { replace: true })
      }
    } catch (error) {
      if (error instanceof ApiError && error.details && Array.isArray(error.details)) {
        const fields = Object.fromEntries((error.details as { field: string; message: string }[]).map((d) => [d.field, d.message]))
        setErrors({ name: fields.name, leadMemberId: fields.leadMemberId })
        if (!fields.name && !fields.leadMemberId) setFailed(error.message)
      } else {
        setFailed(error instanceof ApiError && error.status < 500 ? error.message : 'Your changes weren’t saved. Check your connection and try again.')
      }
    }
  }

  const toggleOutcome = (label: string, checked: boolean) =>
    setForm((prev) => ({ ...prev, outcomes: checked ? [...prev.outcomes, label] : prev.outcomes.filter((o) => o !== label) }))

  const adminOptions = (admins.data ?? []).filter((m) => m.status !== 'deactivated')

  return (
    <>
      <PageHeader
        breadcrumb={
          existing
            ? [{ label: 'Programmes', to: '/admin/programmes' }, { label: existing.name, to: `/admin/programmes/${existing.id}` }, { label: 'Edit' }]
            : [{ label: 'Programmes', to: '/admin/programmes' }, { label: 'New programme' }]
        }
        title={editing ? 'Edit programme' : 'New programme'}
        description={editing ? 'Changes apply to all cohorts in this programme.' : 'A programme groups cohorts that follow the same curriculum.'}
      />
      <FormLayout
        aside={
          editing ? undefined : (
            <NextSteps
              title="After you create it"
              steps={[
                { title: 'Add courses', description: 'Build the programme’s course library.' },
                { title: 'Create the first cohort', description: 'Set dates; courses come from the library.' },
                { title: 'Invite trainers and participants', description: 'Assign trainers to courses, then import participants.' },
              ]}
            />
          )
        }
      >
        <Panel>
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
            {failed && (
              <AlertBanner tone="error" title="Couldn’t save the programme">
                {failed}
              </AlertBanner>
            )}
            <FormSection title="Basics">
              <TextField
                label="Programme name"
                placeholder="e.g. Leadership Programme"
                helper="Shown to trainers and participants."
                autoFocus={!editing}
                value={form.name}
                onChange={(e) => {
                  setForm({ ...form, name: e.target.value })
                  setErrors((prev) => ({ ...prev, name: undefined }))
                }}
                error={errors.name}
              />
              <TextAreaField
                label="Description"
                optional
                placeholder="What participants will learn and who it’s for"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
              <SelectField
                label="Programme lead"
                optional
                helper="The admin participants and trainers can contact."
                value={form.leadMemberId ?? ''}
                onChange={(e) => setForm({ ...form, leadMemberId: e.target.value || null })}
                error={errors.leadMemberId}
              >
                <option value="">Select an admin</option>
                {adminOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.firstName} {m.lastName}
                  </option>
                ))}
              </SelectField>
            </FormSection>

            <FormSection
              title="Outcomes to track"
              description="Recorded per participant after the programme. Defaults come from Settings › Completion & certificates."
            >
              <div className="flex flex-col gap-2.5">
                {outcomeOptions.map((label) => (
                  <Checkbox
                    key={label}
                    label={label}
                    checked={form.outcomes.some((o) => o.toLowerCase() === label.toLowerCase())}
                    onChange={(e) => toggleOutcome(label, e.target.checked)}
                  />
                ))}
              </div>
            </FormSection>

            <FormSection title="Completion">
              <p className="-mt-1 text-caption text-secondary">{COMPLETION_NOTE}</p>
            </FormSection>

            {existing && (
              <div className="flex items-start gap-4 rounded-md border border-default p-4 max-md:flex-col">
                <div className="flex flex-1 flex-col gap-0.5">
                  <h2 className="text-body-strong text-primary">Archive programme</h2>
                  <p className="text-caption text-secondary">
                    Archived programmes and their cohorts become read-only and leave your lists. Reports stay available, and you can restore it.
                  </p>
                </div>
                <Button variant="secondary" onClick={() => setArchiveOpen(true)}>
                  Archive programme
                </Button>
              </div>
            )}
            {existing && <PermanentDeleteSection kind="programme" id={existing.id} />}

            <div className="flex gap-3 max-md:flex-col-reverse max-md:[&>*]:h-11">
              <Button variant="secondary" onClick={() => navigate(existing ? `/admin/programmes/${existing.id}` : '/admin/programmes')} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Create programme'}
              </Button>
            </div>
          </form>
        </Panel>
      </FormLayout>

      {existing && <ArchiveProgrammeDialog open={archiveOpen} onClose={() => setArchiveOpen(false)} programme={existing} cohorts={cohorts} />}
    </>
  )
}

/** A1.05 Archive programme, or A1.05b when cohorts are still running. */
export function ArchiveProgrammeDialog({
  open,
  onClose,
  programme,
  cohorts,
}: {
  open: boolean
  onClose: () => void
  programme: Programme
  cohorts: CohortSummary[]
}) {
  const navigate = useNavigate()
  const archive = useArchiveProgramme(programme.id)
  const [failed, setFailed] = useState<string | null>(null)
  const active = cohorts.filter((c) => c.status === 'active')
  const upcoming = cohorts.filter((c) => c.status === 'upcoming' || c.status === 'draft')
  const completed = cohorts.filter((c) => c.status === 'completed')

  if (active.length + upcoming.length > 0) {
    const counts = [
      active.length && `${active.length} active ${active.length === 1 ? 'cohort' : 'cohorts'}`,
      upcoming.length && `${upcoming.length} upcoming ${upcoming.length === 1 ? 'cohort' : 'cohorts'}`,
    ]
      .filter(Boolean)
      .join(' and ')
    const ends = active.map((c) => `${c.name} ends ${formatDate(c.endsOn)}`)
    const notStarted = upcoming.map((c) => c.name)
    return (
      <Dialog
        open={open}
        onClose={onClose}
        width={440}
        title="This programme can’t be archived yet"
        description={`${programme.name} has ${counts}. Archive or finish ${active.length + upcoming.length === 1 ? 'it' : 'them'} first.`}
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate(`/admin/programmes/${programme.id}`)}>
              View cohorts
            </Button>
            <Button onClick={onClose}>OK</Button>
          </>
        }
      >
        <AlertBanner title="Cohorts finish on their end date">
          {[
            ends.length > 0 && `${joinList(ends)}.`,
            notStarted.length > 0 &&
              `${joinList(notStarted)} ${notStarted.length === 1 ? 'hasn’t' : 'haven’t'} started — archive ${notStarted.length === 1 ? 'it' : 'them'} to cancel.`,
          ]
            .filter(Boolean)
            .join(' ')}
        </AlertBanner>
      </Dialog>
    )
  }

  async function confirm() {
    setFailed(null)
    try {
      await archive.mutateAsync()
      navigate('/admin/programmes', { state: { archived: programme.name } })
    } catch (error) {
      setFailed(error instanceof ApiError && error.status < 500 ? error.message : 'It wasn’t archived. Try again.')
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => !archive.isPending && onClose()}
      width={440}
      title={`Archive ${programme.name}?`}
      description={`${
        completed.length === 0
          ? 'It has no cohorts yet.'
          : `Its ${completed.length} completed ${completed.length === 1 ? 'cohort is' : 'cohorts are'} archived with it.`
      } Archived programmes are read-only and hidden from lists. You can restore it from Programmes › Archived.`}
      actions={
        <>
          <Button variant="secondary" onClick={onClose} disabled={archive.isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={archive.isPending}>
            {archive.isPending ? 'Archiving…' : 'Archive programme'}
          </Button>
        </>
      }
    >
      {failed && (
        <AlertBanner tone="error" title="Couldn’t archive">
          {failed}
        </AlertBanner>
      )}
    </Dialog>
  )
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`
}
