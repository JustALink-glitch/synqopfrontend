import { Copy, PlayCircle } from 'lucide-react'
import { useState } from 'react'
import { Panel, PanelHeader } from '@/components/ui/Page'
import { formatDuration } from '@/lib/format'

export interface SessionRecording {
  url: string
  passcode: string | null
  minutes: number | null
}

/**
 * The class recording (pilot feedback, Nov 2026). Zoom keeps and plays the video; Synqop links to it, so nothing is
 * stored or streamed by Synqop. Zoom doesn't allow its player inside other sites, so it opens in a new tab.
 */
export function RecordingPanel({ recording, note }: { recording: SessionRecording; note?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Panel aria-labelledby="recording-title">
      <PanelHeader
        id="recording-title"
        title="Recording"
        description={[recording.minutes ? formatDuration(recording.minutes) : null, 'Plays on Zoom in a new tab'].filter(Boolean).join(' · ')}
      />
      <a
        href={recording.url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-brand px-4 text-label-button text-on-brand hover:bg-brand-hover focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none"
      >
        <PlayCircle aria-hidden className="size-4" />
        Watch recording
      </a>
      {recording.passcode && (
        <div className="flex items-center justify-between gap-2 rounded-md bg-canvas px-3 py-2">
          <span className="flex min-w-0 flex-col">
            <span className="text-caption text-secondary">Passcode</span>
            <span className="truncate font-mono text-body-strong text-primary">{recording.passcode}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(recording.passcode!).catch(() => undefined)
              setCopied(true)
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-caption-strong text-brand-text hover:bg-surface-hover focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none"
          >
            <Copy aria-hidden className="size-3.5" />
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}
      {note && <p className="text-caption text-secondary">{note}</p>}
    </Panel>
  )
}
