import clsx from 'clsx'
import { Check, CheckCheck, Megaphone } from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import { useAuth } from '@/auth/useAuth'
import { StatePanel } from '@/components/StatePanel'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Choice'
import { Dialog } from '@/components/ui/Dialog'
import { Menu } from '@/components/ui/Menu'
import { EmptyState, PageHeader, Panel } from '@/components/ui/Page'
import { TabButtons } from '@/components/ui/Tabs'
import { SelectField, TextAreaField, TextField } from '@/components/ui/TextField'
import { ApiError } from '@/lib/api'
import { formatTime, plural, relativeDay, timeAgo } from '@/lib/format'
import { initials } from '@/lib/people'
import type { Area } from '@/lib/roles'
import {
  audienceLabel,
  useAnnouncements,
  useDeleteAnnouncement,
  useEditAnnouncement,
  useMarkRead,
  usePostAnnouncement,
  useRecordSeen,
  useViewers,
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
  const [viewers, setViewers] = useState<Announcement | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const mark = useMarkRead()
  // Count a view once a card is actually on screen (not your own posts).
  const me = state.status === 'signed-in' ? state.me.membership.id : undefined
  useRecordSeen((query.data?.announcements ?? []).filter((a) => a.author?.id !== me).map((a) => a.id))

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
              <Button
                variant="secondary"
                icon={<CheckCheck aria-hidden className="size-4" />}
                disabled={mark.isPending}
                onClick={() => mark.mutate({ id: 'all', read: true })}
              >
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
        <ul className="flex flex-col gap-4">
          {view!.announcements.map((a) => (
            <AnnouncementCard
              key={a.id}
              a={a}
              timeZone={timeZone}
              highlighted={hash === `#${a.id}`}
              busy={mark.isPending}
              onRead={(read) => mark.mutate({ id: a.id, read })}
              onEdit={() => setEditing(a)}
              onDelete={() => setDeleting(a)}
              onViewers={() => setViewers(a)}
            />
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
      {viewers && <ViewersDialog announcement={viewers} timeZone={timeZone} onClose={() => setViewers(null)} />}
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

const LONG = 420

/**
 * One announcement as a post (pilot feedback, Nov 2026): the title leads, then who posted it and when, the audience as
 * a tag, and the message. The author and admins see who has seen it, bottom right.
 */
function AnnouncementCard({
  a,
  timeZone,
  highlighted,
  busy,
  onRead,
  onEdit,
  onDelete,
  onViewers,
}: {
  a: Announcement
  timeZone?: string
  highlighted: boolean
  busy: boolean
  onRead: (read: boolean) => void
  onEdit: () => void
  onDelete: () => void
  onViewers: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const long = a.body.length > LONG || a.body.split('\n').length > 6
  const seen = a.seenBy
  return (
    <li id={`a-${a.id}`} data-seen-id={a.id} className="scroll-mt-24">
      <article
        aria-label={a.read ? a.title : `New: ${a.title}`}
        className={clsx(
          'flex flex-col gap-4 rounded-2xl border bg-surface p-6 max-md:gap-3 max-md:p-4',
          highlighted ? 'border-brand ring-2 ring-[var(--color-brand)]' : 'border-default',
        )}
      >
        <div className="flex items-start gap-3">
          <h2 className="min-w-0 flex-1 text-[22px] leading-7 font-bold tracking-[-0.01em] text-primary max-md:text-[19px] max-md:leading-6">
            {!a.read && <span className="mr-2 inline-block size-2.5 -translate-y-[3px] rounded-full bg-brand" role="img" aria-label="New" />}
            {a.title}
          </h2>
          <span className="-mt-1 -mr-2 shrink-0">
            <Menu
              label="More"
              variant="icon"
              accessibleLabel={`More for ${a.title}`}
              items={[
                a.read ? { label: 'Mark as unread', onSelect: () => onRead(false) } : { label: 'Mark as read', onSelect: () => onRead(true) },
                ...(a.seenBy ? [{ label: 'Who has seen it', onSelect: onViewers }] : []),
                ...(a.can.edit
                  ? [
                      { label: 'Edit', onSelect: onEdit },
                      { label: 'Delete', destructive: true, onSelect: onDelete },
                    ]
                  : []),
              ]}
            />
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="flex min-w-0 flex-1 items-center gap-2.5">
            <Avatar size={40} seed={a.author?.id} initials={initials(...(a.author?.name.split(' ') ?? ['?']))} />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-body-strong text-primary">{a.author?.name ?? 'Former member'}</span>
              <span className="truncate text-caption text-secondary" title={`${relativeDay(a.createdAt, timeZone)}, ${formatTime(a.createdAt, timeZone)}`}>
                {[a.author && roleLabel[a.author.role], timeAgo(a.createdAt, timeZone), a.edited && 'edited'].filter(Boolean).join(' · ')}
              </span>
            </span>
          </span>
          <span className="flex flex-wrap gap-1.5">
            {a.important && <Tag tone="warning">Important</Tag>}
            <Tag tone="brand">{audienceLabel(a)}</Tag>
          </span>
        </div>

        <div className="flex flex-col items-start gap-1">
          <p className={clsx('text-body leading-6 whitespace-pre-line text-primary', long && !expanded && 'line-clamp-5')}>{a.body}</p>
          {long && (
            <button type="button" onClick={() => setExpanded((v) => !v)} className="text-body-strong text-brand-text hover:underline">
              {expanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </div>

        {(!a.read || seen) && (
          <div className="flex flex-wrap items-center gap-3">
            {!a.read && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onRead(true)}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-subtle px-3 text-caption-strong text-primary transition-colors hover:bg-surface-hover focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none disabled:text-disabled"
              >
                <Check aria-hidden className="size-3.5" />
                Mark as read
              </button>
            )}
            {seen && (
              <button
                type="button"
                onClick={onViewers}
                className="ml-auto inline-flex h-8 items-center gap-2 rounded-full pr-1 pl-3 text-caption-strong text-secondary transition-colors hover:bg-surface-subtle hover:text-primary focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none"
              >
                {seen.count ? `Seen by ${plural(seen.count, 'person', 'people')}` : 'Not seen yet'}
                {seen.recent.length > 0 && (
                  <span className="flex -space-x-2" aria-hidden>
                    {seen.recent.map((p) => (
                      <Avatar key={p.id} size={24} seed={p.id} initials={initials(...p.name.split(' '))} className="ring-2 ring-[var(--color-surface)]" />
                    ))}
                    {seen.count > seen.recent.length && (
                      <span className="inline-flex size-6 items-center justify-center rounded-full bg-neutral-bg text-[10px] font-semibold text-neutral-fg ring-2 ring-[var(--color-surface)]">
                        +{seen.count - seen.recent.length}
                      </span>
                    )}
                  </span>
                )}
              </button>
            )}
          </div>
        )}
      </article>
    </li>
  )
}

function Tag({ tone, children }: { tone: 'brand' | 'warning'; children: ReactNode }) {
  return (
    <span
      className={clsx(
        'inline-flex h-6 max-w-[220px] items-center truncate rounded-md px-2.5 text-caption-strong',
        tone === 'brand' ? 'bg-brand-subtle text-brand-text' : 'bg-warning-bg text-warning-fg',
      )}
    >
      {children}
    </span>
  )
}

/** Who has and hasn't seen an announcement, for its author and admins. Loaded only when opened. */
function ViewersDialog({ announcement: a, timeZone, onClose }: { announcement: Announcement; timeZone?: string; onClose: () => void }) {
  const query = useViewers(a.id)
  const [tab, setTab] = useState<'seen' | 'notSeen'>('seen')
  const list = query.data?.[tab] ?? []
  const total = query.data ? query.data.seen.length + query.data.notSeen.length : 0
  return (
    <Dialog
      open
      width={440}
      onClose={onClose}
      title="Who has seen it"
      description={query.data ? `“${a.title}” · sent to ${plural(total, 'person', 'people')}, ${query.data.seen.length} seen it so far.` : `“${a.title}”`}
      actions={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {query.isPending ? (
        <div aria-busy="true" className="h-40">
          <span className="sr-only">Loading</span>
        </div>
      ) : query.isError ? (
        <StatePanel
          kind="error"
          title="Couldn’t load this"
          description="Check your connection and try again."
          action={{ label: 'Try again', onClick: () => void query.refetch() }}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <TabButtons
            label="Seen or not"
            value={tab}
            onChange={setTab}
            items={[
              { value: 'seen' as const, label: `Seen (${query.data.seen.length})` },
              { value: 'notSeen' as const, label: `Not yet (${query.data.notSeen.length})` },
            ]}
          />
          {list.length === 0 ? (
            <p className="py-6 text-center text-body text-secondary">{tab === 'seen' ? 'Nobody has seen it yet.' : 'Everyone it was sent to has seen it.'}</p>
          ) : (
            <ul className="-mx-1 flex max-h-[50dvh] flex-col overflow-y-auto px-1">
              {list.map((p) => (
                <li key={p.id} className="flex items-center gap-3 border-b border-default py-2.5 last:border-b-0">
                  <Avatar size={32} seed={p.id} initials={initials(...p.name.split(' '))} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-body-strong text-primary">{p.name}</span>
                    <span className="truncate text-caption text-secondary">{roleLabel[p.role] ?? p.role}</span>
                  </span>
                  {'at' in p && <span className="shrink-0 text-caption text-secondary">{timeAgo(p.at as string, timeZone)}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Dialog>
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
