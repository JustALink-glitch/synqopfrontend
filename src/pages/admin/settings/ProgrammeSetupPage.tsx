import type { FormEvent } from 'react'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Checkbox } from '@/components/ui/Choice'
import { useProgrammeSetup, useSaveProgrammeSetup, type GradingScale, type ProgrammeSetup } from './data'
import { RadioList, SaveBar, SettingRow, SettingsLoader, SettingsSection } from './SettingsBits'
import { SettingsTitle } from './SettingsLayout'
import { useSettingsForm } from './settingsForm'

const assistantAbilities: { key: keyof ProgrammeSetup['assistantCan']; label: string }[] = [
  { key: 'attendance', label: 'Take and edit attendance' },
  { key: 'resources', label: 'Add resources' },
  { key: 'grade', label: 'Grade submissions' },
  { key: 'assignments', label: 'Create and edit assignments' },
  { key: 'reports', label: 'Submit session reports' },
]

const scales: { value: GradingScale; label: string }[] = [
  { value: 'points', label: 'Points (e.g. 78 / 100)' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'letter', label: 'Letter grade (A–F)' },
  { value: 'pass_fail', label: 'Pass / fail' },
  { value: 'rubric', label: 'Rubric (criteria × levels)' },
]

/** /admin/settings/programme-setup — F1.04 Programme setup. */
export function ProgrammeSetupPage() {
  const query = useProgrammeSetup()
  return (
    <>
      <SettingsTitle title="Programme setup" description="Organisations run programmes differently. Choose how yours works." />
      <SettingsLoader query={query}>{(data) => <SetupForm settings={data.settings} />}</SettingsLoader>
    </>
  )
}

function SetupForm({ settings }: { settings: ProgrammeSetup }) {
  const save = useSaveProgrammeSetup()
  const form = useSettingsForm(settings)
  const { draft, set, errors } = form

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!draft.gradingScales.length) return form.setErrors({ gradingScales: 'Allow at least one scale.' })
    await form.save(async () => (await save.mutateAsync(draft)).settings, {
      tone: 'success',
      title: 'Programme setup saved',
      body: 'The changes apply straight away, across every programme and cohort.',
    })
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {form.notice ? (
        <AlertBanner tone={form.notice.tone} title={form.notice.title}>
          {form.notice.body}
        </AlertBanner>
      ) : (
        <AlertBanner tone="info" title="These choices shape every programme">
          Changes apply straight away to every programme and cohort. Trainers you’ve already assigned keep their courses.
        </AlertBanner>
      )}

      <SettingsSection title="Courses" description="How courses relate to programmes and cohorts.">
        <RadioList
          label="Where courses live"
          value={draft.courseLibrary}
          onChange={(courseLibrary) => set({ courseLibrary })}
          options={[
            {
              value: 'shared',
              label: 'Shared course library per programme',
              help: 'Courses are created once in the programme. Each cohort reuses them and can add or drop courses.',
            },
            {
              value: 'per_cohort',
              label: 'Separate courses for each cohort',
              help: 'Every cohort builds its own course list, even within the same programme.',
            },
          ]}
        />
      </SettingsSection>

      <SettingsSection title="Trainers" description="How trainers are assigned.">
        <RadioList
          label="Assign trainers"
          value={draft.trainerAssignment}
          onChange={(trainerAssignment) => set({ trainerAssignment })}
          options={[
            { value: 'course', label: 'To each course within a cohort', help: 'Different trainers can teach different courses in the same cohort.' },
            { value: 'cohort', label: 'To the whole cohort', help: 'One trainer delivers every course in the cohort.' },
          ]}
        />
        <SettingRow
          title="Allow assistant trainers"
          description="A course or cohort can have a lead trainer plus assistants."
          on={draft.assistantsEnabled}
          onToggle={(assistantsEnabled) => set({ assistantsEnabled })}
        />
        {draft.assistantsEnabled && (
          <fieldset className="flex flex-col gap-2.5 py-3.5 pl-3">
            <legend className="pb-1 text-body-strong text-primary">What assistant trainers can do</legend>
            <p className="pb-1 text-caption text-secondary">Applies to every assistant. Lead trainers can always do all of these.</p>
            {assistantAbilities.map((a) => (
              <Checkbox
                key={a.key}
                label={a.label}
                checked={draft.assistantCan[a.key]}
                onChange={(e) => set({ assistantCan: { ...draft.assistantCan, [a.key]: e.target.checked } })}
              />
            ))}
          </fieldset>
        )}
      </SettingsSection>

      <SettingsSection title="Participants">
        <SettingRow
          title="Allow a participant in more than one cohort"
          description="For example, the weekday and weekend fellowship at the same time."
          on={draft.multiCohort}
          onToggle={(multiCohort) => set({ multiCohort })}
        />
      </SettingsSection>

      <SettingsSection title="Grading" description="Trainers choose a scale per assignment from the ones you allow.">
        <fieldset className="flex flex-col gap-2.5 py-3.5" aria-describedby={errors.gradingScales ? 'scales-error' : undefined}>
          <legend className="pb-1 text-body-strong text-primary">Allowed grading scales</legend>
          {scales.map((s) => (
            <Checkbox
              key={s.value}
              label={s.label}
              checked={draft.gradingScales.includes(s.value)}
              onChange={(e) =>
                set({
                  gradingScales: e.target.checked
                    ? scales.map((x) => x.value).filter((v) => v === s.value || draft.gradingScales.includes(v))
                    : draft.gradingScales.filter((v) => v !== s.value),
                })
              }
            />
          ))}
          {errors.gradingScales && (
            <p id="scales-error" className="text-caption text-error-fg">
              {errors.gradingScales}
            </p>
          )}
        </fieldset>
      </SettingsSection>

      <SettingsSection title="Feedback">
        <SettingRow
          title="Ask participants for feedback after each session"
          description="Optional for participants: a 1–5 rating and a comment."
          on={draft.feedbackEnabled}
          onToggle={(feedbackEnabled) => set({ feedbackEnabled })}
        />
        <SettingRow title="Require a session report from trainers" description="Always on. Questions are set in Session reports." always />
      </SettingsSection>

      <SaveBar changed={form.changed} saving={save.isPending} onDiscard={form.discard} />
    </form>
  )
}
