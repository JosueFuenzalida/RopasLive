const CACHE = 'ropas-v3';
const ASSETS = ['./', './index.html', './manifest.json', './css/main.css',
  './js/app.js', './js/db.js', './js/printer.js', './js/export.js',
  'https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap'];

self.addEventListener('install',  e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
    if (r.ok) caches.open(CACHE).then(c => c.put(e.request, r.clone()));
    return r;
  }).catch(() => caches.match('./index.html'))));
});
