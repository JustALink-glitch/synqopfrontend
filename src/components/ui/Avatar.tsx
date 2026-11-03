import clsx from 'clsx'
import { useState } from 'react'
import { usePhoto } from '@/lib/photos'

const tones = [
  'bg-brand-subtle text-brand-text',
  'bg-success-bg text-success-fg',
  'bg-warning-bg text-warning-fg',
  'bg-info-bg text-info-fg',
  'bg-neutral-bg text-neutral-fg',
] as const

/** A stable tone per person, so the same trainer keeps the same colour everywhere. */
function toneFor(seed: string): string {
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return tones[Math.abs(hash) % tones.length]!
}

const sizes = { 24: 'size-6 text-[11px] leading-[14px]', 32: 'size-8 text-caption-strong', 40: 'size-10 text-body-strong' } as const

/**
 * Avatar (Figma 13:70). 24px in table rows, 32px in the top bar and lists, 40px on profile forms. Shows the photo when
 * there is one: pass `src`, or leave it out and the member's photo is looked up from `seed` (their member id).
 */
export function Avatar({
  initials,
  seed,
  size = 24,
  src,
  className,
}: {
  initials: string
  seed?: string
  size?: 24 | 32 | 40
  src?: string | null
  className?: string
}) {
  const looked = usePhoto(seed, src !== undefined)
  const photo = src ?? looked
  const [broken, setBroken] = useState<string | null>(null)
  if (photo && broken !== photo)
    return (
      <img
        src={photo}
        alt=""
        aria-hidden="true"
        onError={() => setBroken(photo)}
        className={clsx('shrink-0 rounded-full object-cover', sizes[size], className)}
      />
    )
  return (
    <span
      aria-hidden="true"
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-full font-medium select-none',
        sizes[size],
        seed ? toneFor(seed) : tones[0],
        className,
      )}
    >
      {initials}
    </span>
  )
}
