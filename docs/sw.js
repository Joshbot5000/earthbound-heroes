// Offline support: the game, its data and every real city are cached on first visit.
const CACHE = "earthbound-mwmcqh0a";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "cities/dubai.bin.gz", "cities/london.bin.gz", "cities/mumbai.bin.gz", "cities/newyork.bin.gz", "cities/paris.bin.gz", "cities/sydney.bin.gz", "cities/tokyo.bin.gz"];
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE && x.startsWith("earthbound")).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;   // live weather goes straight to the network
  // city files never change within a version: serve from cache first; everything else network first
  if (u.pathname.includes("/cities/")) { e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { const c = res.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return res; }))); return; }
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
});
