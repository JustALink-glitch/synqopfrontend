import { useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { StatePanel } from '@/components/StatePanel'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Button } from '@/components/ui/Button'
import { Checkbox, RadioGroup } from '@/components/ui/Choice'
import { FormLayout, FormSection } from '@/components/ui/FormLayout'
import { FileRow } from '@/components/ui/FileRow'
import { CloseIcon, FileIcon, PlusIcon } from '@/components/ui/icons'
import { FilterChips, PageHeader, Panel, PanelHeader } from '@/components/ui/Page'
import { SelectField, TextAreaField, TextField } from '@/components/ui/TextField'
import { ApiError } from '@/lib/api'
import { uploadFile } from '@/lib/files'
import { addDays } from '@/lib/schedule'
import { plural, todayIn } from '@/lib/format'
import {
  scaleName,
  useAssignment,
  useAssignmentOptions,
  useCreateAssignment,
  useEditAssignment,
  type AssignmentDetail,
  type AssignmentInput,
  type LatePolicy,
  type Scale,
  type SubmissionType,
} from './data'

const BASE = '/trainer/grading'
type Options = NonNullable<ReturnType<typeof useAssignmentOptions>['data']>
type Errors = Record<string, string | undefined>
interface AttachedFile {
  key: string
  name: string
  size: number
  /** Already saved on the assignment. */
  id?: string
  /** Uploaded, waiting to be saved. */
  path?: string
  uploading?: boolean
  error?: string
}

/** /trainer/grading/new and /trainer/grading/:id/edit — T6.02, T6.02b, T6.05. */
export function AssignmentFormPage({ mode }: { mode: 'new' | 'edit' }) {
  const { id = '' } = useParams()
  const options = useAssignmentOptions()
  const detail = useAssignment(mode === 'edit' ? id : '')
  const loading = options.isPending || (mode === 'edit' && detail.isPending)
  const failed = options.isError || (mode === 'edit' && detail.isError)
  if (loading) return <div aria-busy="true" aria-label="Loading" className="h-40" />
  if (failed || !options.data) {
    const notFound = mode === 'edit' && (detail.error as { status?: number } | null)?.status === 404
    return (
      <>
        <PageHeader title={notFound ? 'Assignment not found' : 'Couldn’t load the form'} breadcrumb={[{ label: 'Assignments', to: BASE }]} />
        <Panel>
          <StatePanel
            kind={notFound ? 'no-results' : 'error'}
            title={notFound ? 'It may have been removed, or it isn’t one of yours.' : 'Something went wrong'}
            description="Go back to your assignments."
          />
        </Panel>
      </>
    )
  }
  if (mode === 'edit' && detail.data && !detail.data.assignment.canEdit) {
    return (
      <>
        <PageHeader title="You can’t edit this assignment" breadcrumb={[{ label: 'Assignments', to: BASE }]} />
        <Panel>
          <StatePanel kind="no-results" title="Ask the course’s lead trainer to change it." />
        </Panel>
      </>
    )
  }
  return <AssignmentForm key={id || 'new'} options={options.data} existing={mode === 'edit' ? detail.data!.assignment : null} />
}

function AssignmentForm({ options, existing }: { options: Options; existing: AssignmentDetail | null }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const create = useCreateAssignment()
  const edit = useEditAssignment(existing?.id ?? '')
  const saving = create.isPending || edit.isPending
  const locked = existing?.locked ?? false
  const isDraft = !existing || existing.status === 'draft'

  const [cohortCourseId, setCohortCourseId] = useState(
    existing?.cohortCourseId ?? params.get('course') ?? (options.courses.length === 1 ? options.courses[0]!.id : ''),
  )
  const [title, setTitle] = useState(existing?.title ?? '')
  const [brief, setBrief] = useState(existing?.brief ?? '')
  const [links, setLinks] = useState<string[]>(existing?.links.map((l) => l.url) ?? [])
  const [files, setFiles] = useState<AttachedFile[]>(existing?.files.map((f) => ({ key: f.id, id: f.id, name: f.name, size: f.size })) ?? [])
  const picker = useRef<HTMLInputElement>(null)
  const uploading = files.some((f) => f.uploading)
  const [dueDate, setDueDate] = useState(existing?.dueDate ?? addDays(todayIn(options.timeZone), 7))
  const [dueTime, setDueTime] = useState(existing?.dueTime ?? '23:59')
  const [types, setTypes] = useState<SubmissionType[]>(existing?.submissionTypes ?? ['file'])
  const [latePolicy, setLatePolicy] = useState<LatePolicy>(existing?.latePolicy ?? 'accept_late')
  const [scale, setScale] = useState<Scale>(existing?.gradingScale ?? options.scales[0] ?? 'points')
  const [maxPoints, setMaxPoints] = useState(String(existing?.maxPoints ?? 100))
  const [criteria, setCriteria] = useState<{ title: string; description: string }[]>(
    existing?.criteria.length
      ? existing.criteria.map((c) => ({
          title: c.title,
          description: c.description ?? '',
        }))
      : [{ title: '', description: '' }],
  )
  const [errors, setErrors] = useState<Errors>({})
  const [failed, setFailed] = useState<string | null>(null)

  const course = options.courses.find((c) => c.id === cohortCourseId)
  // An edited assignment may sit in a cohort that has since ended; keep it in the list.
  const courseChoices =
    existing && !course
      ? [
          {
            id: existing.cohortCourseId,
            courseName: existing.course.name,
            cohort: existing.cohort,
            programmeName: existing.programme.name,
          },
          ...options.courses,
        ]
      : options.courses
  const cohortName = course?.cohort.name ?? existing?.cohort.name
  const scales = existing && !options.scales.includes(existing.gradingScale) ? [...options.scales, existing.gradingScale] : options.scales
  const clear = (key: string) => setErrors((prev) => ({ ...prev, [key]: undefined }))

  /** Uploads straight away so saving is quick; the form sends the storage paths. */
  async function attach(picked: File[]) {
    clear('files')
    const added = picked.map((file) => ({ key: crypto.randomUUID(), name: file.name, size: file.size, uploading: true, file }))
    setFiles((prev) => [...prev, ...added.map(({ file: _file, ...f }) => f)])
    await Promise.all(
      added.map(async ({ key, file }) => {
        try {
          const path = await uploadFile('/v1/assignments/uploads', file)
          setFiles((prev) => prev.map((f) => (f.key === key ? { ...f, path, uploading: false } : f)))
        } catch (error) {
          const message =
            error instanceof ApiError && Array.isArray(error.details)
              ? (error.details as { message: string }[])[0]?.message
              : error instanceof Error
                ? error.message
                : null
          setFiles((prev) => prev.map((f) => (f.key === key ? { ...f, uploading: false, error: message ?? 'Didn’t upload. Remove it and try again.' } : f)))
        }
      }),
    )
  }

  async function submit(publish: boolean) {
    const filledCriteria = criteria.filter((c) => c.title.trim() || c.description.trim())
    const next: Errors = {
      cohortCourseId: cohortCourseId ? undefined : 'Choose a course.',
      title: title.trim() ? undefined : 'Enter a title.',
      dueDate: dueDate ? undefined : 'Choose a due date.',
      dueTime: /^\d{2}:\d{2}$/.test(dueTime) ? undefined : 'Enter a time like 23:59.',
      submissionTypes: types.length ? undefined : 'Choose at least one way to submit.',
      maxPoints: scale === 'points' && !(Number(maxPoints) > 0) ? 'Enter the points it’s out of.' : undefined,
      criteria: scale === 'rubric' && filledCriteria.length === 0 ? 'Add at least one criterion.' : undefined,
      ...Object.fromEntries(
        scale === 'rubric' ? criteria.map((c, i) => [`criteria.${i}.title`, !c.title.trim() && c.description.trim() ? 'Name the criterion.' : undefined]) : [],
      ),
      ...Object.fromEntries(
        links.map((l, i) => [`links.${i}.url`, l.trim() && !/^https?:\/\/\S+$/.test(l.trim()) ? 'Paste the full link, starting with https://' : undefined]),
      ),
    }
    if (uploading) next.files = 'Wait for the files to finish uploading.'
    else if (files.some((f) => f.error)) next.files = 'Remove the files that didn’t upload.'
    setErrors(next)
    setFailed(null)
    if (Object.values(next).some(Boolean)) return
    const input: AssignmentInput = {
      cohortCourseId,
      title,
      brief,
      links: links.filter((l) => l.trim()).map((url) => ({ url: url.trim() })),
      files: files.flatMap((f): AssignmentInput['files'] => (f.id ? [{ id: f.id }] : f.path ? [{ path: f.path, name: f.name }] : [])),
      dueDate,
      dueTime,
      submissionTypes: types,
      latePolicy,
      gradingScale: scale,
      maxPoints: scale === 'points' ? Number(maxPoints) : null,
      criteria: scale === 'rubric' ? (locked ? criteria : filledCriteria) : [],
      publish,
    }
    try {
      if (existing) {
        await edit.mutateAsync(input)
        navigate(`${BASE}/${existing.id}`, {
          state: { saved: publish && isDraft ? 'published' : 'saved' },
        })
      } else {
        await create.mutateAsync(input)
        navigate(BASE, {
          state: publish ? { published: title.trim() } : { drafted: title.trim() },
        })
      }
    } catch (error) {
      if (error instanceof ApiError && Array.isArray(error.details)) {
        setErrors(Object.fromEntries((error.details as { field: string; message: string }[]).map((d) => [d.field, d.message])))
      } else {
        setFailed(error instanceof ApiError && error.status < 500 ? error.message : 'Nothing was saved. Check your connection and try again.')
      }
    }
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    void submit(true)
  }

  const totalPoints = criteria.filter((c) => c.title.trim()).length * 4

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: 'Assignments', to: BASE },
          ...(existing ? [{ label: existing.title, to: `${BASE}/${existing.id}` }] : []),
          { label: existing ? 'Edit' : 'New assignment' },
        ]}
        title={existing ? 'Edit assignment' : 'New assignment'}
        description={
          course
            ? `${course.courseName} · ${course.cohort.name}`
            : existing
              ? `${existing.course.name} · ${existing.cohort.name}`
              : 'Choose the course it belongs to.'
        }
      />
      {locked && (
        <AlertBanner title="Some settings are locked">
          {plural(existing!.counts.submitted, 'participant has', 'participants have')} already submitted. You can still change the brief, due date and
          resources. The grading scale and submission types can’t change once work is submitted.
        </AlertBanner>
      )}
      <FormLayout
        aside={
          <Panel>
            <PanelHeader
              title={isDraft ? 'When you publish' : 'When you save'}
              description={`Participants in ${cohortName ?? 'the cohort'} see it on their course${isDraft ? ' once it’s published. Drafts stay private to the course’s trainers' : ', with your changes'}.`}
            />
          </Panel>
        }
      >
        <Panel>
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
            {failed && (
              <AlertBanner tone="error" title="Couldn’t save">
                {failed}
              </AlertBanner>
            )}
            <FormSection title="Assignment">
              <SelectField
                label="Course"
                value={cohortCourseId}
                disabled={locked}
                onChange={(e) => {
                  setCohortCourseId(e.target.value)
                  clear('cohortCourseId')
                }}
                error={errors.cohortCourseId}
                helper={locked ? 'Work has been submitted, so the course can’t change.' : 'Only courses you teach.'}
              >
                <option value="">Select a course</option>
                {courseChoices.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.courseName} · {c.cohort.name}
                  </option>
                ))}
              </SelectField>
              <TextField
                label="Title"
                value={title}
                maxLength={200}
                placeholder="e.g. Mini project"
                onChange={(e) => {
                  setTitle(e.target.value)
                  clear('title')
                }}
                error={errors.title}
              />
              <TextAreaField
                label="Brief"
                optional
                value={brief}
                maxLength={5000}
                placeholder="What participants should do and hand in."
                onChange={(e) => setBrief(e.target.value)}
              />
              {links.map((url, i) => (
                <div key={i} className="flex items-start gap-2">
                  <TextField
                    label={`Resource link${links.length > 1 ? ` ${i + 1}` : ''}`}
                    type="url"
                    placeholder="https://"
                    value={url}
                    onChange={(e) => {
                      setLinks((prev) => prev.map((l, j) => (j === i ? e.target.value : l)))
                      clear(`links.${i}.url`)
                    }}
                    error={errors[`links.${i}.url`]}
                  />
                  <button
                    type="button"
                    aria-label={`Remove link ${i + 1}`}
                    onClick={() => setLinks((prev) => prev.filter((_, j) => j !== i))}
                    className="mt-7 flex size-9 shrink-0 items-center justify-center rounded-md text-icon hover:bg-surface-hover focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none"
                  >
                    <CloseIcon size={16} />
                  </button>
                </div>
              ))}
              {files.map((f) => (
                <FileRow
                  key={f.key}
                  name={f.name}
                  size={f.size}
                  meta={f.uploading ? 'Uploading…' : f.error ? <span className="text-error-fg">{f.error}</span> : undefined}
                  action={
                    <button
                      type="button"
                      aria-label={`Remove ${f.name}`}
                      onClick={() => setFiles((prev) => prev.filter((x) => x.key !== f.key))}
                      className="flex size-9 shrink-0 items-center justify-center rounded-md text-icon hover:bg-surface-hover focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none"
                    >
                      <CloseIcon size={16} />
                    </button>
                  }
                />
              ))}
              {errors.files && <p className="text-caption text-error-fg">{errors.files}</p>}
              <div className="flex flex-wrap items-center gap-4">
                {files.length < 10 && (
                  <Button variant="secondary" icon={<FileIcon size={16} />} onClick={() => picker.current?.click()}>
                    Attach files
                  </Button>
                )}
                <input
                  ref={picker}
                  type="file"
                  multiple
                  aria-label="Attach files"
                  tabIndex={-1}
                  className="sr-only"
                  onChange={(e) => {
                    void attach([...(e.target.files ?? [])].slice(0, 10 - files.length))
                    e.target.value = ''
                  }}
                />
                {links.length < 10 && (
                  <button
                    type="button"
                    onClick={() => setLinks((prev) => [...prev, ''])}
                    className="inline-flex w-fit items-center gap-1.5 text-label-button text-brand-text hover:underline"
                  >
                    <PlusIcon size={16} />
                    Add link
                  </button>
                )}
              </div>
            </FormSection>

            <FormSection title="Due and submissions">
              <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
                <TextField
                  label="Due date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => {
                    setDueDate(e.target.value)
                    clear('dueDate')
                  }}
                  error={errors.dueDate}
                />
                <TextField
                  label="Time"
                  type="time"
                  value={dueTime}
                  onChange={(e) => {
                    setDueTime(e.target.value)
                    clear('dueTime')
                  }}
                  error={errors.dueTime}
                />
              </div>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-caption-strong text-primary">Participants can submit</legend>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  {(['file', 'link', 'text'] as const).map((t) => (
                    <Checkbox
                      key={t}
                      label={{ file: 'File', link: 'Link', text: 'Text' }[t]}
                      checked={types.includes(t)}
                      disabled={locked}
                      onChange={(e) => {
                        setTypes((prev) => (e.target.checked ? [...prev, t] : prev.filter((x) => x !== t)))
                        clear('submissionTypes')
                      }}
                    />
                  ))}
                </div>
                {errors.submissionTypes && <p className="text-caption text-error-fg">{errors.submissionTypes}</p>}
              </fieldset>
              <div className="flex flex-col gap-2">
                <span className="text-caption-strong text-primary">After the due time</span>
                <RadioGroup
                  label="After the due time"
                  options={[
                    { value: 'accept_late', label: 'Accept and mark as late' },
                    { value: 'closed', label: 'Don’t accept new submissions' },
                  ]}
                  value={latePolicy}
                  onChange={setLatePolicy}
                />
              </div>
            </FormSection>

            <FormSection title="Grading" description="Choose how you’ll grade. You can’t change it once work is submitted.">
              {locked ? (
                <p className="text-body-strong text-primary">{existing!.scaleLabel}</p>
              ) : (
                <FilterChips
                  label="Grading scale"
                  value={scale}
                  onChange={(value) => {
                    setScale(value)
                    clear('maxPoints')
                    clear('criteria')
                  }}
                  options={scales.map((s) => ({
                    value: s,
                    label: scaleName[s],
                  }))}
                />
              )}
              {errors.gradingScale && <p className="text-caption text-error-fg">{errors.gradingScale}</p>}
              {scale === 'points' && (
                <div className="w-48">
                  <TextField
                    label="Out of"
                    type="number"
                    min={1}
                    disabled={locked}
                    value={maxPoints}
                    onChange={(e) => {
                      setMaxPoints(e.target.value)
                      clear('maxPoints')
                    }}
                    error={errors.maxPoints}
                    helper="Points the work is marked out of."
                  />
                </div>
              )}
              {scale === 'percentage' && <p className="text-caption text-secondary">Grade each submission from 0 to 100%.</p>}
              {scale === 'letter' && (
                <p className="text-caption text-secondary">Letters A, B, C, D, E, F — A is the highest. Participants see the letter only.</p>
              )}
              {scale === 'pass_fail' && <p className="text-caption text-secondary">Each submission passes or fails. Add feedback to say why.</p>}
              {scale === 'rubric' && (
                <>
                  <ol aria-label="Rubric criteria" className="flex flex-col">
                    {criteria.map((c, i) => (
                      <li
                        key={i}
                        className="grid grid-cols-[1fr_1fr_72px_36px] items-start gap-3 border-b border-default py-3 first:pt-0 max-md:grid-cols-[1fr_36px]"
                      >
                        <TextField
                          label="Criterion"
                          value={c.title}
                          maxLength={120}
                          disabled={locked}
                          placeholder="e.g. Use of data"
                          onChange={(e) => {
                            setCriteria((prev) => prev.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))
                            clear(`criteria.${i}.title`)
                            clear('criteria')
                          }}
                          error={errors[`criteria.${i}.title`]}
                        />
                        <div className="max-md:order-3 max-md:col-span-2">
                          <TextField
                            label="What earns full marks"
                            optional
                            value={c.description}
                            maxLength={300}
                            onChange={(e) => setCriteria((prev) => prev.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5 max-md:hidden">
                          <span className="text-caption-strong text-primary">Levels</span>
                          <span className="flex h-9 items-center text-body text-secondary">1–4</span>
                        </div>
                        <button
                          type="button"
                          aria-label={`Remove criterion ${i + 1}`}
                          disabled={locked || criteria.length === 1}
                          onClick={() => setCriteria((prev) => prev.filter((_, j) => j !== i))}
                          className="mt-7 flex size-9 items-center justify-center rounded-md text-icon hover:bg-surface-hover focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none disabled:invisible max-md:order-2"
                        >
                          <CloseIcon size={16} />
                        </button>
                      </li>
                    ))}
                  </ol>
                  {!locked && criteria.length < 12 && (
                    <button
                      type="button"
                      onClick={() => setCriteria((prev) => [...prev, { title: '', description: '' }])}
                      className="inline-flex w-fit items-center gap-1.5 text-label-button text-brand-text hover:underline"
                    >
                      <PlusIcon size={16} />
                      Add criterion
                    </button>
                  )}
                  {errors.criteria ? (
                    <p className="text-caption text-error-fg">{errors.criteria}</p>
                  ) : (
                    <p className="text-caption text-secondary">Total: {totalPoints} points. Each criterion is scored 1–4.</p>
                  )}
                </>
              )}
            </FormSection>

            <div className="flex justify-end gap-3 max-md:flex-col-reverse max-md:[&>*]:h-11">
              {isDraft ? (
                <>
                  <Button variant="secondary" onClick={() => void submit(false)} disabled={saving}>
                    Save draft
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Saving…' : 'Publish'}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="secondary" onClick={() => navigate(-1)} disabled={saving}>
                    Discard
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Saving…' : 'Save changes'}
                  </Button>
                </>
              )}
            </div>
          </form>
        </Panel>
      </FormLayout>
    </>
  )
}
