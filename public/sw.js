/* Synqop service worker: shows push notifications and opens the right page when one is tapped. No offline caching. */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: event.data ? event.data.text() : 'Synqop' }
  }
  const title = data.title || 'Synqop'
  const show = self.registration.showNotification(title, {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/badge-96.png',
    tag: data.id,
    data: { link: data.link || '/' },
  })
  const badge = 'setAppBadge' in navigator && typeof data.unread === 'number' ? navigator.setAppBadge(data.unread).catch(() => {}) : Promise.resolve()
  event.waitUntil(Promise.all([show, badge]))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.link || '/', self.location.origin).href
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin)
      if (open) {
        await open.focus()
        if ('navigate' in open) return open.navigate(url).catch(() => self.clients.openWindow(url))
        return
      }
      return self.clients.openWindow(url)
    })(),
  )
})
