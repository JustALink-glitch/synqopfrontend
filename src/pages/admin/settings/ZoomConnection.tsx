import { useState } from 'react'
import { useAuth } from '@/auth/useAuth'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Badge } from '@/components/ui/Page'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { ApiError } from '@/lib/api'
import { formatDay, formatTime } from '@/lib/format'
import { useConnectZoom, useDisconnectZoom, type AttendanceSettings } from './data'

/** Result of the round trip to Zoom, from ?zoom= on the way back (F1.07). */
export const zoomResults: Record<string, { tone: 'success' | 'warning' | 'error'; title: string; body?: string }> = {
  connected: {
    tone: 'success',
    title: 'Zoom is connected',
    body: 'New online sessions get a Zoom meeting within a minute, and attendance imports when each meeting ends.',
  },
  cancelled: { tone: 'warning', title: 'Zoom wasn’t connected', body: 'You cancelled on Zoom’s screen. Try again when you’re ready.' },
  error: {
    tone: 'error',
    title: 'Zoom couldn’t be connected',
    body: 'Try again. Connect with the Zoom account your organisation uses for sessions; it needs to be a Zoom admin.',
  },
  not_configured: { tone: 'error', title: 'Zoom isn’t set up on this server', body: 'The Zoom app keys need adding to the API’s settings first.' },
}

function ZoomIcon() {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-subtle text-icon" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
        <rect x="3" y="6" width="13" height="12" rx="2" />
        <path d="M16 10.5 21 7.5v9l-5-3" />
      </svg>
    </span>
  )
}

/** F1.07 Zoom row: connect, connected (with last import), needs reconnecting, or not available on this server. */
export function ZoomConnection({ zoom }: { zoom: AttendanceSettings['zoom'] }) {
  const { state } = useAuth()
  const timeZone = state.status === 'signed-in' ? state.me.organisation?.timeZone : undefined
  const connect = useConnectZoom()
  const disconnect = useDisconnectZoom()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function start() {
    setError(null)
    try {
      const { url } = await connect.mutateAsync()
      window.location.assign(url)
    } catch (e) {
      setError(e instanceof ApiError && e.status < 500 ? e.message : 'Couldn’t start connecting. Try again.')
    }
  }

  const when = (iso: string) => `${formatDay(iso, timeZone)}, ${formatTime(iso, timeZone)}`
  const title = zoom.problem ? 'Zoom needs connecting again' : zoom.connected ? `Connected to ${zoom.email ?? 'Zoom'}` : 'Zoom isn’t connected'
  const description = zoom.problem
    ? zoom.problem
    : zoom.connected
      ? `Attendance imports when each meeting ends.${zoom.lastImportAt ? ` Last import: ${when(zoom.lastImportAt)}.` : ''}${
          (zoom.hosts ?? 0) > 1 ? ` ${zoom.hosts} licensed Zoom users can host classes at the same time.` : ''
        }`
      : zoom.available
        ? 'Connect your organisation’s Zoom account. Synqop then creates a meeting for each online session and imports attendance after it.'
        : 'Zoom isn’t set up on this server yet. Until it is, paste a meeting link on each session and trainers mark attendance on the register.'

  return (
    <>
      <div className="flex items-center gap-3 border-b border-default py-3.5 max-md:flex-wrap">
        <ZoomIcon />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-body-strong text-primary">{title}</span>
          <span className="text-caption text-secondary">{description}</span>
        </div>
        {zoom.connected && !zoom.problem ? (
          <>
            <Badge tone="success">Connected</Badge>
            <Button variant="secondary" onClick={() => setConfirming(true)}>
              Disconnect
            </Button>
          </>
        ) : zoom.available ? (
          <Button onClick={start} disabled={connect.isPending}>
            {connect.isPending ? 'Opening Zoom…' : zoom.problem ? 'Connect again' : 'Connect Zoom'}
          </Button>
        ) : (
          <Badge tone="neutral">Not available</Badge>
        )}
      </div>
      {zoom.connected && !zoom.problem && (zoom.missing?.length ?? 0) > 0 && (
        <div className="flex items-start gap-3 pt-3 max-md:flex-col">
          <AlertBanner title="New: connect Zoom again to turn these on">
            {[
              zoom.missing!.includes('recordings') && 'class recordings on each session',
              zoom.missing!.includes('hosts') && 'classes at the same time on different Zoom users',
              zoom.missing!.includes('start') && 'a Start class button for trainers',
            ]
              .filter(Boolean)
              .join(', ')
              .replace(/, ([^,]*)$/, ' and $1')
              .replace(/^./, (c) => c.toUpperCase())}
            . Zoom asks you to approve the new permissions; nothing else changes.
          </AlertBanner>
          <Button variant="secondary" onClick={start} disabled={connect.isPending} className="shrink-0">
            {connect.isPending ? 'Opening Zoom…' : 'Connect again'}
          </Button>
        </div>
      )}
      {error && (
        <div className="pt-3">
          <AlertBanner tone="error" title={error} />
        </div>
      )}
      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        width={440}
        title="Disconnect Zoom?"
        description="Meetings already created stay in Zoom and keep working. New online sessions won’t get a meeting, and attendance won’t import, until you connect again."
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={disconnect.isPending}
              onClick={async () => {
                await disconnect.mutateAsync().catch(() => setError('Zoom wasn’t disconnected. Try again.'))
                setConfirming(false)
              }}
            >
              {disconnect.isPending ? 'Disconnecting…' : 'Disconnect'}
            </Button>
          </>
        }
      />
    </>
  )
}
