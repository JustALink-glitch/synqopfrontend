import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatDay, plural } from '@/lib/format'

export type Rule = 'low_attendance' | 'missed_in_row' | 'overdue_assignments' | 'inactive' | 'low_grade'
export type Method = 'call' | 'email' | 'message' | 'visit' | 'other'
export type Outcome = 'awaiting_response' | 'reached' | 'resolved' | 'no_response'

export interface Flag {
  id: string
  rule: Rule
  details: Record<string, unknown>
  raisedAt: string
}

export interface Rules {
  attendance: { enabled: boolean; belowPct: number }
  missedInRow: { enabled: boolean; count: number }
  overdue: { enabled: boolean; count: number }
  inactivity: { enabled: boolean; days: number }
  grade: { enabled: boolean; belowPct: number }
}

export interface FlaggedRow {
  enrolmentId: string
  participant: { id: string; name: string }
  cohort: { id: string; name: string }
  flags: Flag[]
  lastIntervention: { method: Method; outcome: Outcome; at: string; by: string | null; reviewOn: string | null } | null
}

export interface InterventionEntry {
  id: string
  method: Method
  outcome: Outcome
  at: string
  notes: string | null
  reviewOn: string | null
  by: { name: string; trainer: boolean } | null
}

export interface ParticipantAttention {
  timeZone: string
  enrolmentId: string
  cohort: { id: string; name: string }
  canResolve: boolean
  flags: Flag[]
  nextReview: string | null
  interventions: InterventionEntry[]
}

const keys = { all: ['attention'] as const }

export const useAttention = () =>
  useQuery({
    queryKey: [...keys.all, 'list'],
    queryFn: ({ signal }) => api<{ timeZone: string; rules: Rules; canResolve: boolean; participants: FlaggedRow[] }>('/v1/attention', { signal }),
  })

export const useAttentionCount = (enabled: boolean) =>
  useQuery({
    enabled,
    queryKey: [...keys.all, 'count'],
    queryFn: ({ signal }) => api<{ count: number }>('/v1/attention/count', { signal }),
    staleTime: 60_000,
  })

export const useInterventions = () =>
  useQuery({
    queryKey: [...keys.all, 'interventions'],
    queryFn: ({ signal }) =>
      api<{ timeZone: string; interventions: (InterventionEntry & { participant: { id: string; name: string }; cohort: string })[] }>(
        '/v1/attention/interventions',
        { signal },
      ),
  })

export const useParticipantAttention = (memberId: string, enabled = true) =>
  useQuery({
    enabled,
    queryKey: [...keys.all, 'participant', memberId],
    queryFn: ({ signal }) => api<ParticipantAttention>(`/v1/attention/participants/${memberId}`, { signal }),
    retry: (count, error) => (error as { status?: number }).status !== 404 && count < 2,
  })

function useAttentionMutation<TInput, TResult>(fn: (input: TInput) => Promise<TResult>) {
  const client = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => client.invalidateQueries({ queryKey: keys.all, refetchType: 'all' }) })
}

export interface InterventionInput {
  method: Method
  date: string
  time: string
  notes: string
  outcome: Outcome
  reviewOn: string | null
}

export const useRecordIntervention = (memberId: string) =>
  useAttentionMutation((input: InterventionInput) =>
    api<{ intervention: { id: string } }>(`/v1/attention/participants/${memberId}/interventions`, { method: 'POST', body: input }),
  )

export const useResolveFlags = (memberId: string) =>
  useAttentionMutation((note: string) => api<{ resolved: number }>(`/v1/attention/participants/${memberId}/resolve`, { method: 'POST', body: { note } }))

/** Several participants at once (pilot feedback, Nov 2026): one note on every flag it closes. */
export const useResolveMany = () =>
  useAttentionMutation((input: { memberIds: string[]; note: string }) =>
    api<{ resolved: number; participants: number }>('/v1/attention/participants/resolve', { method: 'POST', body: input }),
  )

/** The same follow-up recorded for each of several participants. */
export const useRecordMany = () =>
  useAttentionMutation(async ({ memberIds, input }: { memberIds: string[]; input: InterventionInput }) => {
    const failed: string[] = []
    for (const id of memberIds) {
      try {
        await api(`/v1/attention/participants/${id}/interventions`, { method: 'POST', body: input })
      } catch {
        failed.push(id)
      }
    }
    return { saved: memberIds.length - failed.length, failed }
  })

export type Signal = 'attendance' | 'assignments' | 'activity'
export const signalOf: Record<Rule, Signal> = {
  low_attendance: 'attendance',
  missed_in_row: 'attendance',
  overdue_assignments: 'assignments',
  low_grade: 'assignments',
  inactive: 'activity',
}
export const signalLabel: Record<Signal, string> = { attendance: 'Attendance', assignments: 'Assignments', activity: 'Activity' }
export const ruleLabel: Record<Rule, string> = {
  low_attendance: 'Attendance',
  missed_in_row: 'Attendance',
  overdue_assignments: 'Assignments',
  low_grade: 'Grades',
  inactive: 'Activity',
}

export const methodLabel: Record<Method, string> = { call: 'Phone call', email: 'Email', message: 'Message', visit: 'In person', other: 'Other' }
const methodPast: Record<Method, string> = { call: 'Called', email: 'Emailed', message: 'Messaged', visit: 'Met', other: 'Contacted' }
export const outcomeLabel: Record<Outcome, string> = {
  awaiting_response: 'Awaiting response',
  reached: 'Reached',
  resolved: 'Resolved',
  no_response: 'No response',
}
export const outcomeTone = { awaiting_response: 'neutral', reached: 'info', resolved: 'success', no_response: 'warning' } as const satisfies Record<
  Outcome,
  string
>

const num = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0))
const days = (v: unknown, timeZone?: string) => (Array.isArray(v) ? (v as string[]).map((d) => formatDay(d, timeZone)) : [])
const list = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`)

/** What a flag says, in the words D1.01 uses: a title and one line of evidence. */
export function describeFlag(f: Flag, timeZone?: string): { title: string; detail: string } {
  const d = f.details
  switch (f.rule) {
    case 'low_attendance':
      return {
        title: `Attendance ${num(d.attendancePct)}%`,
        detail: `${num(d.present)} of ${plural(num(d.recorded), 'session')} · below the ${num(d.threshold)}% threshold`,
      }
    case 'missed_in_row':
      return {
        title: `Missed ${num(d.missed)} sessions in a row`,
        detail: d.lastPresentAt ? `Last attended ${formatDay(String(d.lastPresentAt), timeZone)}` : list(days(d.dates, timeZone).reverse()),
      }
    case 'overdue_assignments':
      return { title: `${plural(num(d.count), 'assignment')} overdue`, detail: list((d.titles as string[] | undefined) ?? []) }
    case 'inactive':
      return {
        title: `No activity for ${num(d.days)} days`,
        detail: d.lastSignInAt ? `Last signed in ${formatDay(String(d.lastSignInAt), timeZone)}` : 'Hasn’t signed in yet',
      }
    case 'low_grade':
      return {
        title: `Average grade ${num(d.averagePct)}%`,
        detail: `Across ${plural(num(d.graded), 'graded assignment')} · below the ${num(d.threshold)}% threshold`,
      }
  }
}

/** "Called 17 Oct · Reached" (D1.01 follow-up column). */
export function followUpLine(i: FlaggedRow['lastIntervention'], timeZone?: string): string {
  if (!i) return 'Not contacted yet'
  return `${methodPast[i.method]} ${formatDay(i.at, timeZone).replace(/^\w+ /, '')} · ${outcomeLabel[i.outcome]}`
}

/** The provisional rules in one sentence (D1.01 banner). */
export function rulesSentence(r: Rules): string {
  const parts = [
    r.attendance.enabled && `attendance is below ${r.attendance.belowPct}%`,
    r.missedInRow.enabled && `${r.missedInRow.count}+ sessions are missed in a row`,
    r.overdue.enabled && (r.overdue.count > 1 ? `${r.overdue.count}+ assignments are overdue` : 'work is overdue'),
    r.grade.enabled && `the average grade is below ${r.grade.belowPct}%`,
    r.inactivity.enabled && `there is no activity for ${r.inactivity.days}+ days`,
  ].filter(Boolean) as string[]
  const joined = parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} or ${parts.at(-1)}`
  return parts.length ? `Flagged when ${joined}.` : 'All rules are switched off.'
}

/** Today's date and the current time in a time zone, for the intervention form defaults. */
export function nowIn(timeZone?: string): { date: string; time: string } {
  const now = new Date()
  const date = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  const time = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(now)
  return { date, time }
}
