// Service worker: guarda la app en el dispositivo para abrirla sin internet.
// Los datos (movimientos, cuentas) los guarda Firestore en su propia caché local.
const CACHE = 'mis-lucas-v2'
const SHELL = ['/', '/manifest.webmanifest', '/favicon.svg', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

const timeout = (ms) => new Promise((_, reject) => setTimeout(reject, ms))

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  // Páginas: red primero (para recibir actualizaciones); sin red, la copia guardada.
  if (req.mode === 'navigate') {
    e.respondWith(
      Promise.race([fetch(req), timeout(4000)])
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('/', copy)) }
          return res
        })
        .catch(() => caches.match('/'))
    )
    return
  }

  // Archivos de la app y tipografías: copia guardada al instante, y se refresca en segundo plano.
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'
  if (url.origin !== location.origin && !fonts) return
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res.ok && !(res.headers.get('content-type') || '').includes('text/html')) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)) }
          return res
        })
        .catch(() => hit)
      return hit || net
    })
  )
})

// Notificaciones push (FCM envía datos: title, body, url)
self.addEventListener('push', (e) => {
  let p = {}
  try { p = e.data ? e.data.json() : {} } catch { /* sin datos */ }
  const n = p.notification || p.data || {}
  e.waitUntil(self.registration.showNotification(n.title || 'Mis Lucas', {
    body: n.body || '', icon: '/icon-192.png', badge: '/icon-192.png', data: { url: n.url || '/' },
  }))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || '/'
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (list) => {
    for (const c of list) {
      try { await c.navigate(url); return c.focus() } catch { /* probar con otra ventana */ }
    }
    return self.clients.openWindow(url)
  }))
})
