import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Bot check (Cloudflare Turnstile) for public forms: sign-up and forgot password.
 * Most people never see it: it checks in the background and only shows a box if it needs a click.
 * Without VITE_TURNSTILE_SITE_KEY (local development) it does nothing and every form works as before.
 */
const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY

interface Turnstile {
  render(el: HTMLElement, options: Record<string, unknown>): string
  reset(id: string): void
  remove(id: string): void
}
declare global {
  interface Window {
    turnstile?: Turnstile
  }
}

let script: Promise<void> | null = null
function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  script ??= new Promise<void>((resolve, reject) => {
    const el = document.createElement('script')
    el.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    el.async = true
    el.onload = () => resolve()
    el.onerror = () => {
      script = null
      reject(new Error('Turnstile did not load'))
    }
    document.head.appendChild(el)
  })
  return script
}

export interface HumanCheckState {
  /** Render this inside the form. Null when the check is off. */
  widget: React.ReactNode
  /** The token to send with the request (undefined when the check is off or not done yet). */
  token: string | undefined
  /** True when the form may be sent: the check is off, or it has passed. */
  ready: boolean
  /** The check couldn't load (blocked or offline). */
  failed: boolean
  /** Tokens work once: call after every request. */
  reset: () => void
}

export function useHumanCheck(): HumanCheckState {
  const box = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!siteKey) return
    let cancelled = false
    loadTurnstile()
      .then(() => {
        if (cancelled || !box.current || !window.turnstile) return
        widgetId.current = window.turnstile.render(box.current, {
          sitekey: siteKey,
          appearance: 'interaction-only',
          callback: (t: string) => {
            setToken(t)
            setFailed(false)
          },
          'expired-callback': () => setToken(null),
          'error-callback': () => setFailed(true),
        })
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
      if (widgetId.current) window.turnstile?.remove(widgetId.current)
      widgetId.current = null
    }
  }, [])

  const reset = useCallback(() => {
    setToken(null)
    if (widgetId.current) window.turnstile?.reset(widgetId.current)
  }, [])

  return {
    widget: siteKey ? <div ref={box} className="flex justify-center empty:hidden" /> : null,
    token: token ?? undefined,
    ready: !siteKey || token !== null,
    failed,
    reset,
  }
}

export const humanCheckFailedMessage = 'We couldn’t check you’re not a robot. Refresh the page and try again.'
