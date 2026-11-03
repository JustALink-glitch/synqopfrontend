import clsx from 'clsx'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { ChevronRightIcon, DownloadIcon } from '@/components/ui/icons'
import { Badge, Panel, PanelHeader } from '@/components/ui/Page'
import { api } from '@/lib/api'
import { downloadFile, fileKind, fileSize } from '@/lib/files'
import { ResourceDialog, type NewResource } from '@/pages/admin/sessions/ResourcesPanel'

interface CourseResource {
  id: string
  kind: 'file' | 'link'
  name: string
  url: string | null
  size: number | null
  type: string | null
  visible: boolean
  addedBy: string | null
  library: boolean
  canRemove: boolean
}

const key = (id: string) => ['cohort-course-resources', id] as const

/**
 * Resources for a whole course in one cohort, added without opening a session (pilot feedback, Nov 2026).
 * Every session of the course shows them to participants.
 */
export function CourseResourcesPanel({ cohortCourseId, courseName, cohortName }: { cohortCourseId: string; courseName: string; cohortName: string }) {
  const client = useQueryClient()
  const query = useQuery({
    queryKey: key(cohortCourseId),
    queryFn: ({ signal }) => api<{ canAdd: boolean; resources: CourseResource[] }>(`/v1/cohort-courses/${cohortCourseId}/resources`, { signal }),
  })
  const refresh = () => client.invalidateQueries({ queryKey: key(cohortCourseId) })
  const add = useMutation({
    mutationFn: (input: NewResource) => api(`/v1/cohort-courses/${cohortCourseId}/resources`, { method: 'POST', body: input }),
    onSuccess: refresh,
  })
  const remove = useMutation({
    mutationFn: (id: string) => api(`/v1/cohort-courses/${cohortCourseId}/resources/${id}`, { method: 'DELETE' }),
    onSuccess: refresh,
  })
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; title: string } | null>(null)
  const list = query.data?.resources ?? []
  const canAdd = query.data?.canAdd ?? false

  async function open(r: CourseResource) {
    try {
      if (r.kind === 'link' && r.url) window.open(r.url, '_blank', 'noopener')
      else await downloadFile(`/v1/cohort-courses/${cohortCourseId}/resources/${r.id}`)
    } catch {
      setNotice({ tone: 'error', title: `Couldn’t open ${r.name}. Try again.` })
    }
  }

  return (
    <Panel className="gap-0">
      <div className="flex items-start justify-between gap-3">
        <PanelHeader title={`${courseName} resources`} description="For the whole course. Every session shows them to participants." />
        {canAdd && (
          <button
            type="button"
            onClick={() => (setNotice(null), setAdding(true))}
            className="inline-flex h-7 shrink-0 items-center gap-1 text-caption-strong text-brand-text hover:underline"
          >
            Add resource
            <ChevronRightIcon size={14} />
          </button>
        )}
      </div>
      {notice && (
        <div className="pt-3">
          <AlertBanner tone={notice.tone} title={notice.title} />
        </div>
      )}
      {query.isPending ? (
        <p className="py-3 text-body text-secondary">Loading…</p>
      ) : query.isError ? (
        <p className="py-3 text-body text-error-fg">Resources didn’t load. Refresh to try again.</p>
      ) : list.length === 0 ? (
        <p className="py-3 text-body text-secondary">
          {canAdd ? 'Nothing yet. Add slides, notes or links for the whole course.' : 'Nothing has been added yet.'}
        </p>
      ) : (
        <ul className="mt-1">
          {list.map((r) => (
            <li key={r.id} className="flex items-center gap-2 border-b border-default last:border-b-0">
              <button
                type="button"
                onClick={() => void open(r)}
                className="flex min-w-0 flex-1 items-center gap-3 py-3 text-left hover:bg-surface-hover focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-body-strong text-primary">{r.name}</span>
                    {r.library && <Badge tone="neutral">Course library</Badge>}
                  </span>
                  <span className="text-caption text-secondary md:truncate">
                    {[
                      r.kind === 'link' ? 'Link' : [fileKind(r.name, r.type), r.size !== null ? fileSize(r.size) : null].filter(Boolean).join(' · '),
                      r.addedBy && `added by ${r.addedBy}`,
                      !r.visible && 'hidden from participants',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                {r.kind === 'file' ? (
                  <DownloadIcon size={16} className="shrink-0 text-icon-muted" />
                ) : (
                  <ChevronRightIcon size={16} className="shrink-0 text-icon-muted" />
                )}
              </button>
              {r.canRemove && (
                <button
                  type="button"
                  disabled={remove.isPending}
                  onClick={() =>
                    remove.mutate(r.id, {
                      onSuccess: () => setNotice({ tone: 'success', title: `${r.name} removed` }),
                      onError: () => setNotice({ tone: 'error', title: `${r.name} wasn’t removed. Try again.` }),
                    })
                  }
                  className={clsx('h-7 shrink-0 px-1 text-caption-strong text-error-fg hover:underline disabled:opacity-50')}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {adding && (
        <ResourceDialog
          description={`For ${courseName} in ${cohortName}. Every session of the course shows it.`}
          uploadsEndpoint={`/v1/cohort-courses/${cohortCourseId}/resources/uploads`}
          add={(input) => add.mutateAsync(input)}
          onClose={() => setAdding(false)}
          onAdded={(name) => {
            setAdding(false)
            setNotice({ tone: 'success', title: `${name} added` })
          }}
        />
      )}
    </Panel>
  )
}
