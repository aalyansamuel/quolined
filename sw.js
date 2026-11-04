/* =============================================================
   Diario de una línea · service worker
   Cambia VERSION cada vez que subas cambios: así el móvil descarga
   la versión nueva y borra la caché anterior.
   ============================================================= */
const VERSION = '1.1.0';
const CACHE = `diario-una-linea-${VERSION}`;
const CORE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/favicon-32.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(CORE.map(url => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const old = keys.filter(k => k.startsWith('diario-una-linea-') && k !== CACHE);
    await Promise.all(old.map(k => caches.delete(k)));
    await self.clients.claim();
    if (old.length) {
      const windows = await self.clients.matchAll({ type: 'window' });
      windows.forEach(c => c.postMessage({ type: 'UPDATED', version: VERSION }));
    }
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navegación: siempre la app guardada (funciona sin conexión)
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cached = await caches.match('./index.html', { cacheName: CACHE });
      if (cached) return cached;
      try {
        return await fetch(req);
      } catch {
        return new Response('<!doctype html><meta charset="utf-8"><title>Sin conexión</title><p style="font:17px system-ui;padding:24px">Sin conexión. Abre la app de nuevo cuando vuelvas a tener red.</p>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
    })());
    return;
  }

  // Resto: primero la caché, después la red
  event.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') {
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone());
      }
      return res;
    } catch {
      return new Response('', { status: 504, statusText: 'Sin conexión' });
    }
  })());
});

/* ---------- Recordatorio en segundo plano (Android/Chrome instalada) ---------- */
function openDB() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('diario-una-linea', 2);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('entradas')) d.createObjectStore('entradas', { keyPath: 'fecha' });
      if (!d.objectStoreNames.contains('fotos')) d.createObjectStore('fotos');
      if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta');
      if (!d.objectStoreNames.contains('frases')) d.createObjectStore('frases', { keyPath: 'fecha' });
    };
    r.onsuccess = () => { const db = r.result; db.onversionchange = () => db.close(); resolve(db); };
    r.onerror = () => reject(r.error);
  });
}
function idbGet(db, store, key) {
  return new Promise((resolve, reject) => {
    const q = db.transaction(store).objectStore(store).get(key);
    q.onsuccess = () => resolve(q.result);
    q.onerror = () => reject(q.error);
  });
}
function idbPut(db, store, value, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
const pad2 = n => String(n).padStart(2, '0');
const isoToday = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };

async function maybeRemind() {
  const db = await openDB();
  try { await remindWith(db); } finally { db.close(); }
}
async function remindWith(db) {
  const ajustes = await idbGet(db, 'meta', 'ajustes');
  if (!ajustes || !ajustes.recordatorio || !ajustes.recordatorio.activo) return;
  const today = isoToday();
  if ((await idbGet(db, 'meta', 'ultimoAviso')) === today) return;
  const [h, m] = String(ajustes.recordatorio.hora || '21:30').split(':').map(Number);
  const now = new Date();
  if (now.getHours() * 60 + now.getMinutes() < h * 60 + m) return;
  if (await idbGet(db, 'entradas', today)) return;
  await self.registration.showNotification('Diario de una línea', {
    body: '¿Cómo resumirías hoy en una línea?',
    tag: 'recordatorio',
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    data: { url: './#hoy' }
  });
  await idbPut(db, 'meta', today, 'ultimoAviso');
}

self.addEventListener('periodicsync', event => {
  if (event.tag === 'recordatorio-diario') event.waitUntil(maybeRemind().catch(() => {}));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of windows) {
      if ('focus' in c) {
        c.postMessage({ type: 'GO', tab: 'hoy' });
        return c.focus();
      }
    }
    return self.clients.openWindow('./#hoy');
  })());
});
