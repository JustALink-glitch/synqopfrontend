import clsx from 'clsx'
import { MoreHorizontal } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDownIcon, ChevronRightIcon } from './icons'

/** A button that opens a short list of actions (like the account menu, G1.03). */
export function Menu({
  label,
  items,
  align = 'right',
  variant = 'button',
  accessibleLabel,
}: {
  label: string
  items: { label: string; onSelect: () => void; destructive?: boolean; icon?: ReactNode }[]
  align?: 'left' | 'right'
  /** "link": a small text trigger for table rows ("Edit ›", F1.02). */
  variant?: 'button' | 'link' | 'icon'
  /** Spoken name when the visible label isn't enough ("Edit Femi Johnson"). */
  accessibleLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const wrapper = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapper} className="relative" onClick={(e) => e.stopPropagation()}>
      {variant === 'icon' ? (
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={accessibleLabel ?? label}
          title={label}
          onClick={() => setOpen((value) => !value)}
          className="inline-flex size-8 items-center justify-center rounded-md text-icon hover:bg-surface-hover focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none"
        >
          <MoreHorizontal aria-hidden className="size-[18px]" />
        </button>
      ) : variant === 'link' ? (
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={accessibleLabel}
          onClick={() => setOpen((value) => !value)}
          className="inline-flex h-8 items-center gap-0.5 rounded-sm px-1 text-body-strong text-brand-text hover:underline focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none"
        >
          {label}
          <ChevronRightIcon size={14} />
        </button>
      ) : (
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={accessibleLabel}
          onClick={() => setOpen((value) => !value)}
          className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-strong bg-surface pr-3 pl-4 text-label-button whitespace-nowrap text-primary hover:bg-surface-hover focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none max-md:h-11"
        >
          {label}
          <ChevronDownIcon size={16} className="text-icon" />
        </button>
      )}
      {open && (
        <div
          role="menu"
          aria-label={accessibleLabel ?? label}
          className={clsx(
            'absolute top-[calc(100%+6px)] z-30 min-w-[200px] rounded-lg border border-default bg-surface py-1.5 shadow-[var(--shadow-overlay)]',
            variant !== 'icon' && 'max-md:left-0 max-md:w-full',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                item.onSelect()
              }}
              className={clsx(
                'flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-body hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none',
                item.destructive ? 'text-error-fg' : 'text-primary',
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
