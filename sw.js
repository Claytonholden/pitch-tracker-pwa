// Simple offline cache for iPhone Safari (single-file app)
const CACHE = "pitch-tracker-cache-v3";
const ASSETS = ["./", "./index.html", "./sw.js"];

self.addEventListener("install", (evt) => {
  evt.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evt) => {
  evt.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k !== CACHE ? caches.delete(k) : Promise.resolve())))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (evt) => {
  evt.respondWith(
    caches.match(evt.request).then(cached => {
      return cached || fetch(evt.request).catch(() => cached);
    })
  );
});
