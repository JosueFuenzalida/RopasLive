const CACHE_NAME = "live-commerce-v2";
const ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/css/main.css",
  "/css/theme.css",
  "/css/layout.css",
  "/css/live.css",
  "/js/app.js",
  "/js/router.js",
  "/js/db.js",
  "/js/live.js",
  "/js/backup.js",
  "/js/sync.js",
  "/js/ui.js",
  "/js/utils.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
