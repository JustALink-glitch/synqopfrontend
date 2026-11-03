import clsx from 'clsx'
import { LayoutGrid, List, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Menu } from '@/components/ui/Menu'
import { SelectBox } from '@/components/ui/Table'
import { TextField } from '@/components/ui/TextField'
import { plural } from '@/lib/format'
import type { BulkOutcome, Selection } from './selection'
import type { Layout } from './layout'

export function LayoutSwitch({ value, onChange }: { value: Layout; onChange: (l: Layout) => void }) {
  const options = [
    { value: 'list' as const, label: 'List view', icon: <List aria-hidden className="size-4" /> },
    { value: 'grid' as const, label: 'Grid view', icon: <LayoutGrid aria-hidden className="size-4" /> },
  ]
  return (
    <div role="group" aria-label="Layout" className="inline-flex h-9 shrink-0 rounded-md border border-default bg-surface p-0.5">
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
  confirm?: { title: string; body: ReactNode; button: string; /** Must be typed to continue (permanent deletes). */ typed?: string }
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

/**
 * One item in grid view: a tick box and ⋯ menu along the top, the name (a link), a badge, then a few facts.
 * The whole card isn't a link, so the box and menu stay separate controls.
 */
export function ItemCard({
  to,
  title,
  subtitle,
  badge,
  leading,
  facts,
  footer,
  select,
  actions,
}: {
  to: string
  title: string
  subtitle?: ReactNode
  badge?: ReactNode
  leading?: ReactNode
  facts?: { label: string; value: ReactNode }[]
  footer?: ReactNode
  select?: { checked: boolean; onChange: () => void }
  actions?: ReactNode
}) {
  return (
    <li
      className={clsx(
        'relative flex flex-col gap-3 rounded-lg border bg-surface p-4 transition-colors',
        select?.checked ? 'border-brand bg-brand-subtle/30' : 'border-default hover:border-strong',
      )}
    >
      <div className="flex items-start gap-3">
        {select && (
          <span className="relative z-[1] pt-0.5">
            <SelectBox checked={select.checked} onChange={select.onChange} label={`Select ${title}`} />
          </span>
        )}
        {leading}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Link
            to={to}
            className="truncate text-body-strong text-primary after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:underline focus-visible:outline-none"
          >
            {title}
          </Link>
          {subtitle && <span className="truncate text-caption text-secondary">{subtitle}</span>}
        </div>
        {/* Above the card-wide link. */}
        <span className="relative z-[1] -mt-1 -mr-1">{actions}</span>
      </div>
      {badge && <div className="flex flex-wrap gap-1.5">{badge}</div>}
      {facts && facts.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
          {facts.map((f) => (
            <div key={f.label} className="flex min-w-0 flex-col">
              <dt className="truncate text-caption text-secondary">{f.label}</dt>
              <dd className="truncate text-body-strong text-primary tabular-nums">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {footer && <div className="border-t border-default pt-3 text-caption text-secondary">{footer}</div>}
    </li>
  )
}
