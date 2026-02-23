// Simple offline cache for iPhone Safari
const CACHE = "pitch-tracker-cache-v1";
const ASSETS = ["./", "./index.html", "./app.js", "./sw.js"];

self.addEventListener("install", (evt) => {
  evt.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evt) => {
  evt.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (evt) => {
  evt.respondWith(
    caches.match(evt.request).then(cached => cached || fetch(evt.request).catch(()=>cached))
  );
});
