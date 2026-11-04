import clsx from 'clsx'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { StatePanel } from '@/components/StatePanel'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Button } from '@/components/ui/Button'
import { RadioGroup } from '@/components/ui/Choice'
import { FileRow } from '@/components/ui/FileRow'
import { ArrowRightIcon, CheckCircleIcon, ChevronLeftIcon } from '@/components/ui/icons'
import { PageHeader, Panel, PanelHeader } from '@/components/ui/Page'
import { TextAreaField, TextField } from '@/components/ui/TextField'
import { ApiError } from '@/lib/api'
import { openFile } from '@/lib/files'
import { StatusBadge } from './AssignmentPage'
import { formatDue, LETTERS, scaleHint, submittedLine, useSaveGrade, useSubmission, type GradeInput, type Letter, type SubmissionView } from './data'
import { assignmentBase, type Area } from './paths'

/** T6.04 Grade submission (trainer) and C4.03 Submission (admin, read-only). */
export function SubmissionPage({ area }: { area: Area }) {
  const { id = '', memberId = '' } = useParams()
  const query = useSubmission(id, memberId)
  const base = assignmentBase(area)
  const crumbs =
    area === 'admin'
      ? [
          { label: 'Courses & sessions', to: '/admin/courses' },
          { label: 'Assignments', to: base },
        ]
      : [{ label: 'Assignments', to: base }]
  if (query.isPending) return <div aria-busy="true" aria-label="Loading submission" className="h-40" />
  if (query.isError) {
    const notFound = (query.error as { status?: number }).status === 404
    return (
      <>
        <PageHeader title={notFound ? 'Submission not found' : 'Couldn’t load the submission'} breadcrumb={crumbs} />
        <Panel>
          <StatePanel
            kind={notFound ? 'no-results' : 'error'}
            title={notFound ? 'This person isn’t in this assignment.' : 'Something went wrong'}
            description="Go back to the assignment."
          />
        </Panel>
      </>
    )
  }
  return <SubmissionView key={memberId} area={area} crumbs={crumbs} data={query.data} />
}

function SubmissionView({ area, crumbs, data }: { area: Area; crumbs: { label: string; to: string }[]; data: SubmissionView }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { assignment: a, participant: p, submission: s, grade: g, queue, timeZone } = data
  const base = assignmentBase(area)
  const path = (memberId: string) => `${base}/${a.id}/submissions/${memberId}`
  const firstName = p.name.split(' ')[0]
  const [toast, setToast] = useState<string | null>((location.state as { toast?: string } | null)?.toast ?? null)
  // The toast sits over the bottom of the form on phones, so it clears itself.
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(timer)
  }, [toast])
  const grading = area === 'trainer' && a.canGrade && Boolean(s)

  const trail = [...crumbs, { label: a.title, to: `${base}/${a.id}` }, { label: p.name }]
  const scaleWords = {
    points: `graded out of ${a.maxPoints} points`,
    percentage: 'graded as a percentage',
    letter: 'graded A to F',
    pass_fail: 'graded pass or fail',
    rubric: `rubric, ${a.criteriaCount * 4} points`,
  }[a.gradingScale]

  return (
    <>
      {area === 'trainer' ? (
        <PageHeader
          breadcrumb={trail}
          title={p.name}
          badge={<StatusBadge status={p.status} />}
          description={[a.title, a.cohort.name, queue.position ? `${queue.position} of ${queue.toGrade} to grade` : scaleWords].join(' · ')}
          actions={
            s && (
              <>
                <Button
                  variant="secondary"
                  icon={<ChevronLeftIcon size={16} />}
                  disabled={!queue.previousMemberId}
                  onClick={() => queue.previousMemberId && navigate(path(queue.previousMemberId))}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  icon={<ArrowRightIcon size={16} />}
                  disabled={!queue.nextMemberId}
                  onClick={() => queue.nextMemberId && navigate(path(queue.nextMemberId))}
                >
                  Skip
                </Button>
              </>
            )
          }
        />
      ) : (
        <PageHeader
          breadcrumb={trail}
          title={a.title}
          badge={<StatusBadge status={p.status} />}
          description={[p.name, a.course.name, a.cohort.name, `Due ${formatDue(a.dueAt, timeZone)}`].join(' · ')}
        />
      )}

      <div className="flex items-start gap-4 max-lg:flex-col">
        <Panel aria-labelledby="submission-title" className="min-w-0 flex-1 gap-3 max-lg:w-full">
          <PanelHeader id="submission-title" title="Submission" description={s ? submittedLine(s, timeZone) : undefined} />
          {s ? (
            <>
              {s.files.map((f) => (
                <FileRow key={f.id} name={f.name} size={f.size} onDownload={() => openFile(`/v1/assignments/${a.id}/files/${f.id}`, f.name)} />
              ))}
              {s.link && (
                <a
                  href={s.link}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-md border border-default p-3 hover:bg-surface-hover"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="text-caption text-secondary">Link</span>
                    <span className="truncate text-body-strong text-brand-text">{s.link}</span>
                  </span>
                </a>
              )}
              {s.text && <p className="rounded-md border border-default p-3 text-body whitespace-pre-line text-primary">{s.text}</p>}
              {s.note && <p className="text-body text-secondary">“{s.note}”</p>}
            </>
          ) : (
            <StatePanel
              kind="empty"
              title="Nothing submitted yet"
              description={
                p.status === 'overdue' ? 'The due time has passed. Late work is still accepted and marked late.' : 'It appears here when they submit.'
              }
            />
          )}
        </Panel>

        <div className="flex w-[440px] shrink-0 flex-col gap-2 max-lg:w-full">
          {grading ? (
            <GradeForm
              key={g?.gradedAt ?? 'new'}
              data={data}
              onSaved={(next) => {
                const message = `Grade saved. ${firstName} can see it now.`
                if (next) navigate(path(next), { state: { toast: message } })
                else setToast(message)
              }}
            />
          ) : (
            <Panel aria-labelledby="grade-title" className="gap-3">
              <PanelHeader id="grade-title" title="Grade" description={g ? undefined : scaleHint(a)} />
              {g ? (
                <>
                  <p className="flex items-baseline gap-2">
                    <span className="text-metric-large text-primary">
                      {a.gradingScale === 'points' || a.gradingScale === 'rubric' ? g.display?.split(' / ')[0] : g.display}
                    </span>
                    {(a.gradingScale === 'points' || a.gradingScale === 'rubric') && (
                      <span className="text-body text-secondary">/ {g.display?.split(' / ')[1]}</span>
                    )}
                  </p>
                  <p className="text-caption text-secondary">{scaleHint(a)}</p>
                  {a.gradingScale === 'rubric' && (
                    <dl className="flex flex-col">
                      {a.criteria.map((c) => (
                        <div key={c.id} className="flex justify-between gap-3 border-b border-default py-2 last:border-b-0">
                          <dt className="text-body text-primary">{c.title}</dt>
                          <dd className="text-body-strong text-primary tabular-nums">{g.rubric.find((r) => r.criterionId === c.id)?.score ?? '—'} / 4</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  {g.feedback && <p className="text-body whitespace-pre-line text-primary">{g.feedback}</p>}
                  <p className="text-caption text-secondary">
                    Graded{g.gradedBy ? ` by ${g.gradedBy}` : ''} · {formatDue(g.gradedAt, timeZone)}
                  </p>
                </>
              ) : (
                <p className="text-body text-secondary">{s ? 'Not graded yet.' : 'Nothing to grade until they submit.'}</p>
              )}
            </Panel>
          )}
          {area === 'admin' && <p className="text-caption text-secondary">Grades are set by trainers. Admins can view them.</p>}
        </div>
      </div>

      {toast && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-6 z-20 mx-auto flex max-w-[400px] items-center gap-3 rounded-lg bg-[var(--text-primary)] px-4 py-3 text-body text-[var(--surface-default)] shadow-lg"
        >
          <CheckCircleIcon size={18} className="shrink-0" />
          <span className="flex-1">{toast}</span>
          {queue.nextMemberId && queue.nextMemberId !== p.id && (
            <Link to={path(queue.nextMemberId)} className="text-caption-strong whitespace-nowrap underline-offset-2 hover:underline">
              Next submission
            </Link>
          )}
          <button type="button" onClick={() => setToast(null)} className="text-caption-strong opacity-80 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}
    </>
  )
}

function GradeForm({ data, onSaved }: { data: SubmissionView; onSaved: (nextMemberId: string | null) => void }) {
  const { assignment: a, participant: p, grade: g, queue } = data
  const save = useSaveGrade(a.id, p.id)
  const [points, setPoints] = useState(g?.points?.toString() ?? '')
  const [percentage, setPercentage] = useState(g?.percentage?.toString() ?? '')
  const [letter, setLetter] = useState<Letter | null>(g?.letter ?? null)
  const [passed, setPassed] = useState<'pass' | 'fail' | ''>(g?.passed === null || g?.passed === undefined ? '' : g.passed ? 'pass' : 'fail')
  const [scores, setScores] = useState<Record<string, number>>(Object.fromEntries((g?.rubric ?? []).map((r) => [r.criterionId, r.score])))
  const [feedback, setFeedback] = useState(g?.feedback ?? '')
  const [error, setError] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [missing, setMissing] = useState<string[]>([])
  const total = Object.values(scores).reduce((t, v) => t + v, 0)
  const nextAfterSave = queue.nextMemberId && queue.nextMemberId !== p.id ? queue.nextMemberId : null

  function build(): GradeInput | null {
    const number = (value: string, max: number) => {
      const v = Number(value)
      return value.trim() !== '' && Number.isFinite(v) && v >= 0 && v <= max && Math.round(v * 100) === v * 100 ? v : null
    }
    switch (a.gradingScale) {
      case 'points': {
        const v = number(points, a.maxPoints!)
        if (v === null) return (setError(`Enter a number from 0 to ${a.maxPoints}.`), null)
        return { points: v, feedback }
      }
      case 'percentage': {
        const v = number(percentage, 100)
        if (v === null) return (setError('Enter a number from 0 to 100.'), null)
        return { percentage: v, feedback }
      }
      case 'letter':
        if (!letter) return (setError('Choose a letter grade.'), null)
        return { letter, feedback }
      case 'pass_fail':
        if (!passed) return (setError('Choose Pass or Fail.'), null)
        return { passed: passed === 'pass', feedback }
      case 'rubric': {
        const unscored = a.criteria.filter((c) => !scores[c.id]).map((c) => c.id)
        if (unscored.length) return (setMissing(unscored), setError('Score every criterion.'), null)
        return {
          rubric: a.criteria.map((c) => ({
            criterionId: c.id,
            score: scores[c.id]!,
          })),
          feedback,
        }
      }
    }
  }

  async function submit(andNext: boolean) {
    setFailed(null)
    const input = build()
    if (!input) return
    try {
      await save.mutateAsync(input)
      onSaved(andNext ? nextAfterSave : null)
    } catch (err) {
      if (err instanceof ApiError && Array.isArray(err.details) && err.details.length) setError((err.details as { message: string }[])[0]!.message)
      else setFailed(err instanceof ApiError && err.status < 500 ? err.message : 'The grade wasn’t saved. Try again.')
    }
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    void submit(true)
  }
  const clear = () => setError(null)

  return (
    <Panel aria-labelledby="grade-title">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <PanelHeader id="grade-title" title="Grade" description={scaleHint(a)} />
        {failed && (
          <AlertBanner tone="error" title="Couldn’t save">
            {failed}
          </AlertBanner>
        )}
        {a.gradingScale === 'points' && (
          <TextField
            label="Points"
            type="number"
            inputMode="decimal"
            min={0}
            max={a.maxPoints ?? undefined}
            step="any"
            value={points}
            onChange={(e) => {
              setPoints(e.target.value)
              clear()
            }}
            error={error}
            helper={`Out of ${a.maxPoints}.`}
          />
        )}
        {a.gradingScale === 'percentage' && (
          <TextField
            label="Percentage"
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step="any"
            value={percentage}
            onChange={(e) => {
              setPercentage(e.target.value)
              clear()
            }}
            error={error}
            helper="0–100."
          />
        )}
        {a.gradingScale === 'letter' && (
          <LevelPicker
            label="Letter grade"
            options={LETTERS.map((l) => ({ value: l, label: l }))}
            value={letter}
            onChange={(v) => {
              setLetter(v)
              clear()
            }}
            error={error}
          />
        )}
        {a.gradingScale === 'pass_fail' && (
          <div className="flex flex-col gap-2">
            <span className="text-caption-strong text-primary">Result</span>
            <RadioGroup
              label="Result"
              options={[
                { value: 'pass', label: 'Pass' },
                { value: 'fail', label: 'Fail' },
              ]}
              value={passed as 'pass' | 'fail'}
              onChange={(v) => {
                setPassed(v)
                clear()
              }}
            />
            {error && <p className="text-caption text-error-fg">{error}</p>}
          </div>
        )}
        {a.gradingScale === 'rubric' && (
          <>
            <ol className="flex flex-col">
              {a.criteria.map((c) => (
                <li key={c.id} className="flex flex-col gap-2 border-b border-default py-3 first:pt-0">
                  <span className="flex flex-col">
                    <span className="text-body-strong text-primary">{c.title}</span>
                    {c.description && <span className="text-caption text-secondary">{c.description}</span>}
                  </span>
                  <LevelPicker
                    label={c.title}
                    hideLabel
                    options={[1, 2, 3, 4].map((n) => ({
                      value: n,
                      label: String(n),
                    }))}
                    value={scores[c.id] ?? null}
                    onChange={(v) => {
                      setScores((prev) => ({ ...prev, [c.id]: v }))
                      setMissing((prev) => prev.filter((m) => m !== c.id))
                      clear()
                    }}
                    error={missing.includes(c.id) ? 'Choose a score.' : null}
                  />
                </li>
              ))}
            </ol>
            <p className="flex items-baseline justify-between">
              <span className="text-body-strong text-primary">Total</span>
              <span className="text-metric-large text-primary tabular-nums">
                {total} / {a.criteria.length * 4}
              </span>
            </p>
            {error && (
              <p role="alert" className="text-caption text-error-fg">
                {error}
              </p>
            )}
          </>
        )}
        <TextAreaField
          label="Feedback"
          optional
          value={feedback}
          maxLength={5000}
          onChange={(e) => setFeedback(e.target.value)}
          helper={`${p.name.split(' ')[0]} sees this with the grade.`}
        />
        <div className="flex justify-end gap-3 max-md:flex-col-reverse max-md:[&>*]:h-11">
          <Button
            variant={nextAfterSave ? 'secondary' : 'primary'}
            type={nextAfterSave ? 'button' : 'submit'}
            onClick={nextAfterSave ? () => void submit(false) : undefined}
            disabled={save.isPending}
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
          {nextAfterSave && (
            <Button type="submit" disabled={save.isPending}>
              Save and grade next
            </Button>
          )}
        </div>
      </form>
    </Panel>
  )
}

/** Round 1–4 / A–F buttons (T6.04 rubric levels). */
function LevelPicker<T extends string | number>({
  label,
  hideLabel,
  options,
  value,
  onChange,
  error,
}: {
  label: string
  hideLabel?: boolean
  options: { value: T; label: string }[]
  value: T | null
  onChange: (value: T) => void
  error?: string | null
}) {
  return (
    <div className="flex flex-col gap-2">
      {!hideLabel && <span className="text-caption-strong text-primary">{label}</span>}
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={clsx(
              'flex size-9 items-center justify-center rounded-full border text-body-strong transition-colors focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none max-md:size-11',
              value === o.value ? 'border-brand bg-brand-subtle text-brand-text' : 'border-default bg-surface text-secondary hover:bg-surface-hover',
              error && value !== o.value && 'border-error',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {error && <p className="text-caption text-error-fg">{error}</p>}
    </div>
  )
}
