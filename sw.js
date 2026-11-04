// sw.js — the page works offline: every file it has fetched from this site is kept, and used when the network is not there.
// Online, the network always wins, so a new receipt is never hidden behind an old copy.
const V = 'bred-minds-6';
// the page's modules and every record it reads as it loads, so one visit is enough to work offline (test/page.test.mjs
// fails the build if the page reads a file this list leaves out); the six books are kept once the reader loads them
const SHELL = ['./', 'index.html', 'page/page.css', 'page/app.mjs', 'page/boot.js', 'manifest.webmanifest', 'page/icon.svg',
  'src/text.mjs', 'src/trace.mjs', 'src/judge.mjs', 'src/card.mjs', 'src/cost.mjs', 'src/stats.mjs', 'src/breed.mjs', 'src/years.mjs',
  'vendor/seed-library/seedlib.mjs', 'vendor/seed-library/sha256.mjs', 'vendor/sovereign-enterprise/data/basis.json',
  'claims/organ-1.json', 'claims/organ-2.json', 'data/sources.json', 'data/cards.json', 'data/drawn.json', 'data/prices.lock.json', 'data/witness.json',
  'data/local/maxims.json', 'data/local/perspectives.json', 'data/local/perspectives-2.json', 'data/children.json', 'data/after/organ-1-lean.json',
  'data/judge/order.json', 'data/judge/usage.json', 'data/judge2/order.json', 'receipts/organ-1.json', 'receipts/organ-2.json',
  ...[1, 2, 3, 4].flatMap((n) => ['data/judge/batch-' + n + '.json', 'data/judge/batch-' + n + '.prompt.txt']),
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => 'data/judge2/batch-' + n + '.json')];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(fetch(e.request).then((r) => { if (r.ok) { const c = r.clone(); caches.open(V).then((x) => x.put(e.request, c)); } return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
