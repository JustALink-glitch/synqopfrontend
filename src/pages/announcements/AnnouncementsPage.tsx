import clsx from 'clsx'
import { Check, CheckCheck, Megaphone } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useLocation } from 'react-router'
import { useAuth } from '@/auth/useAuth'
import { StatePanel } from '@/components/StatePanel'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Choice'
import { Dialog } from '@/components/ui/Dialog'
import { Menu } from '@/components/ui/Menu'
import { Badge, EmptyState, PageHeader, Panel } from '@/components/ui/Page'
import { SelectField, TextAreaField, TextField } from '@/components/ui/TextField'
import { ApiError } from '@/lib/api'
import { formatTime, plural, relativeDay } from '@/lib/format'
import { initials } from '@/lib/people'
import type { Area } from '@/lib/roles'
import {
  audienceLabel,
  useAnnouncements,
  useDeleteAnnouncement,
  useEditAnnouncement,
  useMarkRead,
  usePostAnnouncement,
  type Announcement,
  type Audience,
  type AnnouncementsView,
} from './data'

const roleLabel: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  trainer: 'Trainer',
  assistant_trainer: 'Assistant trainer',
  participant: 'Participant',
}
const audienceName: Record<Audience, string> = {
  everyone: 'Everyone',
  staff: 'Staff (admins and trainers)',
  participants: 'All participants',
  cohort: 'One cohort',
}

const intro: Record<Area, string> = {
  admin: 'News for everyone, staff, participants or one cohort. People see it here and in their notifications.',
  trainer: 'News from your programme team, and announcements you post to the cohorts you teach.',
  participant: 'News from your programme team and trainers.',
}

type Errors = Partial<Record<'title' | 'body' | 'cohortId', string>>
const errorsOf = (error: unknown): Errors =>
  error instanceof ApiError && Array.isArray(error.details)
    ? Object.fromEntries((error.details as { field: string; message: string }[]).map((d) => [d.field, d.message]))
    : {}

/** /{area}/announcements — G1.03 Announcements, kept for everyone they reach; the bell links here. */
export function AnnouncementsPage({ area }: { area: Area }) {
  const query = useAnnouncements()
  const { state } = useAuth()
  const timeZone = state.status === 'signed-in' ? state.me.organisation?.timeZone : undefined
  const { hash } = useLocation()
  const [composing, setComposing] = useState(false)
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [deleting, setDeleting] = useState<Announcement | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const mark = useMarkRead()

  // Opened from a notification: bring that announcement into view.
  useEffect(() => {
    if (!hash || !query.data) return
    document.getElementById(`a-${hash.slice(1)}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [hash, query.data])

  const view = query.data
  return (
    <>
      <PageHeader
        title="Announcements"
        description={intro[area]}
        actions={
          <>
            {Boolean(view?.unread) && (
              <Button variant="secondary" icon={<CheckCheck aria-hidden className="size-4" />} disabled={mark.isPending} onClick={() => mark.mutate({ id: 'all', read: true })}>
                Mark all as read
              </Button>
            )}
            {view?.canPost && (
              <Button icon={<Megaphone aria-hidden className="size-4" />} onClick={() => setComposing(true)}>
                New announcement
              </Button>
            )}
          </>
        }
      />
      {notice && <AlertBanner tone="success" title={notice} />}
      {query.isPending ? (
        <Panel aria-busy="true" className="h-40">
          <span className="sr-only">Loading announcements</span>
        </Panel>
      ) : query.isError ? (
        <Panel>
          <StatePanel
            kind="error"
            title="Couldn’t load announcements"
            description="Check your connection and try again."
            action={{ label: 'Try again', onClick: () => void query.refetch() }}
          />
        </Panel>
      ) : view!.announcements.length === 0 ? (
        <Panel className="py-12">
          <EmptyState
            icon={<Megaphone aria-hidden className="size-6" />}
            title="No announcements yet"
            body={
              view!.canPost ? 'Post the first one. Everyone it reaches gets a notification.' : 'When your programme team or trainers post news, it shows here.'
            }
            actions={view!.canPost && <Button onClick={() => setComposing(true)}>New announcement</Button>}
          />
        </Panel>
      ) : (
        <ul className="flex flex-col gap-3">
          {view!.announcements.map((a) => (
            <li key={a.id} id={`a-${a.id}`}>
              <Panel
                aria-label={a.read ? a.title : `New: ${a.title}`}
                className={clsx('gap-3 scroll-mt-24', !a.read && 'border-l-4 border-l-[var(--color-brand)]', hash === `#${a.id}` && 'ring-2 ring-[var(--color-brand)]')}
              >
                <div className="flex items-start gap-3">
                  <Avatar size={40} seed={a.author?.id} initials={initials(...(a.author?.name.split(' ') ?? ['?']))} />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-body-strong text-primary">{a.author?.name ?? 'Former member'}</span>
                    <span className="text-caption text-secondary">
                      {[
                        a.author && roleLabel[a.author.role],
                        `${relativeDay(a.createdAt, timeZone)}, ${formatTime(a.createdAt, timeZone)}`,
                        a.edited && 'edited',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </div>
                  <Menu
                    label="More"
                    variant="link"
                    accessibleLabel={`More for ${a.title}`}
                    items={[
                      a.read ? { label: 'Mark as unread', onSelect: () => mark.mutate({ id: a.id, read: false }) } : { label: 'Mark as read', onSelect: () => mark.mutate({ id: a.id, read: true }) },
                      ...(a.can.edit
                        ? [
                            { label: 'Edit', onSelect: () => setEditing(a) },
                            { label: 'Delete', destructive: true, onSelect: () => setDeleting(a) },
                          ]
                        : []),
                    ]}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {!a.read && <Badge tone="info">New</Badge>}
                  <Badge tone="neutral">{audienceLabel(a)}</Badge>
                  {a.important && <Badge tone="warning">Important</Badge>}
                </div>
                <h2 className="text-heading-section text-primary">{a.title}</h2>
                <p className="text-body whitespace-pre-line text-primary">{a.body}</p>
                {!a.read && (
                  <div>
                    <Button variant="secondary" icon={<Check aria-hidden className="size-4" />} disabled={mark.isPending} onClick={() => mark.mutate({ id: a.id, read: true })}>
                      Mark as read
                    </Button>
                  </div>
                )}
              </Panel>
            </li>
          ))}
        </ul>
      )}
      {view && composing && (
        <Composer
          view={view}
          onClose={() => setComposing(false)}
          onPosted={(reached, emailed) => {
            setComposing(false)
            setNotice(`Posted. ${plural(reached, 'person was', 'people were')} notified${emailed ? `, ${emailed} by email` : ''}.`)
          }}
        />
      )}
      {editing && <EditDialog announcement={editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <DeleteDialog
          announcement={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null)
            setNotice('Announcement deleted.')
          }}
        />
      )}
    </>
  )
}

function Composer({ view, onClose, onPosted }: { view: AnnouncementsView; onClose: () => void; onPosted: (reached: number, emailed: number) => void }) {
  const post = usePostAnnouncement()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState<Audience>(view.audiences[0] ?? 'cohort')
  const [cohortId, setCohortId] = useState(view.audiences.length === 1 ? (view.cohorts[0]?.id ?? '') : '')
  const [important, setImportant] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [problem, setProblem] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const next: Errors = {}
    if (!title.trim()) next.title = 'Add a title.'
    if (!body.trim()) next.body = 'Write your announcement.'
    if (audience === 'cohort' && !cohortId) next.cohortId = 'Choose a cohort.'
    setErrors(next)
    if (Object.keys(next).length) return
    setProblem(null)
    try {
      const res = await post.mutateAsync({ title: title.trim(), body: body.trim(), audience, cohortId: audience === 'cohort' ? cohortId : null, important })
      onPosted(res.reached, res.emailed)
    } catch (error) {
      setErrors(errorsOf(error))
      if (!Object.keys(errorsOf(error)).length) setProblem(error instanceof ApiError ? error.message : 'Couldn’t post it. Try again.')
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="New announcement"
      description="Everyone it reaches gets a notification and push. Email goes only when you mark it important."
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="announcement-form" disabled={post.isPending}>
            {post.isPending ? 'Posting…' : 'Post'}
          </Button>
        </>
      }
    >
      <form id="announcement-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        {problem && <AlertBanner tone="error" title={problem} />}
        <TextField
          label="Title"
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
          error={errors.title}
          placeholder="Holiday on Friday"
        />
        <TextAreaField label="Message" value={body} maxLength={4000} rows={6} className="h-36" onChange={(e) => setBody(e.target.value)} error={errors.body} />
        {view.audiences.length > 1 && (
          <SelectField label="Send to" value={audience} onChange={(e) => setAudience(e.target.value as Audience)}>
            {view.audiences.map((a) => (
              <option key={a} value={a}>
                {audienceName[a]}
              </option>
            ))}
          </SelectField>
        )}
        {audience === 'cohort' && (
          <SelectField
            label="Cohort"
            value={cohortId}
            onChange={(e) => setCohortId(e.target.value)}
            error={errors.cohortId}
            helper="Its participants and trainers, and the admins."
          >
            <option value="">Choose a cohort</option>
            {view.cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
        )}
        <Checkbox
          checked={important}
          onChange={(e) => setImportant(e.target.checked)}
          label={
            <span className="flex flex-col">
              <span className="text-body text-primary">Important</span>
              <span className="text-caption text-secondary">Also email everyone it reaches.</span>
            </span>
          }
        />
      </form>
    </Dialog>
  )
}

function EditDialog({ announcement: a, onClose }: { announcement: Announcement; onClose: () => void }) {
  const edit = useEditAnnouncement()
  const [title, setTitle] = useState(a.title)
  const [body, setBody] = useState(a.body)
  const [errors, setErrors] = useState<Errors>({})

  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      await edit.mutateAsync({ id: a.id, title: title.trim(), body: body.trim() })
      onClose()
    } catch (error) {
      setErrors({ title: 'Couldn’t save it. Try again.', ...errorsOf(error) })
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Edit announcement"
      description="Changes show straight away. People aren’t notified again."
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="edit-announcement" disabled={edit.isPending}>
            {edit.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="edit-announcement" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <TextField label="Title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} error={errors.title} />
        <TextAreaField label="Message" value={body} maxLength={4000} rows={6} className="h-36" onChange={(e) => setBody(e.target.value)} error={errors.body} />
      </form>
    </Dialog>
  )
}

function DeleteDialog({ announcement: a, onClose, onDeleted }: { announcement: Announcement; onClose: () => void; onDeleted: () => void }) {
  const remove = useDeleteAnnouncement()
  return (
    <Dialog
      open
      width={440}
      onClose={onClose}
      title="Delete this announcement?"
      description={`“${a.title}” is removed for everyone, including from their notifications. Emails already sent can’t be recalled.`}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate(a.id, { onSuccess: onDeleted })}>
            {remove.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </>
      }
    />
  )
}
