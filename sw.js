// ═══════════════════════════════════════════════════════════
//  SIEMBRA — Service Worker v1.0
//  PWA: caché offline + notificaciones push
// ═══════════════════════════════════════════════════════════

const CACHE_NAME    = 'siembra-v3'; // v3: manifests separados por portal
const CACHE_DYNAMIC = 'siembra-dynamic-v3';

// Archivos a cachear para modo offline
const ASSETS_STATIC = [
  '/',
  '/index.html',
  '/alumno.html',
  '/padres.html',
  // ── PWA Assets (íconos e imagen de instalación) ──────────────
  '/icon-192.png',
  '/icon-512.png',
  '/screenshot1.png',
  '/manifest.json',
  '/manifest-alumno.json',
  '/manifest-padres.json',
  // ── Fuentes ──────────────────────────────────────────────────
  'https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,700;1,700&family=Sora:wght@400;600;700;800&family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap',
];

// ── Install: cachear assets estáticos ──────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_STATIC).catch(() => {});
    })
  );
  self.skipWaiting();
});

// ── Activate: limpiar caches viejos ────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== CACHE_DYNAMIC)
            .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first con fallback a caché ──────────────
self.addEventListener('fetch', e => {
  // Solo interceptar GET y misma origin / Supabase
  if (e.request.method !== 'GET') return;
  
  const url = new URL(e.request.url);
  
  // No interceptar Supabase API (siempre necesita red)
  if (url.hostname.includes('supabase.co')) return;
  // No interceptar Anthropic
  if (url.hostname.includes('anthropic.com')) return;

  e.respondWith(
    fetch(e.request)
      .then(response => {
        // Guardar en caché dinámico
        const clone = response.clone();
        caches.open(CACHE_DYNAMIC).then(cache => cache.put(e.request, clone));
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});

// ── Push Notifications ────────────────────────────────────
self.addEventListener('push', e => {
  if (!e.data) return;
  const data = e.data.json();
  const options = {
    body:    data.body    || 'Nueva notificación de SIEMBRA',
    icon:    data.icon    || '/icon-192.png',
    badge:   data.badge   || '/icon-192.png',
    tag:     data.tag     || 'siembra-notif',
    data:    data.url     || '/',
    actions: data.actions || [
      { action: 'ver', title: 'Ver ahora' },
      { action: 'cerrar', title: 'Cerrar' },
    ],
    vibrate: [200, 100, 200],
  };
  e.waitUntil(
    self.registration.showNotification(data.title || 'SIEMBRA', options)
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'cerrar') return;
  const url = e.notification.data || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(cs => {
      const c = cs.find(x => x.url === url);
      if (c) return c.focus();
      return clients.openWindow(url);
    })
  );
});
