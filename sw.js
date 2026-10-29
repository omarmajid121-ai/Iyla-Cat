const CACHE = 'lili-v3';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png','sounds/meow_a.mp3','sounds/meow_b.mp3','sounds/mew.mp3','sounds/meow_c.mp3','sounds/meow_low.mp3','sounds/laugh_a.mp3','sounds/laugh_b.mp3','sounds/laugh_c.mp3','sounds/snore.mp3','sounds/sneeze_a.mp3','sounds/sneeze_b.mp3','sounds/cough.mp3','sounds/sip.mp3','sounds/pour.mp3','sounds/brush.mp3','sounds/breath.mp3'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
