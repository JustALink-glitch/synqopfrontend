import { useEffect, useState } from 'react'
import { api } from './api'

/**
 * Profile photos for avatars in lists (pilot feedback, Nov 2026). Every avatar on a screen asks for its person's
 * photo; the asks made in the same moment go to the API as one call. Links last an hour, so we keep them 50 minutes.
 */
const KEEP_MS = 50 * 60_000
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Entry = { url: string | null; at: number }
const cache = new Map<string, Entry>()
const waiting = new Map<string, ((url: string | null) => void)[]>()
let timer: ReturnType<typeof setTimeout> | null = null

async function flush() {
  timer = null
  const batch = new Map(waiting)
  waiting.clear()
  const ids = [...batch.keys()]
  for (let i = 0; i < ids.length; i += 300) {
    const chunk = ids.slice(i, i + 300)
    let photos: Record<string, string>
    try {
      photos = (await api<{ photos: Record<string, string> }>('/v1/photos', { method: 'POST', body: { ids: chunk } })).photos
    } catch {
      // No photo is fine: the avatar keeps its initials. Try again next time.
      for (const id of chunk) for (const done of batch.get(id) ?? []) done(null)
      continue
    }
    const at = Date.now()
    for (const id of chunk) {
      const url = photos[id] ?? null
      cache.set(id, { url, at })
      for (const done of batch.get(id) ?? []) done(url)
    }
  }
}

function load(id: string): Promise<string | null> {
  return new Promise((resolve) => {
    const list = waiting.get(id)
    if (list) list.push(resolve)
    else waiting.set(id, [resolve])
    timer ??= setTimeout(flush, 15)
  })
}

function fresh(id: string): Entry | undefined {
  const hit = cache.get(id)
  return hit && Date.now() - hit.at < KEEP_MS ? hit : undefined
}

/** Forget someone's photo, e.g. after they change it. */
export function forgetPhoto(id: string) {
  cache.delete(id)
}

/** The photo link for a member id, or null while loading or when they have none. */
export function usePhoto(id: string | undefined, skip = false): string | null {
  const usable = !skip && !!id && uuid.test(id)
  const [loaded, setLoaded] = useState<{ id: string; url: string | null } | null>(null)
  const hit = usable ? fresh(id!) : undefined
  useEffect(() => {
    if (!usable || fresh(id!)) return
    let live = true
    load(id!).then((url) => live && setLoaded({ id: id!, url }))
    return () => {
      live = false
    }
  }, [id, usable])
  if (!usable) return null
  if (hit) return hit.url
  return loaded?.id === id ? loaded.url : null
}
