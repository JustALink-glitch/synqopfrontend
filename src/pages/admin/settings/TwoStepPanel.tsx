import { useEffect, useState } from 'react'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Badge, Panel, PanelHeader } from '@/components/ui/Page'
import { TextField } from '@/components/ui/TextField'
import { clearUnfinished, isCode, verifiedFactor, verifyCode } from '@/auth/twoStep'
import { supabase } from '@/lib/supabase'

type Setup = { factorId: string; qr: string; secret: string }

/** Supabase sends the QR as "data:image/svg+xml;utf-8,<svg…>", which some browsers won't show. Rebuild it properly. */
function qrSource(dataUri: string) {
  const comma = dataUri.indexOf(',')
  const raw = comma >= 0 ? dataUri.slice(comma + 1) : dataUri
  let svg = raw
  try {
    if (!raw.trimStart().startsWith('<')) svg = decodeURIComponent(raw)
  } catch {
    svg = raw
  }
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/** Two-step sign-in for owners and admins: set up with an authenticator app, or turn off. */
export function TwoStepPanel() {
  const [factorId, setFactorId] = useState<string | null | undefined>(undefined)
  const [setup, setSetup] = useState<Setup | null>(null)
  const [turningOff, setTurningOff] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  const load = () =>
    verifiedFactor()
      .then((f) => setFactorId(f?.id ?? null))
      .catch(() => setFactorId(null))
  useEffect(() => {
    void load()
  }, [])

  async function start() {
    setProblem(null)
    setNotice(null)
    try {
      await clearUnfinished()
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Synqop ${new Date().toISOString().slice(0, 10)}` })
      if (error) throw error
      setSetup({ factorId: data.id, qr: qrSource(data.totp.qr_code), secret: data.totp.secret })
    } catch {
      setProblem('Couldn’t start setting up. Try again.')
    }
  }

  const on = Boolean(factorId)
  return (
    <Panel aria-labelledby="two-step-title" className="gap-4">
      <PanelHeader
        id="two-step-title"
        title="Two-step sign-in"
        description="Ask for a code from an authenticator app on your phone as well as your password. Recommended for owners and admins."
      />
      {notice && <AlertBanner tone="success" title={notice} />}
      {problem && <AlertBanner tone="error" title={problem} />}
      <div className="flex items-center gap-3 max-md:flex-wrap">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-body-strong text-primary">{factorId === undefined ? 'Checking…' : on ? 'On' : 'Off'}</span>
          <span className="text-caption text-secondary">
            {on
              ? 'You’ll enter a code from your authenticator app each time you sign in.'
              : 'Use Google Authenticator, Microsoft Authenticator, 1Password or similar.'}
          </span>
        </div>
        {on && <Badge tone="success">On</Badge>}
        {factorId !== undefined &&
          (on ? (
            <Button type="button" variant="secondary" onClick={() => setTurningOff(true)}>
              Turn off
            </Button>
          ) : (
            <Button type="button" onClick={start}>
              Set up
            </Button>
          ))}
      </div>

      {setup && (
        <SetupDialog
          setup={setup}
          onClose={() => setSetup(null)}
          onDone={() => {
            setSetup(null)
            setNotice('Two-step sign-in is on')
            void load()
          }}
        />
      )}
      {turningOff && factorId && (
        <TurnOffDialog
          factorId={factorId}
          onClose={() => setTurningOff(false)}
          onDone={() => {
            setTurningOff(false)
            setNotice('Two-step sign-in is off')
            void load()
          }}
        />
      )}
    </Panel>
  )
}

function SetupDialog({ setup, onClose, onDone }: { setup: Setup; onClose: () => void; onDone: () => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function confirm() {
    if (!isCode(code)) return setError('Enter the 6-digit code your app shows.')
    setSaving(true)
    const result = await verifyCode(setup.factorId, code)
    setSaving(false)
    if (result === 'ok') onDone()
    else setError(result === 'wrong' ? 'That code didn’t work. Use the newest code your app shows.' : 'Couldn’t check the code. Try again.')
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Set up two-step sign-in"
      description="Scan the QR code with your authenticator app, then enter the 6-digit code it shows."
      actions={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={confirm} disabled={saving}>
            {saving ? 'Checking…' : 'Turn on'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-3">
        <img src={setup.qr} alt="QR code for your authenticator app" width={176} height={176} className="rounded-md border border-default bg-white p-2" />
        <p className="text-center text-caption text-secondary">
          Can’t scan it? Enter this key in the app instead:
          <br />
          <code className="text-body-strong break-all text-primary select-all">{setup.secret}</code>
        </p>
      </div>
      <TextField
        label="Code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={7}
        placeholder="123456"
        value={code}
        onChange={(e) => {
          setCode(e.target.value)
          setError(null)
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), void confirm())}
        error={error}
      />
    </Dialog>
  )
}

function TurnOffDialog({ factorId, onClose, onDone }: { factorId: string; onClose: () => void; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function turnOff() {
    setSaving(true)
    const { error: e } = await supabase.auth.mfa.unenroll({ factorId })
    setSaving(false)
    if (e) setError('Couldn’t turn it off. Sign out and in again, then try once more.')
    else onDone()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      width={440}
      title="Turn off two-step sign-in?"
      description="You’ll sign in with your password only. Anyone who learns your password could then get into your organisation’s Synqop."
      actions={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Keep it on
          </Button>
          <Button type="button" variant="destructive" onClick={turnOff} disabled={saving}>
            {saving ? 'Turning off…' : 'Turn off'}
          </Button>
        </>
      }
    >
      {error && <AlertBanner tone="error" title={error} />}
    </Dialog>
  )
}
