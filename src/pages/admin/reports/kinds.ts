export type Kind = 'cohort_summary' | 'programme_summary' | 'attendance' | 'assignments' | 'feedback'

export const kinds: { value: Kind; label: string; description: string; cohort: 'required' | 'optional' | 'none' }[] = [
  {
    value: 'cohort_summary',
    label: 'Cohort summary',
    description: 'Enrolment, attendance, assignment completion, feedback and Needs attention for one cohort.',
    cohort: 'required',
  },
  { value: 'programme_summary', label: 'Programme summary', description: 'The same measures across every cohort in a programme.', cohort: 'none' },
  { value: 'attendance', label: 'Attendance', description: 'Session-by-session attendance with present, excused and absent counts.', cohort: 'required' },
  { value: 'assignments', label: 'Assignments and grades', description: 'Submission and grading status per assignment.', cohort: 'required' },
  { value: 'feedback', label: 'Feedback', description: 'Post-session feedback, aggregated by session and trainer.', cohort: 'optional' },
]
