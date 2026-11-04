import { Download, ExternalLink, X } from 'lucide-react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

/**
 * A full-screen viewer for photos, videos, audio and documents, so people can look at a file without leaving
 * Synqop (pilot feedback, Nov 2026). Mounted once in the app shell; opened with `showFile`.
 */
export type ViewItem = {
  name: string
  kind: 'image' | 'video' | 'audio' | 'document'
  /** Ready-made link (e.g. a profile photo), or one fetched when the viewer opens. */
  url?: string
  load?: () => Promise<string>
  /** Saves the file instead, where that makes sense. */
  download?: () => Promise<void>
  caption?: string
}

let current: ViewItem | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function showFile(item: ViewItem) {
  current = item
  emit()
}

function close() {
  current = null
  emit()
}

const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l))

export function FileViewerHost() {
  const item = useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  )
  const ref = useRef<HTMLDialogElement>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (item && !dialog.open) dialog.showModal()
    if (!item && dialog.open) dialog.close()
    setFailed(false)
    setUrl(item?.url ?? null)
    if (item && !item.url && item.load) {
      let live = true
      item.load().then(
        (u) => live && setUrl(u),
        () => live && setFailed(true),
      )
      return () => {
        live = false
      }
    }
  }, [item])

  return (
    <dialog
      ref={ref}
      onClose={close}
      onClick={(e) => e.target === e.currentTarget && close()}
      aria-label={item ? `Viewing ${item.name}` : 'File viewer'}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-0 backdrop:bg-black/90"
    >
      {item && (
        <div className="flex h-full flex-col text-white" onClick={(e) => e.target === e.currentTarget && close()}>
          <div className="flex items-center gap-2 px-4 py-3 pt-[max(12px,env(safe-area-inset-top))]">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-body-strong">{item.name}</span>
              {item.caption && <span className="truncate text-caption text-white/70">{item.caption}</span>}
            </span>
            {url && item.kind === 'document' && (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-caption-strong hover:bg-white/10 focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none"
              >
                <ExternalLink className="size-4" aria-hidden />
                <span className="max-sm:sr-only">Open in new tab</span>
              </a>
            )}
            {item.download && (
              <button
                type="button"
                onClick={() => void item.download!().catch(() => setFailed(true))}
                className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-caption-strong hover:bg-white/10 focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none"
              >
                <Download className="size-4" aria-hidden />
                <span className="max-sm:sr-only">Download</span>
              </button>
            )}
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              autoFocus
              className="inline-flex size-9 items-center justify-center rounded-md hover:bg-white/10 focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div
            className="flex min-h-0 flex-1 items-center justify-center px-4 pb-[max(16px,env(safe-area-inset-bottom))]"
            onClick={(e) => e.target === e.currentTarget && close()}
          >
            {failed ? (
              <p className="text-body text-white/80">Couldn’t open {item.name}. Check your connection and try again.</p>
            ) : !url ? (
              <p className="text-body text-white/80" aria-live="polite">
                Opening…
              </p>
            ) : item.kind === 'image' ? (
              <img src={url} alt={item.name} className="max-h-full max-w-full rounded-md object-contain" />
            ) : item.kind === 'video' ? (
              <video src={url} controls autoPlay playsInline className="max-h-full max-w-full rounded-md bg-black" />
            ) : item.kind === 'audio' ? (
              <audio src={url} controls autoPlay className="w-full max-w-md" />
            ) : (
              // PDFs and text show in the browser's own viewer; phones that can't scroll a framed PDF have "Open in new tab".
              <iframe src={url} title={item.name} className="h-full w-full max-w-5xl rounded-md bg-white" />
            )}
          </div>
        </div>
      )}
    </dialog>
  )
}
