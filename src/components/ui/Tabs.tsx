import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router'

/** Tabs (A3.02): 40px, 13 Medium, brand underline on the current tab, optional count pill. */
/**
 * Scrolls the chosen tab into view and fades the edge that has more tabs past it, so a row wider than a phone
 * shows it scrolls (pilot feedback, Nov 2026: "Trainers" was cut to "Tr" on cohort details).
 */
function useTabRow<T extends HTMLElement>(key: string) {
  const ref = useRef<T>(null)
  const [edges, setEdges] = useState({ left: false, right: false })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setEdges({ left: el.scrollLeft > 2, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 })
    el.querySelector<HTMLElement>('[aria-current="page"], [aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    ro?.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      ro?.disconnect()
    }
  }, [key])
  const mask =
    edges.left || edges.right
      ? `linear-gradient(to right, ${edges.left ? 'transparent, black 24px' : 'black'}, ${edges.right ? 'black calc(100% - 32px), transparent' : 'black'})`
      : undefined
  return [ref, mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined] as const
}

export function Tabs({ label, items }: { label: string; items: { label: string; to: string; count?: number; end?: boolean }[] }) {
  const { pathname } = useLocation()
  const [ref, style] = useTabRow<HTMLElement>(pathname)
  return (
    <nav ref={ref} style={style} aria-label={label} className="-mb-px flex gap-1 overflow-x-auto border-b border-default [scrollbar-width:none]">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            clsx(
              'flex h-10 shrink-0 items-center gap-1.5 border-b-2 px-1 text-body-strong whitespace-nowrap transition-colors focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none',
              isActive ? 'border-brand text-brand-text' : 'border-transparent text-secondary hover:text-primary',
            )
          }
        >
          {item.label}
          {item.count !== undefined && (
            <span className="rounded-full bg-neutral-bg px-1.5 text-[11px] leading-[14px] font-medium text-neutral-fg">{item.count}</span>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

/** Same look as Tabs, for sections inside one page (B1.04): buttons, not links. */
export function TabButtons<T extends string>({
  label,
  items,
  value,
  onChange,
}: {
  label: string
  items: { value: T; label: string; count?: number }[]
  value: T
  onChange: (value: T) => void
}) {
  const [ref, style] = useTabRow<HTMLDivElement>(value)
  return (
    <div ref={ref} style={style} role="tablist" aria-label={label} className="-mb-px flex gap-4 overflow-x-auto border-b border-default [scrollbar-width:none]">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={item.value === value}
          onClick={() => onChange(item.value)}
          className={clsx(
            'flex h-10 shrink-0 items-center gap-1.5 border-b-2 px-1 text-body-strong whitespace-nowrap transition-colors focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none',
            item.value === value ? 'border-brand text-brand-text' : 'border-transparent text-secondary hover:text-primary',
          )}
        >
          {item.label}
          {item.count !== undefined && (
            <span className="rounded-full bg-neutral-bg px-1.5 text-[11px] leading-[14px] font-medium text-neutral-fg">{item.count}</span>
          )}
        </button>
      ))}
    </div>
  )
}
