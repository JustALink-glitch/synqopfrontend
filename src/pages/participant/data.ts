import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Criterion, Scale, SubmissionType } from '@/pages/assignments/data'
import type { Certificate, CohortRef, CompletionStatus, Criterion as CompletionCriterion } from '@/pages/admin/completion/data'

export type MyStatus = 'not_submitted' | 'overdue' | 'closed' | 'submitted' | 'late' | 'graded'

export interface MyAssignment {
  id: string
  title: string
  course: { id: string; name: string }
  cohort: { id: string; name: string }
  trainer: string | null
  dueAt: string
  status: MyStatus
  submittedAt: string | null
  gradingScale: Scale
  maxPoints: number | null
  scaleLabel: string
  grade: string | null
  gradedAt: string | null
}

export interface MyAssignmentDetail extends MyAssignment {
  brief: string | null
  submissionTypes: SubmissionType[]
  latePolicy: 'accept_late' | 'closed'
  links: { name: string; url: string }[]
  files: { id: string; name: string; size: number }[]
  criteria: Criterion[]
  canSubmit: boolean
  cantSubmitBecause: 'graded' | 'replace_closed' | 'closed' | 'enrolment' | null
}

export interface MySubmission {
  submittedAt: string
  late: boolean
  text: string | null
  link: string | null
  note: string | null
  files: { id: string; name: string; size: number; type: string | null }[]
}

export interface MyGrade {
  display: string | null
  feedback: string | null
  rubric: { criterionId: string; score: number }[]
  gradedAt: string
  gradedBy: string | null
}

export type SubmitInput =
  | { type: 'file'; file: { path: string; name: string }; note: string }
  | { type: 'link'; link: string; note: string }
  | { type: 'text'; text: string; note: string }

const keys = { all: ['my'] as const }

export function useMyAssignments() {
  return useQuery({
    queryKey: [...keys.all, 'assignments'],
    queryFn: ({ signal }) => api<{ timeZone: string; assignments: MyAssignment[] }>('/v1/my/assignments', { signal }),
  })
}

export function useMyAssignment(id: string) {
  return useQuery({
    queryKey: [...keys.all, 'assignment', id],
    queryFn: ({ signal }) =>
      api<{ timeZone: string; assignment: MyAssignmentDetail; submission: MySubmission | null; grade: MyGrade | null }>(`/v1/my/assignments/${id}`, { signal }),
    retry: (count, error) => (error as { status?: number }).status !== 404 && count < 2,
  })
}

export function useMyGrades() {
  return useQuery({
    queryKey: [...keys.all, 'grades'],
    queryFn: ({ signal }) =>
      api<{ timeZone: string; grades: (MyAssignment & { hasFeedback: boolean; feedback: string | null; gradedBy: string | null })[] }>('/v1/my/grades', {
        signal,
      }),
  })
}

export function useSubmit(id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: SubmitInput) => api<{ ok: true; late: boolean }>(`/v1/my/assignments/${id}/submission`, { method: 'PUT', body: input }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.all, refetchType: 'all' }),
  })
}

export const myStatusLabel: Record<MyStatus, string> = {
  not_submitted: 'Not submitted',
  overdue: 'Overdue',
  closed: 'Overdue',
  submitted: 'Submitted',
  late: 'Submitted late',
  graded: 'Graded',
}

export const myStatusTone = {
  not_submitted: 'neutral',
  overdue: 'error',
  closed: 'error',
  submitted: 'info',
  late: 'warning',
  graded: 'success',
} as const satisfies Record<MyStatus, string>

/** "A file or a link", "A file, a link or text" (P5.02 Details). */
export function submitWays(types: SubmissionType[]): string {
  const words = types.map((t) => ({ file: 'a file', link: 'a link', text: 'text' })[t])
  const sentence = words.length > 1 ? `${words.slice(0, -1).join(', ')} or ${words.at(-1)}` : (words[0] ?? '')
  return sentence.charAt(0).toUpperCase() + sentence.slice(1)
}

/** "Points, out of 100", "Rubric, out of 12" (P5.02 Details). */
export function gradingWords(a: { gradingScale: Scale; maxPoints: number | null; criteria: Criterion[] }): string {
  switch (a.gradingScale) {
    case 'points':
      return `Points, out of ${a.maxPoints}`
    case 'percentage':
      return 'Percentage'
    case 'letter':
      return 'Letter grade, A to F'
    case 'pass_fail':
      return 'Pass / Fail'
    case 'rubric':
      return `Rubric, out of ${a.criteria.length * 4}`
  }
}

/** Due in the next `days` days (and not yet past). */
export function dueWithinDays(at: string, days: number): boolean {
  const left = new Date(at).getTime() - Date.now()
  return left > 0 && left < days * 24 * 3600 * 1000
}

// ── Part 2: dashboard, courses, sessions, settings ──────────────────────────

export type MySessionStatus = 'scheduled' | 'in_progress' | 'held' | 'cancelled'
export type MyMark = 'present' | 'absent' | 'excused'

export interface MySession {
  id: string
  course: { id: string; name: string; cohortCourseId: string }
  cohort: { id: string; name: string }
  startsAt: string
  endsAt: string
  status: MySessionStatus
  mode: 'online' | 'in_person'
  location: string | null
  joinUrl: string | null
  cancellationReason: string | null
  /** The class recording, when the organisation shares recordings (pilot feedback, Nov 2026). */
  recording?: { url: string; passcode: string | null; minutes: number | null } | null
  trainer: string | null
  trainerBio?: string | null
  number: number | null
  total: number
  attendance: {
    status: MyMark
    source: 'zoom' | 'manual' | 'edited' | null
    joinedAt: string | null
    minutesInMeeting: number | null
    note: string | null
  } | null
}

export interface MyAttendance {
  present: number
  excused: number
  recorded: number
  rate: number | null
}

export interface MyResource {
  id: string
  kind: 'file' | 'link'
  name: string
  url: string | null
  size: number | null
  type?: string | null
}

export interface MyOverview {
  timeZone: string
  enrolment: { status: string; cohort: { id: string; name: string; startsOn: string; endsOn: string; status: string }; programme: string } | null
  deferred: { cohort: string; since: string } | null
  nextSession: MySession | null
  upcoming: MySession[]
  attendance: MyAttendance
  recentAttendance: MySession[]
  progress: { held: number; total: number }
}

export interface MyCourse {
  id: string
  name: string
  cohort: { id: string; name: string }
  programme: string
  trainer: string | null
  where: string | null
  attendance: MyAttendance
  work: { submitted: number; published: number } | null
  nextSession: MySession | null
}

const retry404 = (count: number, error: unknown) => (error as { status?: number }).status !== 404 && count < 2

export const useMyOverview = () => useQuery({ queryKey: [...keys.all, 'overview'], queryFn: ({ signal }) => api<MyOverview>('/v1/my/overview', { signal }) })

export const useMySessions = () =>
  useQuery({
    queryKey: [...keys.all, 'sessions'],
    queryFn: ({ signal }) => api<{ timeZone: string; attendance: MyAttendance; sessions: MySession[] }>('/v1/my/sessions', { signal }),
  })

export const useMySession = (id: string) =>
  useQuery({
    queryKey: [...keys.all, 'session', id],
    queryFn: ({ signal }) =>
      api<{
        timeZone: string
        session: MySession
        resources: MyResource[]
        feedback: { canRate: boolean; mine: { rating: number; comment: string | null } | null }
      }>(`/v1/my/sessions/${id}`, { signal }),
    retry: retry404,
  })

export const useMyCourses = () =>
  useQuery({ queryKey: [...keys.all, 'courses'], queryFn: ({ signal }) => api<{ timeZone: string; courses: MyCourse[] }>('/v1/my/courses', { signal }) })

export const useMyCourse = (id: string) =>
  useQuery({
    queryKey: [...keys.all, 'course', id],
    queryFn: ({ signal }) =>
      api<{
        timeZone: string
        course: { id: string; name: string; cohort: { id: string; name: string }; trainer: { id: string; name: string; bio?: string | null } | null }
        attendance: MyAttendance
        sessions: MySession[]
        resources: MyResource[]
      }>(`/v1/my/courses/${id}`, { signal }),
    retry: retry404,
  })

export interface NotificationPreference {
  event: string
  label: string
  when: string
  email: boolean
  inApp: boolean
}

export const useNotificationPreferences = () =>
  useQuery({
    queryKey: ['me', 'notification-preferences'],
    queryFn: ({ signal }) => api<{ preferences: NotificationPreference[]; digestTime?: string }>('/v1/me/notification-preferences', { signal }),
  })

/** "Online, Zoom", "Online", or the room. */
export function sessionWhere(s: Pick<MySession, 'mode' | 'location' | 'joinUrl'>): string {
  if (s.mode === 'in_person') return s.location ?? 'In person'
  return s.joinUrl?.includes('zoom.us') ? 'Online, Zoom' : 'Online'
}

/** "2h 02m" from minutes. */
export const duration = (minutes: number) => `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`

/** "Saturday, 24 October 2026" for today in a time zone (P2.01 header). */
export function todayLong(timeZone?: string): string {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone }).format(new Date())
}

/** Whole days from today (organisation-local) until a date like "2026-11-02". */
export function daysUntil(isoDate: string, timeZone?: string): number {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  return Math.round((Date.parse(`${isoDate}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000)
}

export function useRateSession(id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { rating: number; comment: string }) => api<{ ok: true }>(`/v1/my/sessions/${id}/feedback`, { method: 'PUT', body: input }),
    onSuccess: () => client.invalidateQueries({ queryKey: [...keys.all, 'session', id] }),
  })
}

/** P7.01 Progress against the completion rule. */
export interface MyProgress {
  organisation: string
  timeZone: string
  progress: {
    cohort: CohortRef
    status: CompletionStatus
    requiresApproval: boolean
    attendance: CompletionCriterion
    submissions: CompletionCriterion
    grade: CompletionCriterion
    review: { decision: 'completed' | 'not_completed'; at: string; by: string | null } | null
    certificate: { id: string; issuedAt: string } | null
  } | null
}

export const useMyProgress = () => useQuery({ queryKey: [...keys.all, 'progress'], queryFn: ({ signal }) => api<MyProgress>('/v1/my/progress', { signal }) })

export const useMyCertificate = () =>
  useQuery({
    queryKey: [...keys.all, 'certificate'],
    queryFn: ({ signal }) => api<{ timeZone: string; certificate: Certificate }>('/v1/my/certificate', { signal }),
    retry: retry404,
  })
