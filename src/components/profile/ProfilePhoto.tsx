import { useRef, useState } from 'react'
import { forgetPhoto } from '@/lib/photos'
import { useAuth } from '@/auth/useAuth'
import { Avatar } from '@/components/ui/Avatar'
import { api, ApiError } from '@/lib/api'
import { uploadFile } from '@/lib/files'
import { initials } from '@/lib/people'

const TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 2 * 1024 * 1024

/**
 * Profile photo with "Change photo" / "Upload a photo" (T9.01, T1.03, P1.02). Saves straight away,
 * separately from the rest of the form, then refreshes who's signed in so the top bar updates.
 */
export function ProfilePhoto({ name, label = 'Change photo' }: { name: string; label?: string }) {
  const { state, refresh } = useAuth()
  const me = state.status === 'signed-in' ? state.me : null
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const photoUrl = me?.membership.photoUrl ?? null

  async function choose(file: File | undefined) {
    if (!file) return
    setError(null)
    if (!TYPES.includes(file.type)) return setError('Use a JPG, PNG or WebP image.')
    if (file.size > MAX_BYTES) return setError('Photos can be up to 2 MB.')
    setBusy(true)
    try {
      const path = await uploadFile('/v1/me/photo/upload', file)
      await api('/v1/me/photo', { method: 'PUT', body: { path } })
      if (me?.membership.id) forgetPhoto(me.membership.id)
      await refresh()
    } catch (e) {
      setError(
        e instanceof ApiError && e.status < 500
          ? e.message
          : e instanceof Error && !(e instanceof ApiError)
            ? e.message
            : 'Your photo didn’t upload. Try again.',
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
      await api('/v1/me/photo', { method: 'DELETE' })
      if (me?.membership.id) forgetPhoto(me.membership.id)
      await refresh()
    } catch {
      setError('Your photo wasn’t removed. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const link =
    'text-caption-strong text-brand-text hover:underline disabled:opacity-50 focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none rounded-sm'
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        <Avatar size={40} src={photoUrl} seed={me?.membership.id} initials={initials(name) || '?'} />
        <input
          ref={input}
          type="file"
          accept={TYPES.join(',')}
          className="sr-only"
          tabIndex={-1}
          aria-label="Choose a photo"
          onChange={(e) => void choose(e.target.files?.[0])}
        />
        <button type="button" className={link} disabled={busy} onClick={() => input.current?.click()}>
          {busy ? 'Uploading…' : photoUrl ? 'Change photo' : label}
        </button>
        {photoUrl && !busy && (
          <button type="button" className={`${link} text-secondary`} onClick={() => void remove()}>
            Remove
          </button>
        )}
      </div>
      {error ? (
        <p role="alert" className="text-caption text-error-fg">
          {error}
        </p>
      ) : (
        <p className="text-caption text-secondary">JPG, PNG or WebP, up to 2 MB.</p>
      )}
    </div>
  )
}
