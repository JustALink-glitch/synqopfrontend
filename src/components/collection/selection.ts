import { useState } from 'react'
import { ApiError } from '@/lib/api'

/** Ticked rows on one page of a list. Rows that leave the list (filtered, deleted) drop out of the selection. */
export function useSelection(visibleIds: string[]) {
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const ids = new Set(visibleIds)
  const selected = [...picked].filter((id) => ids.has(id))
  const all = visibleIds.length > 0 && selected.length === visibleIds.length
  return {
    selected,
    count: selected.length,
    has: (id: string) => picked.has(id) && ids.has(id),
    toggle: (id: string) =>
      setPicked((old) => {
        const next = new Set(old)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      }),
    toggleAll: () => setPicked(all ? new Set() : new Set(visibleIds)),
    clear: () => setPicked(new Set()),
    /** For the header box: ticked, dash, or empty. */
    header: (all ? true : selected.length ? 'mixed' : false) as boolean | 'mixed',
  }
}

export type Selection = ReturnType<typeof useSelection>

export interface BulkOutcome {
  action: string
  done: string[]
  skipped: { name: string; reason: string }[]
}

/** Runs one request per item, four at a time, and reports what worked and what was skipped (with the API's reason). */
export async function runBulk<T>(action: string, items: T[], name: (item: T) => string, run: (item: T) => Promise<unknown>): Promise<BulkOutcome> {
  const outcome: BulkOutcome = { action, done: [], skipped: [] }
  const queue = [...items]
  await Promise.all(
    Array.from({ length: Math.min(4, queue.length) }, async () => {
      for (let item = queue.shift(); item; item = queue.shift()) {
        try {
          await run(item)
          outcome.done.push(name(item))
        } catch (error) {
          outcome.skipped.push({ name: name(item), reason: error instanceof ApiError ? error.message : 'Something went wrong.' })
        }
      }
    }),
  )
  return outcome
}

/** Saves rows as a CSV file (Excel opens it). */
export function downloadCsv(fileName: string, header: string[], rows: (string | number | null | undefined)[][]) {
  const cell = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n\r]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"` : s
  }
  const text = '﻿' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: fileName })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
