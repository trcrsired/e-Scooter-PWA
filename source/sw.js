// Service worker for the e-Scooter PWA.
//
// BUMP SW_VERSION EVERY TIME THIS FILE (or any cached asset's caching logic)
// CHANGES. A new version string creates a fresh cache and drops the old one,
// which is what makes the installed PWA pick up the update.
const SW_VERSION = "0.7.19";
const CACHE = "escooter-" + SW_VERSION;

const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./tuya_ble.js",
  "./tuya_crypto.wasm",
  "./manifest.json",
  "./escooterpwa.webp",
  "./sw-register.js",
];

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {})
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first: always prefer fresh files, fall back to cache when offline.
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() =>
      caches.match(req).then(hit => hit || caches.match("./index.html"))
    )
  );
});
