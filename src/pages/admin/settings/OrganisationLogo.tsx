import { useRef, useState } from 'react'
import { useAuth } from '@/auth/useAuth'
import { api, ApiError } from '@/lib/api'
import { uploadFile } from '@/lib/files'
import { initials } from '@/lib/people'

const TYPES = ['image/png', 'image/jpeg', 'image/webp']
const MAX_BYTES = 2 * 1024 * 1024

/** Organisation logo (pilot feedback, Nov 2026). Saves straight away; shown in the sidebar for everyone. */
export function OrganisationLogo() {
  const { state, refresh } = useAuth()
  const org = state.status === 'signed-in' ? state.me.organisation : null
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const logoUrl = org?.logoUrl ?? null

  async function choose(file: File | undefined) {
    if (!file) return
    setError(null)
    if (!TYPES.includes(file.type)) return setError('Use a PNG, JPG or WebP image.')
    if (file.size > MAX_BYTES) return setError('Logos can be up to 2 MB.')
    setBusy(true)
    try {
      const path = await uploadFile('/v1/settings/organisation/logo/upload', file)
      await api('/v1/settings/organisation/logo', { method: 'PUT', body: { path } })
      await refresh()
    } catch (e) {
      setError(
        e instanceof ApiError && e.status < 500 ? e.message : e instanceof Error && !(e instanceof ApiError) ? e.message : 'The logo didn’t upload. Try again.',
      )
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  async function remove() {
    setBusy(true)
    setError(null)
    try {
      await api('/v1/settings/organisation/logo', { method: 'DELETE' })
      await refresh()
    } catch {
      setError('The logo wasn’t removed. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const link =
    'rounded-sm text-caption-strong text-brand-text hover:underline focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none disabled:opacity-50'
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-caption-strong text-primary">Logo</span>
      <div className="flex items-center gap-3">
        {logoUrl ? (
          <img src={logoUrl} alt="" className="size-12 shrink-0 rounded-md border border-default bg-surface object-contain p-1" />
        ) : (
          <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-md bg-brand text-body-strong text-on-brand">
            {initials(org?.name ?? '')}
          </span>
        )}
        <input
          ref={input}
          type="file"
          accept={TYPES.join(',')}
          className="sr-only"
          tabIndex={-1}
          aria-label="Choose a logo"
          onChange={(e) => void choose(e.target.files?.[0])}
        />
        <button type="button" className={link} disabled={busy} onClick={() => input.current?.click()}>
          {busy ? 'Uploading…' : logoUrl ? 'Change logo' : 'Upload a logo'}
        </button>
        {logoUrl && (
          <button type="button" className={link} disabled={busy} onClick={() => void remove()}>
            Remove
          </button>
        )}
      </div>
      {error ? (
        <p className="text-caption text-error-fg">{error}</p>
      ) : (
        <p className="text-caption text-secondary">Square works best. PNG, JPG or WebP, up to 2 MB. Shown in the sidebar for everyone in your organisation.</p>
      )}
    </div>
  )
}
