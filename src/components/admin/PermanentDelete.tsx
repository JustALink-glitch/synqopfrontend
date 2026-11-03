import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { TextField } from '@/components/ui/TextField'
import { api, ApiError } from '@/lib/api'
import { plural } from '@/lib/format'

type Kind = 'cohort' | 'programme' | 'course'
interface Check {
  name: string
  deletable: boolean
  recorded: string[]
  removes: { cohorts: number; courses: number; sessions: number; assignments: number; participants: number }
}

const base: Record<Kind, string> = { cohort: '/v1/cohorts', programme: '/v1/programmes', course: '/v1/courses' }
const home: Record<Kind, string> = { cohort: '/admin/cohorts', programme: '/admin/programmes', course: '/admin/courses/library' }

/**
 * "Delete permanently" (pilot feedback, Nov 2026). Only while nothing has been recorded: once there's attendance,
 * submitted work, reports, follow-ups, outcomes or certificates, archiving is the only option, so reports keep their history.
 */
export function PermanentDeleteSection({ kind, id }: { kind: Kind; id: string }) {
  const check = useQuery({
    queryKey: ['delete-check', kind, id],
    queryFn: ({ signal }) => api<Check>(`${base[kind]}/${id}/delete-check`, { signal }),
  })
  const [open, setOpen] = useState(false)
  const d = check.data
  return (
    <div className="flex items-start gap-4 rounded-md border border-error/40 p-4 max-md:flex-col">
      <div className="flex flex-1 flex-col gap-0.5">
        <h2 className="text-body-strong text-primary">Delete {kind} permanently</h2>
        <p className="text-caption text-secondary">
          {d && !d.deletable
            ? `It has ${d.recorded.join(', ')}, so it can’t be deleted. Archive it instead: reports keep its history.`
            : 'For something set up by mistake. Only possible while nothing has been recorded: no attendance, submitted work, reports or certificates.'}
        </p>
      </div>
      <Button variant="destructive" disabled={!d?.deletable} onClick={() => setOpen(true)}>
        Delete permanently
      </Button>
      {open && d && <DeleteDialog kind={kind} id={id} check={d} onClose={() => setOpen(false)} />}
    </div>
  )
}

function DeleteDialog({ kind, id, check, onClose }: { kind: Kind; id: string; check: Check; onClose: () => void }) {
  const client = useQueryClient()
  const navigate = useNavigate()
  const [typed, setTyped] = useState('')
  const [failed, setFailed] = useState<string | null>(null)
  const remove = useMutation({ mutationFn: () => api(`${base[kind]}/${id}`, { method: 'DELETE' }) })
  const r = check.removes
  const goes = [
    kind === 'programme' && r.cohorts && plural(r.cohorts, 'cohort'),
    kind !== 'course' && r.courses && kind === 'programme' && plural(r.courses, 'course'),
    r.sessions && plural(r.sessions, 'scheduled session'),
    r.assignments && plural(r.assignments, 'assignment'),
  ].filter(Boolean)
  const matches = typed.trim().toLowerCase() === check.name.trim().toLowerCase()

  async function confirm() {
    setFailed(null)
    try {
      await remove.mutateAsync()
      await client.invalidateQueries()
      navigate(home[kind], { state: { deleted: check.name } })
    } catch (e) {
      setFailed(e instanceof ApiError && e.status < 500 ? e.message : 'It wasn’t deleted. Try again.')
    }
  }

  return (
    <Dialog
      open
      onClose={() => !remove.isPending && onClose()}
      width={440}
      title={`Delete ${check.name}?`}
      description="This can’t be undone."
      actions={
        <>
          <Button variant="secondary" onClick={onClose} disabled={remove.isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={!matches || remove.isPending}>
            {remove.isPending ? 'Deleting…' : 'Delete permanently'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {failed && <AlertBanner tone="error" title={failed} />}
        <p className="text-body text-secondary">
          {goes.length ? `This also deletes ${goes.join(', ')}. ` : ''}
          {kind === 'course'
            ? 'It’s removed from every cohort that runs it.'
            : r.participants
              ? `${plural(r.participants, 'participant')} will no longer be in ${kind === 'cohort' ? 'this cohort' : 'its cohorts'}. Their accounts stay.`
              : ''}
        </p>
        <TextField label={`Type ${check.name} to confirm`} value={typed} autoComplete="off" onChange={(e) => setTyped(e.target.value)} />
      </div>
    </Dialog>
  )
}
