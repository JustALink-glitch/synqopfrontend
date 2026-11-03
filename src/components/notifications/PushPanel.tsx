import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Badge, Panel, PanelHeader } from '@/components/ui/Page'
import { pushState, sendTestPush, turnOffPush, turnOnPush, type PushState } from '@/lib/push'

const copy: Record<PushState, string> = {
  on: 'This device shows a notification for everything ticked under In-app, even when Synqop is closed.',
  off: 'Get a notification on this device for everything ticked under In-app, even when Synqop is closed. Email is only for the important things.',
  'needs-install':
    'On iPhone and iPad, push only works from the Synqop icon on your Home Screen, not from a browser tab. In Safari or Chrome, tap Share, then Add to Home Screen. Open Synqop from that icon, sign in, and turn push on here. It needs iOS 16.4 or later.',
  blocked: 'Notifications are blocked for Synqop in this browser. Allow them in the browser’s site settings, then come back here.',
  unsupported: 'This browser can’t show push notifications. You’ll still see everything in the bell, and important things by email.',
  unavailable: 'Push notifications aren’t switched on for Synqop yet. You’ll still see everything in the bell.',
}

/** Push on this device (G1.01): one switch per browser or phone; which events comes from the In-app column. */
export function PushPanel() {
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [test, setTest] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)

  useEffect(() => {
    let live = true
    pushState().then(
      (s) => live && setState(s),
      () => live && setState('unsupported'),
    )
    return () => {
      live = false
    }
  }, [])

  async function run(action: () => Promise<PushState>) {
    setBusy(true)
    setProblem(null)
    setTest(null)
    try {
      const next = await action()
      setState(next)
      // Prove it straight away rather than waiting for real news.
      if (next === 'on' && action === turnOnPush) await sendTest()
    } catch {
      setProblem('Couldn’t change push notifications on this device. Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function sendTest() {
    setTest(null)
    try {
      const result = await sendTestPush()
      if (result === 'sent')
        setTest({
          tone: 'ok',
          text: 'Test sent. It should appear on this device within a few seconds.',
        })
      else if (result === 'gone') {
        setState('off')
        setTest({
          tone: 'bad',
          text: 'This device stopped accepting notifications. Turn push on again.',
        })
      } else
        setTest({
          tone: 'bad',
          text: 'The test couldn’t be delivered. Try again in a minute.',
        })
    } catch {
      setTest({
        tone: 'bad',
        text: 'Couldn’t send a test. Check your connection and try again.',
      })
    }
  }

  async function runTest() {
    setBusy(true)
    await sendTest()
    setBusy(false)
  }

  if (!state) return null
  return (
    <Panel aria-labelledby="push-title" className="gap-3">
      <div className="flex items-start justify-between gap-3">
        <PanelHeader id="push-title" title="Push notifications on this device" />
        {state === 'on' && <Badge tone="success">On</Badge>}
      </div>
      <p className="text-body text-secondary">{copy[state]}</p>
      {problem && (
        <p role="alert" className="text-caption text-error-fg">
          {problem}
        </p>
      )}
      {test && (
        <p role="status" className={test.tone === 'ok' ? 'text-caption text-success-fg' : 'text-caption text-error-fg'}>
          {test.text}
        </p>
      )}
      {(state === 'on' || state === 'off') && (
        <div className="flex flex-wrap gap-2">
          {state === 'off' ? (
            <Button onClick={() => void run(turnOnPush)} disabled={busy}>
              {busy ? 'Turning on…' : 'Turn on push notifications'}
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => void runTest()} disabled={busy}>
                Send a test notification
              </Button>
              <Button variant="secondary" onClick={() => void run(turnOffPush)} disabled={busy}>
                Turn off on this device
              </Button>
            </>
          )}
        </div>
      )}
    </Panel>
  )
}
