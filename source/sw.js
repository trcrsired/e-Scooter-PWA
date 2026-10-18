// Service worker for the e-Scooter PWA.
//
// BUMP SW_VERSION EVERY TIME THIS FILE (or any cached asset's caching logic)
// CHANGES. A new version string creates a fresh cache and drops the old one,
// which is what makes the installed PWA pick up the update.
const SW_VERSION = "0.7.36";
const CACHE = "escooter-" + SW_VERSION;

const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./tuya_ble.js",
  "./offline_state.js",
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

// Stale-while-revalidate for the app shell: answer from the cache instantly
// (so a slow or dead connection never delays the load) and refresh the copy in
// the background. Navigations fall back to the cached root ("./").
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return;
  const isNav = req.mode === "navigate";

  e.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      // The manifest's start_url/id are "./", so the cached root is the shell we
      // want for navigations — fall back to it, not to ./index.html.
      const hit = await cache.match(req) || (isNav ? await cache.match("./") : null);

      if (hit) {
        fetch(req).then(res => {
          if (res && res.ok) { const copy = res.clone(); return cache.put(req, copy); }
        }).catch(() => {});
        return hit;
      }

      // Nothing cached: go to the network (and keep a copy if it answers).
      const res = await fetch(req).catch(() => null);
      if (res && res.ok) {
        const copy = res.clone();
        cache.put(req, copy).catch(() => {});
        return res;
      }
      return Response.error();
    })()
  );
});
