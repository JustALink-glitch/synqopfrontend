import clsx from 'clsx'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { PALETTE } from './palette'

/* Small, dependency-free charts (§10 Data visualisation): one look across the overview and reports. */

export interface Series {
  name: string
  values: number[]
  colour?: string
}

export function Legend({ items }: { items: { name: string; colour: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-caption text-secondary" aria-label="Legend">
      {items.map((i) => (
        <li key={i.name} className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-xs" style={{ background: i.colour }} aria-hidden="true" />
          {i.name}
        </li>
      ))}
    </ul>
  )
}

/** A round number at or above `n`, for the top of an axis. */
function niceMax(n: number) {
  if (n <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(n))
  // Steps that halve to whole numbers, so the middle grid line never reads "13".
  return [1, 2, 4, 5, 10].map((m) => m * p).find((m) => m >= n)!
}

/** The element's width, kept up to date; 0 until it's measured. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => setWidth(e!.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

/** Rough width of a chart label at 11px, so labels can be thinned before they touch. */
const labelWidth = (text: string) => text.length * 6.2 + 8

/**
 * Vertical bars, stacked or side by side, with a light grid and labels thinned to fit.
 * `top` puts a small label over each bar (e.g. a percentage).
 */
export function BarChart({
  labels,
  series,
  stacked = false,
  height = 160,
  unit = '',
  max,
  top,
  describe,
}: {
  labels: string[]
  series: Series[]
  stacked?: boolean
  height?: number
  unit?: string
  max?: number
  top?: (i: number) => string | null
  describe?: (i: number) => string
}) {
  const coloured = series.map((s, i) => ({ ...s, colour: s.colour ?? PALETTE[i % PALETTE.length]! }))
  const totals = labels.map((_, i) => (stacked ? coloured.reduce((n, s) => n + (s.values[i] ?? 0), 0) : Math.max(0, ...coloured.map((s) => s.values[i] ?? 0))))
  const ceiling = max ?? niceMax(Math.max(...totals, 0))
  const [ref, width] = useWidth<HTMLDivElement>()
  const minWidth = labels.length > 40 ? labels.length * 7 : 0
  const n = Math.max(labels.length, 1)
  const full = Math.max(width, minWidth) - 16
  // Each column's own width, after the gaps between columns (6% each, or 1px when there are many).
  const slot = labels.length > 16 ? (full - (n - 1)) / n : (full * (1 - 0.06 * (n - 1))) / n
  // Distance between the centres of two neighbouring labels.
  const pitch = labels.length > 16 ? slot + 1 : slot + full * 0.06
  // Show every nth label so none touch (pilot feedback, Nov 2026: weekly dates ran together in the narrow column).
  const widest = Math.max(...labels.map(labelWidth), 1)
  const every = width ? Math.max(1, Math.ceil(widest / pitch)) : Math.ceil(labels.length / (labels.length > 16 ? 5 : 8))
  // Labels over the bars only when every one fits; otherwise they're in each bar's description.
  const tops = top ? labels.map((_, i) => top(i)) : []
  const showTops = Boolean(width) && tops.some(Boolean) && Math.max(...tops.map((t) => (t ? labelWidth(t) : 0))) <= pitch - 4
  const ticks = [0, 0.5, 1].map((f) => Math.round(ceiling * f))
  const plot = height - 18
  return (
    <div className="flex flex-col gap-2">
      {coloured.length > 1 && <Legend items={coloured} />}
      <div className="flex gap-2">
        <div className="relative w-8 shrink-0 text-right text-chart-label text-secondary tabular-nums" style={{ height: plot }} aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: plot - (t / ceiling) * plot }}>
              {t}
              {unit}
            </span>
          ))}
        </div>
        <div ref={ref} className="min-w-0 flex-1 overflow-x-auto">
          <div className="relative px-2" style={{ minWidth: minWidth || undefined }}>
            <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: plot }} aria-hidden="true">
              {ticks.map((t) => (
                <span key={t} className="absolute inset-x-0 border-t border-chart-grid" style={{ top: plot - (t / ceiling) * plot }} />
              ))}
            </div>
            <ol className={clsx('relative flex items-end', labels.length > 16 ? 'gap-px' : 'gap-[6%]')} style={{ height: plot }}>
              {labels.map((label, i) => (
                <li
                  key={`${label}-${i}`}
                  className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-0.5"
                  aria-label={describe ? describe(i) : `${label}: ${coloured.map((s) => `${s.name} ${s.values[i] ?? 0}${unit}`).join(', ')}`}
                >
                  {showTops && tops[i] && <span className="text-chart-label whitespace-nowrap text-secondary tabular-nums">{tops[i]}</span>}
                  {stacked ? (
                    <span className="flex w-full max-w-6 flex-col-reverse overflow-hidden rounded-t-xs" style={{ height: `${(totals[i]! / ceiling) * 100}%` }}>
                      {coloured.map((s) => (
                        <span key={s.name} style={{ background: s.colour, height: `${totals[i] ? ((s.values[i] ?? 0) / totals[i]!) * 100 : 0}%` }} />
                      ))}
                    </span>
                  ) : (
                    <span className="flex h-full w-full max-w-10 items-end justify-center gap-[2px]">
                      {coloured.map((s) => (
                        <span
                          key={s.name}
                          className="w-full max-w-4 rounded-t-xs"
                          style={{ background: s.colour, height: `${((s.values[i] ?? 0) / ceiling) * 100}%` }}
                        />
                      ))}
                    </span>
                  )}
                </li>
              ))}
            </ol>
            <div className={clsx('flex pt-1 text-chart-label text-secondary', labels.length > 16 ? 'gap-px' : 'gap-[6%]')} aria-hidden="true">
              {labels.map((label, i) => (
                <span
                  key={`${label}-${i}`}
                  // The end labels hug the edges so they're never cut off by the scroll area.
                  className={clsx(
                    'flex min-w-0 flex-1 whitespace-nowrap',
                    i === labels.length - 1 && labels.length > 1 ? 'justify-end' : i === 0 ? 'justify-start' : 'justify-center',
                  )}
                >
                  {(labels.length - 1 - i) % every === 0 ? label : ''}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Horizontal bars: best when labels are long (cohorts, assignments, trainers). */
export function BarList({
  rows,
  unit = '',
  max,
  colour = 'var(--chart-1)',
}: {
  rows: { label: string; value: number | null; note?: string }[]
  unit?: string
  max?: number
  colour?: string
}) {
  const ceiling = max ?? niceMax(Math.max(0, ...rows.map((r) => r.value ?? 0)))
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((r, i) => (
        <li key={`${r.label}-${i}`} className="grid grid-cols-[minmax(0,180px)_1fr_auto] items-center gap-3 max-md:grid-cols-[minmax(0,110px)_1fr_auto]">
          <span className="truncate text-caption text-primary" title={r.label}>
            {r.label}
          </span>
          <span className="h-2.5 overflow-hidden rounded-full bg-chart-track">
            <span
              className="block h-full rounded-full"
              style={{ width: `${r.value === null ? 0 : Math.min(100, (r.value / ceiling) * 100)}%`, background: colour }}
            />
          </span>
          <span className="w-16 text-right text-caption-strong text-primary tabular-nums">
            {r.value === null ? '—' : `${r.value}${unit}`}
            {r.note && <span className="block text-chart-label font-normal text-secondary">{r.note}</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** A line over time, 0–max, with a dot per point. Nulls leave a gap. */
export function LineChart({
  labels,
  series,
  unit = '',
  max,
  height = 160,
}: {
  labels: string[]
  series: (Omit<Series, 'values'> & { values: (number | null)[] })[]
  unit?: string
  max?: number
  height?: number
}) {
  const coloured = series.map((s, i) => ({ ...s, colour: s.colour ?? PALETTE[i % PALETTE.length]! }))
  const ceiling = max ?? niceMax(Math.max(0, ...coloured.flatMap((s) => s.values.map((v) => v ?? 0))))
  const plot = height - 18
  const x = (i: number) => (labels.length <= 1 ? 50 : (i / (labels.length - 1)) * 100)
  const y = (v: number) => 100 - (v / ceiling) * 100
  const every = Math.ceil(labels.length / (labels.length > 16 ? 5 : 8))
  const ticks = [0, 0.5, 1].map((f) => Math.round(ceiling * f))
  return (
    <div className="flex flex-col gap-2">
      {coloured.length > 1 && <Legend items={coloured} />}
      <div className="flex gap-2">
        <div className="relative w-8 shrink-0 text-right text-chart-label text-secondary tabular-nums" style={{ height: plot }} aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: plot - (t / ceiling) * plot }}>
              {t}
              {unit}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative px-1" style={{ height: plot }}>
            {ticks.map((t) => (
              <span key={t} aria-hidden="true" className="absolute inset-x-0 border-t border-chart-grid" style={{ top: plot - (t / ceiling) * plot }} />
            ))}
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 size-full overflow-visible"
              role="img"
              aria-label={coloured.map((s) => `${s.name}: ${labels.map((l, i) => `${l} ${s.values[i] ?? 'none'}${unit}`).join(', ')}`).join('. ')}
            >
              {coloured.map((s) => {
                const segments: string[][] = [[]]
                s.values.forEach((v, i) => (v === null ? segments.push([]) : segments.at(-1)!.push(`${x(i)},${y(v)}`)))
                return segments
                  .filter((pts) => pts.length > 1)
                  .map((pts, k) => (
                    <polyline
                      key={`${s.name}-${k}`}
                      points={pts.join(' ')}
                      fill="none"
                      stroke={s.colour}
                      strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                      strokeLinejoin="round"
                    />
                  ))
              })}
            </svg>
            {coloured.map((s) =>
              s.values.map((v, i) =>
                v === null ? null : (
                  <span
                    key={`${s.name}-${i}`}
                    title={`${labels[i]}: ${v}${unit}`}
                    className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface"
                    style={{ left: `calc(${x(i)}% )`, top: `${y(v)}%`, background: s.colour }}
                  />
                ),
              ),
            )}
          </div>
          <div className="flex justify-between pt-1 text-chart-label text-secondary" aria-hidden="true">
            {labels.map((l, i) => (
              <span key={`${l}-${i}`} className={clsx('whitespace-nowrap', i % every !== 0 && 'invisible')}>
                {l}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Parts of a whole, with the total (or a headline) in the middle and a legend with counts. */
export function Donut({ parts, centre, caption }: { parts: { label: string; value: number; colour?: string }[]; centre: ReactNode; caption?: string }) {
  const total = parts.reduce((n, p) => n + p.value, 0)
  const coloured = parts.map((p, i) => ({ ...p, colour: p.colour ?? PALETTE[i % PALETTE.length]! }))
  const r = 15.915 // circumference 100
  let offset = 25
  return (
    <div className="flex items-center gap-5 max-md:flex-col max-md:items-start">
      <div className="relative size-32 shrink-0">
        <svg viewBox="0 0 36 36" className="size-full -rotate-0" role="img" aria-label={coloured.map((p) => `${p.label} ${p.value}`).join(', ')}>
          <circle cx="18" cy="18" r={r} fill="none" stroke="var(--chart-track)" strokeWidth="4" />
          {total > 0 &&
            coloured.map((p) => {
              const share = (p.value / total) * 100
              const el = (
                <circle
                  key={p.label}
                  cx="18"
                  cy="18"
                  r={r}
                  fill="none"
                  stroke={p.colour}
                  strokeWidth="4"
                  strokeDasharray={`${share} ${100 - share}`}
                  strokeDashoffset={offset}
                />
              )
              offset -= share
              return el
            })}
        </svg>
        <span className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-heading-section text-primary tabular-nums">{centre}</span>
          {caption && <span className="text-chart-label text-secondary">{caption}</span>}
        </span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {coloured.map((p) => (
          <li key={p.label} className="flex items-center gap-2 text-caption text-secondary">
            <span className="size-2.5 rounded-xs" style={{ background: p.colour }} aria-hidden="true" />
            <span className="min-w-24">{p.label}</span>
            <span className="text-caption-strong text-primary tabular-nums">{p.value}</span>
            {total > 0 && <span className="tabular-nums">· {Math.round((p.value / total) * 100)}%</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** A headline number with a small label and optional context line. */
export function Stat({ label, value, note, tone }: { label: string; value: ReactNode; note?: ReactNode; tone?: 'good' | 'warn' }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-md border border-default bg-surface p-3">
      <span className="truncate text-caption text-secondary">{label}</span>
      <span className={clsx('text-metric-small tabular-nums', tone === 'warn' ? 'text-warning-fg' : 'text-primary')}>{value}</span>
      {note && <span className="truncate text-caption text-secondary">{note}</span>}
    </div>
  )
}
