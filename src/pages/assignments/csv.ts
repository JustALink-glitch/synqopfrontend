import { downloadCsv } from '@/components/collection/selection'
import { formatDue, type AssignmentSummary } from './data'

/** The same CSV columns from the admin and trainer lists. */
export function assignmentsCsv(items: AssignmentSummary[], timeZone: string | undefined) {
  downloadCsv(
    'Assignments.csv',
    ['Assignment', 'Course', 'Cohort', 'Programme', 'Set by', 'Due', 'Status', 'Expected', 'Submitted', 'Late', 'Graded', 'To grade', 'Grading'],
    items.map((a) => [
      a.title,
      a.course.name,
      a.cohort.name,
      a.programme.name,
      a.setBy?.name ?? '',
      formatDue(a.dueAt, timeZone),
      a.status,
      a.counts.expected,
      a.counts.submitted,
      a.counts.late,
      a.counts.graded,
      a.counts.toGrade,
      a.scaleLabel,
    ]),
  )
}
