import { api } from '@/lib/api'

/**
 * Web push on this device (G1.01). Push follows each event's in-app choice. Browsers need a service worker,
 * and iPhones also need iOS 16.4 or later with Synqop added to the Home Screen.
 */
export type PushState =
  | 'unsupported' // This browser can't do push at all.
  | 'needs-install' // iPhone/iPad Safari: add to Home Screen first.
  | 'unavailable' // The server has no push keys yet.
  | 'blocked' // The person said no in the browser; only browser settings can undo it.
  | 'off'
  | 'on'

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

/** Registers the worker once the page has loaded; harmless where push isn't supported. */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.MODE === 'test') return
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => {}))
}

let key: Promise<string | null> | null = null
const publicKey = () =>
  (key ??= api<{ publicKey: string | null }>('/v1/notifications/push/key').then(
    (r) => r.publicKey,
    () => ((key = null), null),
  ))

async function subscription() {
  const reg = await navigator.serviceWorker.getRegistration('/')
  return reg ? reg.pushManager.getSubscription() : null
}

export async function pushState(): Promise<PushState> {
  if (!supported()) return isIos() && !isStandalone() ? 'needs-install' : 'unsupported'
  if (!(await publicKey())) return 'unavailable'
  if (Notification.permission === 'denied') return 'blocked'
  const sub = await subscription()
  if (sub && Notification.permission === 'granted') {
    // Keep the server's copy current (it may have been moved to someone else who signed in here).
    await save(sub).catch(() => {})
    return 'on'
  }
  return 'off'
}

const toBytes = (base64: string) => {
  const raw = atob((base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

const save = (sub: PushSubscription) => {
  const json = sub.toJSON() as {
    endpoint: string
    keys: { p256dh: string; auth: string }
  }
  return api('/v1/notifications/push/subscription', {
    method: 'PUT',
    body: { endpoint: json.endpoint, keys: json.keys },
  })
}

/** Asks the browser, then saves this device. Must run from a tap (iOS refuses otherwise). */
export async function turnOnPush(): Promise<PushState> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off'
  const k = await publicKey()
  if (!k) return 'unavailable'
  const reg = (await navigator.serviceWorker.getRegistration('/')) ?? (await navigator.serviceWorker.register('/sw.js'))
  await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: toBytes(k),
    }))
  await save(sub)
  return 'on'
}

/** Sends a test notification to this device. 'gone' means the browser dropped it: turn push on again. */
export async function sendTestPush(): Promise<'sent' | 'gone' | 'failed'> {
  const sub = await subscription()
  if (!sub) return 'gone'
  const r = await api<{ result: 'sent' | 'gone' | 'failed' }>('/v1/notifications/push/test', { method: 'POST', body: { endpoint: sub.endpoint } })
  return r.result
}

export async function turnOffPush(): Promise<PushState> {
  const sub = await subscription()
  if (sub) {
    await api('/v1/notifications/push/subscription', {
      method: 'DELETE',
      body: { endpoint: sub.endpoint },
    }).catch(() => {})
    await sub.unsubscribe().catch(() => {})
  }
  return 'off'
}

/** On sign-out: this device stops getting the person's notifications. Never blocks signing out. */
export async function forgetPushOnSignOut() {
  if (!supported()) return
  try {
    const sub = await subscription()
    if (!sub) return
    await Promise.race([
      api('/v1/notifications/push/subscription', {
        method: 'DELETE',
        body: { endpoint: sub.endpoint },
      }),
      new Promise((r) => setTimeout(r, 1500)),
    ])
    await sub.unsubscribe()
  } catch {
    // Signing out matters more.
  }
}
