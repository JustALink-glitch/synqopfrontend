import { useState, type ReactNode } from 'react'
import { Eye } from 'lucide-react'
import { fileKind, fileSize, viewKind } from '@/lib/files'
import { DownloadIcon, FileIcon } from './icons'

/** File card (T6.04, P5.03): icon, name, kind · size, and a download or remove action. */
export function FileRow({
  name,
  size,
  meta,
  onDownload,
  action,
}: {
  name: string
  size?: number
  /** Replaces "Kind · size" on the second line. */
  meta?: ReactNode
  onDownload?: () => Promise<void>
  /** A custom action on the right, e.g. Remove. */
  action?: ReactNode
}) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const viewable = Boolean(viewKind(name))
  return (
    <div className="flex items-center gap-3 rounded-md border border-default p-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-hover text-icon">
        <FileIcon size={18} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body-strong text-primary">{name}</span>
        <span className={failed ? 'text-caption text-error-fg' : 'text-caption text-secondary'}>
          {failed
            ? `Couldn’t ${viewable ? 'open' : 'download'} it. Try again.`
            : (meta ?? [fileKind(name), size !== undefined ? fileSize(size) : null].filter(Boolean).join(' · '))}
        </span>
      </span>
      {action}
      {onDownload && (
        <button
          type="button"
          aria-label={`${viewable ? 'View' : 'Download'} ${name}`}
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            setFailed(false)
            try {
              await onDownload()
            } catch {
              setFailed(true)
            } finally {
              setBusy(false)
            }
          }}
          className="flex size-9 shrink-0 items-center justify-center rounded-md text-icon hover:bg-surface-hover focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none disabled:opacity-50"
        >
          {viewable ? <Eye className="size-[18px]" aria-hidden /> : <DownloadIcon size={18} />}
        </button>
      )}
    </div>
  )
}
