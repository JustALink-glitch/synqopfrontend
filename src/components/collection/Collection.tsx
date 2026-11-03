import clsx from 'clsx'
import { LayoutGrid, List, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Menu } from '@/components/ui/Menu'
import { Avatar } from '@/components/ui/Avatar'
import { initials } from '@/lib/people'
import { SelectBox } from '@/components/ui/Table'
import { TextField } from '@/components/ui/TextField'
import { plural } from '@/lib/format'
import type { BulkOutcome, Selection } from './selection'
import type { Layout } from './layout'
import { accentFor } from './accent'

export function LayoutSwitch({ value, onChange }: { value: Layout; onChange: (l: Layout) => void }) {
  const options = [
    {
      value: 'list' as const,
      label: 'List view',
      icon: <List aria-hidden className="size-4" />,
    },
    {
      value: 'grid' as const,
      label: 'Grid view',
      icon: <LayoutGrid aria-hidden className="size-4" />,
    },
  ]
  return (
    <div role="group" aria-label="Layout" className="inline-flex h-9 shrink-0 self-end rounded-md border border-default bg-surface p-0.5 md:self-auto">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          aria-label={o.label}
          title={o.label}
          onClick={() => onChange(o.value)}
          className={clsx(
            'inline-flex w-9 items-center justify-center rounded-[5px] transition-colors focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none',
            value === o.value ? 'bg-brand-subtle text-brand-text' : 'text-secondary hover:text-primary',
          )}
        >
          {o.icon}
        </button>
      ))}
    </div>
  )
}

export interface BulkAction {
  label: string
  icon?: ReactNode
  destructive?: boolean
  /** Ask first: title and what will happen. */
  confirm?: {
    title: string
    body: ReactNode
    button: string
    /** Must be typed to continue (permanent deletes). */ typed?: string
  }
  run: () => Promise<BulkOutcome | void>
}

/**
 * Shows when rows are ticked: how many, the bulk actions, and Clear. Destructive actions ask first;
 * the result says what was done and what was skipped, and why.
 */
export function BulkBar({ selection, noun, actions }: { selection: Selection; noun: [string, string]; actions: BulkAction[] }) {
  const [asking, setAsking] = useState<BulkAction | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<BulkOutcome | null>(null)
  const [typed, setTyped] = useState('')

  async function go(action: BulkAction) {
    setAsking(null)
    setTyped('')
    setBusy(action.label)
    setOutcome(null)
    try {
      const result = await action.run()
      if (result) {
        setOutcome(result)
        if (result.done.length) selection.clear()
      }
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      {outcome && <OutcomeBanner outcome={outcome} noun={noun} onClose={() => setOutcome(null)} />}
      {selection.count > 0 && (
        <div
          role="region"
          aria-label="Bulk actions"
          className="sticky top-[calc(var(--topbar-height)+8px)] z-10 flex flex-wrap items-center gap-2 rounded-lg border border-brand bg-brand-subtle px-3 py-2 shadow-[var(--shadow-overlay)]"
        >
          <span className="text-body-strong text-brand-text" aria-live="polite">
            {plural(selection.count, noun[0], noun[1])} selected
          </span>
          <button
            type="button"
            onClick={selection.clear}
            className="inline-flex items-center gap-1 rounded-sm px-1 text-caption-strong text-secondary hover:text-primary"
          >
            <X aria-hidden className="size-3.5" />
            Clear
          </button>
          <div className="flex-1" />
          {actions.map((a) => (
            <Button
              key={a.label}
              variant={a.destructive ? 'destructive' : 'secondary'}
              icon={a.icon}
              disabled={busy !== null}
              onClick={() => (a.confirm ? setAsking(a) : void go(a))}
            >
              {busy === a.label ? 'Working…' : a.label}
            </Button>
          ))}
        </div>
      )}
      {asking?.confirm && (
        <Dialog
          open
          width={440}
          onClose={() => setAsking(null)}
          title={asking.confirm.title}
          description={asking.confirm.body}
          actions={
            <>
              <Button variant="secondary" onClick={() => setAsking(null)}>
                Cancel
              </Button>
              <Button
                variant={asking.destructive ? 'destructive' : 'primary'}
                disabled={Boolean(asking.confirm.typed) && typed.trim().toLowerCase() !== asking.confirm.typed!.toLowerCase()}
                onClick={() => void go(asking)}
              >
                {asking.confirm.button}
              </Button>
            </>
          }
        >
          {asking.confirm.typed && (
            <TextField label={`Type “${asking.confirm.typed}” to confirm`} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          )}
        </Dialog>
      )}
    </>
  )
}

function OutcomeBanner({ outcome: o, noun, onClose }: { outcome: BulkOutcome; noun: [string, string]; onClose: () => void }) {
  const tone = o.skipped.length === 0 ? 'success' : o.done.length === 0 ? 'error' : 'warning'
  const title = o.done.length
    ? `${o.action}: ${plural(o.done.length, noun[0], noun[1])}${o.skipped.length ? `, ${o.skipped.length} skipped` : ''}`
    : `${o.action}: nothing changed`
  return (
    <AlertBanner tone={tone} title={title}>
      {o.skipped.length > 0 && (
        <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-4">
          {o.skipped.slice(0, 8).map((s) => (
            <li key={s.name}>
              <span className="font-medium">{s.name}</span>: {s.reason}
            </li>
          ))}
          {o.skipped.length > 8 && <li>…and {o.skipped.length - 8} more.</li>}
        </ul>
      )}
      <button type="button" onClick={onClose} className="mt-1 text-caption-strong underline">
        Dismiss
      </button>
    </AlertBanner>
  )
}

/** The ⋯ menu at the end of a row or card. */
export function RowActions({ label, items }: { label: string; items: { label: string; onSelect: () => void; destructive?: boolean }[] }) {
  if (!items.length) return null
  return <Menu variant="icon" label="Actions" accessibleLabel={`Actions for ${label}`} items={items} />
}

export function CardGrid({ children, label }: { children: ReactNode; label: string }) {
  return (
    <ul aria-label={label} className="grid grid-cols-3 gap-3 max-xl:grid-cols-2 max-md:grid-cols-1">
      {children}
    </ul>
  )
}

export interface CardMeta {
  icon: ReactNode
  text: ReactNode
  label?: string
}

/**
 * One item in grid view (card style from the Flowdesk reference): a coloured dot and the name, ⋯ on the right,
 * a two-line description, a status pill, an optional progress bar, then people and small facts along the bottom.
 * The name is the link and stretches over the card; the tick box (shown on hover, or once anything is ticked) and
 * ⋯ menu sit above it as separate controls.
 */
export function ItemCard({
  to,
  title,
  description,
  badge,
  accent,
  leading,
  progress,
  people,
  meta,
  footer,
  select,
  actions,
  selecting,
}: {
  to: string
  title: string
  description?: ReactNode
  badge?: ReactNode
  /** Dot colour; defaults to one picked from the link. */
  accent?: string
  /** Replaces the dot (e.g. a person's photo). */
  leading?: ReactNode
  progress?: { label: string; value: number | null; text?: string }
  people?: { id: string; name: string }[]
  meta?: CardMeta[]
  footer?: ReactNode
  select?: { checked: boolean; onChange: () => void }
  actions?: ReactNode
  /** Something on the page is ticked: show every box. */
  selecting?: boolean
}) {
  const value = progress?.value === null || progress?.value === undefined ? null : Math.max(0, Math.min(100, progress.value))
  return (
    <li
      className={clsx(
        'group relative flex flex-col gap-3 rounded-xl border bg-surface p-5 shadow-[var(--shadow-raised)] transition-colors',
        select?.checked ? 'border-brand ring-1 ring-[var(--color-brand)]' : 'border-default hover:border-strong',
      )}
    >
      <div className="flex items-center gap-2.5">
        {select && (
          <span
            className={clsx(
              'relative z-[1] flex transition-opacity',
              !select.checked &&
                !selecting &&
                'md:w-0 md:overflow-hidden md:opacity-0 md:group-focus-within:w-auto md:group-focus-within:opacity-100 md:group-hover:w-auto md:group-hover:opacity-100',
            )}
          >
            <SelectBox checked={select.checked} onChange={select.onChange} label={`Select ${title}`} />
          </span>
        )}
        {leading ?? <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: accent ?? accentFor(to) }} />}
        <Link
          to={to}
          className="min-w-0 flex-1 truncate text-[15px] leading-5 font-semibold text-primary after:absolute after:inset-0 after:rounded-xl after:content-[''] hover:underline focus-visible:outline-none focus-visible:after:shadow-[var(--shadow-focus)]"
        >
          {title}
        </Link>
        <span className="relative z-[1] -my-1 -mr-2 shrink-0">{actions}</span>
      </div>
      {description && <p className="line-clamp-2 min-h-9 text-body text-secondary">{description}</p>}
      {badge && <div className="flex flex-wrap gap-1.5">{badge}</div>}
      {progress && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-caption">
            <span className="text-secondary">{progress.label}</span>
            <span className="font-semibold text-primary tabular-nums">{progress.text ?? (value === null ? '—' : `${value}%`)}</span>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-chart-track"
            role="progressbar"
            aria-label={progress.label}
            aria-valuenow={value ?? undefined}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-full rounded-full bg-brand" style={{ width: `${value ?? 0}%` }} />
          </div>
        </div>
      )}
      {(people?.length || meta?.length || footer) && (
        <div className="mt-auto flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 pt-1 text-caption text-secondary">
          {people && people.length > 0 && (
            <span className="flex -space-x-1.5" aria-label={people.map((p) => p.name).join(', ')}>
              {people.slice(0, 3).map((p) => (
                <Avatar key={p.id} size={24} initials={initials(p.name)} seed={p.id} className="ring-2 ring-[var(--color-surface)]" />
              ))}
              {people.length > 3 && (
                <span className="inline-flex size-6 items-center justify-center rounded-full bg-neutral-bg text-[10px] font-semibold text-neutral-fg ring-2 ring-[var(--color-surface)]">
                  +{people.length - 3}
                </span>
              )}
            </span>
          )}
          {meta?.map((m, i) => (
            <span key={i} className="inline-flex min-w-0 items-center gap-1" title={m.label}>
              <span className="shrink-0 text-icon [&>svg]:size-3.5">{m.icon}</span>
              <span className="truncate">{m.text}</span>
            </span>
          ))}
          {footer}
        </div>
      )}
    </li>
  )
}
