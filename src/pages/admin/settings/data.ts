import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { CompletionRule } from '@/pages/admin/completion/data'
import type { Rules } from '@/pages/admin/attention/data'

export interface CompletionSettings extends CompletionRule {
  signedBy: string
  certificateTitle: string
  defaultOutcomes: string[]
  organisation: string
  sample: { name: string; programme: string; cohort: string; endsOn: string } | null
}

export interface AttentionRuleSettings extends Rules {
  trainersSee: boolean
  clearAutomatically: boolean
  trainersCanResolve: boolean
  flaggedNow: number
}

const keys = { all: ['settings'] as const }

export const useCompletionSettings = () =>
  useQuery({ queryKey: [...keys.all, 'completion'], queryFn: ({ signal }) => api<{ settings: CompletionSettings }>('/v1/settings/completion', { signal }) })

export const useAttentionRuleSettings = () =>
  useQuery({
    queryKey: [...keys.all, 'attention-rules'],
    queryFn: ({ signal }) => api<{ settings: AttentionRuleSettings }>('/v1/settings/attention-rules', { signal }),
  })

/** Saves and puts the server's answer straight into the cache, so the form keeps what was saved. */
function useSave<T>(path: string, key: string, related: string[][]) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: T) => api<{ settings: T }>(path, { method: 'PUT', body }),
    onSuccess: (data) => {
      client.setQueryData([...keys.all, key], data)
      for (const queryKey of related) void client.invalidateQueries({ queryKey, refetchType: 'all' })
    },
  })
}

export const useSaveCompletionSettings = () => useSave<CompletionSettings>('/v1/settings/completion', 'completion', [['completion'], ['programmes'], ['my']])
export const useSaveAttentionRules = () => useSave<AttentionRuleSettings>('/v1/settings/attention-rules', 'attention-rules', [['attention']])

export interface ReportSettingsQuestion {
  id: string | null
  prompt: string
  multiple: boolean
  options: string[]
}

export interface ReportSettings {
  dueHours: number
  remind: boolean
  overdueOnOverview: boolean
  questions: ReportSettingsQuestion[]
}

export const useReportSettings = () =>
  useQuery({
    queryKey: [...keys.all, 'session-reports'],
    queryFn: ({ signal }) => api<{ settings: ReportSettings }>('/v1/settings/session-reports', { signal }),
  })

export const useSaveReportSettings = () => useSave<ReportSettings>('/v1/settings/session-reports', 'session-reports', [['reports'], ['sessions']])

export interface OrganisationSettings {
  name: string
  type: string | null
  country: string | null
  timeZone: string
  owner: string | null
  createdAt: string
}

export const useOrganisationSettings = () =>
  useQuery({
    queryKey: [...keys.all, 'organisation'],
    queryFn: ({ signal }) => api<{ settings: OrganisationSettings }>('/v1/settings/organisation', { signal }),
  })

export const useSaveOrganisationSettings = () =>
  useSave<Pick<OrganisationSettings, 'name' | 'type' | 'country' | 'timeZone'>>('/v1/settings/organisation', 'organisation', [['overview'], ['sessions']])

export type GradingScale = 'points' | 'percentage' | 'letter' | 'pass_fail' | 'rubric'

export interface ProgrammeSetup {
  courseLibrary: 'shared' | 'per_cohort'
  trainerAssignment: 'course' | 'cohort'
  assistantsEnabled: boolean
  assistantCan: { attendance: boolean; resources: boolean; grade: boolean; assignments: boolean; reports: boolean }
  multiCohort: boolean
  gradingScales: GradingScale[]
  feedbackEnabled: boolean
}

export const useProgrammeSetup = () =>
  useQuery({
    queryKey: [...keys.all, 'programme-setup'],
    queryFn: ({ signal }) => api<{ settings: ProgrammeSetup }>('/v1/settings/programme-setup', { signal }),
  })

export const useSaveProgrammeSetup = () => useSave<ProgrammeSetup>('/v1/settings/programme-setup', 'programme-setup', [['assignments'], ['sessions']])

export interface AttendanceSettings {
  zoom: { available: boolean; connected: boolean; email: string | null; connectedAt: string | null; problem: string | null; lastImportAt: string | null
    /** Licensed Zoom users Synqop can host classes on at the same time. */
    hosts?: number
    /** Features waiting for the admin to connect again and approve new permissions (Nov 2026). */
    missing?: ('recordings' | 'hosts' | 'start')[] }
  joinLinks: 'personal' | 'shared'
  presentMinPct: number
  late: { enabled: boolean; minutes: number }
  recordings: { shared: boolean; days: number }
  inPersonReminder: { enabled: boolean; hours: number }
}

export const useAttendanceSettings = () =>
  useQuery({
    queryKey: [...keys.all, 'attendance'],
    queryFn: ({ signal }) => api<{ settings: AttendanceSettings }>('/v1/settings/attendance', { signal }),
  })

export const useSaveAttendanceSettings = () => useSave<Omit<AttendanceSettings, 'zoom'>>('/v1/settings/attendance', 'attendance', [['sessions']])

export type ExportPart = 'people' | 'attendance' | 'assignments' | 'files' | 'reports' | 'interventions'

export interface DataExport {
  id: string
  status: 'queued' | 'running' | 'ready' | 'failed' | 'expired'
  parts: ExportPart[]
  includes: string
  requestedAt: string
  requestedBy: string | null
  completedAt: string | null
  expiresAt: string | null
  sizeBytes: number | null
  fileName: string | null
}

export interface PrivacyView {
  organisation: string
  timeZone: string
  canManage: boolean
  exports: DataExport[]
  deletion: { scheduledFor: string; requestedAt: string; requestedBy: string | null } | null
}

const privacyKey = [...keys.all, 'privacy']

export const usePrivacy = () =>
  useQuery({
    queryKey: privacyKey,
    queryFn: ({ signal }) => api<PrivacyView>('/v1/privacy', { signal }),
    // While an export is being prepared, check every few seconds.
    refetchInterval: (query) => (query.state.data?.exports.some((e) => e.status === 'queued' || e.status === 'running') ? 3000 : false),
  })

export function useRequestExport() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (parts: ExportPart[]) => api<{ export: { id: string } }>('/v1/privacy/exports', { method: 'POST', body: { parts } }),
    onSuccess: () => client.invalidateQueries({ queryKey: privacyKey }),
  })
}

/** Schedules or cancels deletion; the answer is the new view. Everything else reloads (read-only banner). */
export function useDeletion() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { confirmName: string } | null) =>
      api<Omit<PrivacyView, 'canManage'>>(
        '/v1/privacy/deletion',
        input ? { method: 'POST', body: { exported: true, confirmName: input.confirmName } } : { method: 'DELETE' },
      ),
    onSuccess: (data) => client.setQueryData<PrivacyView>(privacyKey, (old) => (old ? { ...old, ...data } : old)),
  })
}

/** F1.07 Starts Zoom's approval screen; Zoom sends the browser back to this page. */
export const useConnectZoom = () => useMutation({ mutationFn: () => api<{ url: string }>('/v1/zoom/connect', { method: 'POST' }) })

export function useCompleteZoom() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: { code: string; state: string }) => api<{ connected: true; email: string }>('/v1/zoom/complete', { method: 'POST', body }),
    onSuccess: () => client.invalidateQueries({ queryKey: [...keys.all, 'attendance'] }),
  })
}

export function useDisconnectZoom() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => api<null>('/v1/zoom/connection', { method: 'DELETE' }),
    onSuccess: () => client.invalidateQueries({ queryKey: [...keys.all, 'attendance'] }),
  })
}
