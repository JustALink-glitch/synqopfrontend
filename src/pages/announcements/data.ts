import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type Audience = 'everyone' | 'staff' | 'participants' | 'cohort'

export interface Announcement {
  id: string
  title: string
  body: string
  important: boolean
  audience: Audience
  cohort: { id: string; name: string } | null
  author: { id: string; name: string; role: string } | null
  createdAt: string
  edited: boolean
  read: boolean
  can: { edit: boolean }
}

export interface AnnouncementsView {
  unread: number
  announcements: Announcement[]
  canPost: boolean
  audiences: Audience[]
  cohorts: { id: string; name: string }[]
}

export interface NewAnnouncement {
  title: string
  body: string
  audience: Audience
  cohortId: string | null
  important: boolean
}

const key = ['announcements']

export const useAnnouncements = () => useQuery({ queryKey: key, queryFn: ({ signal }) => api<AnnouncementsView>('/v1/announcements', { signal }) })

export function usePostAnnouncement() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: NewAnnouncement) => api<{ announcement: Announcement; reached: number; emailed: number }>('/v1/announcements', { method: 'POST', body }),
    onSuccess: () => client.invalidateQueries({ queryKey: key }),
  })
}

export function useEditAnnouncement() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; title: string; body: string }) =>
      api<{ announcement: Announcement }>(`/v1/announcements/${id}`, { method: 'PATCH', body }),
    onSuccess: () => client.invalidateQueries({ queryKey: key }),
  })
}

export function useDeleteAnnouncement() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<null>(`/v1/announcements/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: key })
      void client.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

/** The menu badge: checks every minute and when the tab comes back into view. */
export const useUnreadAnnouncements = () =>
  useQuery({
    queryKey: [...key, 'unread'],
    queryFn: ({ signal }) => api<{ unread: number }>('/v1/announcements/unread', { signal }),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })

export function useMarkRead() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, read }: { id: string | 'all'; read: boolean }) =>
      api<{ unread: number }>(id === 'all' ? '/v1/announcements/read-all' : `/v1/announcements/${id}/read`, { method: read ? 'POST' : 'DELETE' }),
    onSuccess: (data, { id, read }) => {
      client.setQueryData([...key, 'unread'], data)
      client.setQueryData<AnnouncementsView>(key, (old) =>
        old ? { ...old, unread: data.unread, announcements: old.announcements.map((a) => (id === 'all' || a.id === id ? { ...a, read } : a)) } : old,
      )
      void client.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export const audienceLabel = (a: Pick<Announcement, 'audience' | 'cohort'>) =>
  a.audience === 'everyone'
    ? 'Everyone'
    : a.audience === 'staff'
      ? 'Staff'
      : a.audience === 'participants'
        ? 'All participants'
        : (a.cohort?.name ?? 'A cohort')
