/* Alga Play KZ — service worker. Static app-shell cache (offline-capable, installable). */
const CACHE = "algaplay-v4";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon.svg",
  "./icons/icon-maskable.svg",
  "./css/style.css?v=4",
  "./js/i18n.js?v=4",
  "./js/core.js?v=4",
  "./js/pwa.js?v=4",
  "./js/games/togyz.js?v=4",
  "./js/games/belka.js?v=4",
  "./js/games/durak.js?v=4",
  "./js/games/asyq.js?v=4",
  "./js/app.js?v=4",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache-first for same-origin GET; network fallback (and cache the fresh copy).
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match("./index.html")))
  );
});
