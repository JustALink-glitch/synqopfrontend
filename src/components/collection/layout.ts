import { useState } from 'react'

export type Layout = 'list' | 'grid'

/** List or grid, remembered per list in this browser. */
export function useLayout(key: string): [Layout, (l: Layout) => void] {
  const storageKey = `synqop.layout.${key}`
  const [layout, setLayout] = useState<Layout>(() => {
    try {
      return localStorage.getItem(storageKey) === 'grid' ? 'grid' : 'list'
    } catch {
      return 'list'
    }
  })
  return [
    layout,
    (l) => {
      setLayout(l)
      try {
        localStorage.setItem(storageKey, l)
      } catch {
        // Not remembered in private windows.
      }
    },
  ]
}

/** Grid view: cards sit on the page background, not inside a white panel (Flowdesk style). */
export const GRID_PANEL = 'gap-3 !border-0 !bg-transparent !px-0 !py-0 !shadow-none'
