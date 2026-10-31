// sw.js — the page works offline: every file it has fetched from this site is kept, and used when the network is not there.
// Online, the network always wins, so a new receipt is never hidden behind an old copy.
const V = 'bred-minds-4';
const SHELL = ['./', 'index.html', 'page/page.css', 'page/app.mjs', 'page/boot.js', 'src/text.mjs', 'src/trace.mjs', 'src/judge.mjs', 'src/card.mjs', 'src/cost.mjs', 'src/stats.mjs',
  'vendor/seed-library/seedlib.mjs', 'vendor/seed-library/sha256.mjs', 'manifest.webmanifest', 'page/icon.svg'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(fetch(e.request).then((r) => { if (r.ok) { const c = r.clone(); caches.open(V).then((x) => x.put(e.request, c)); } return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
