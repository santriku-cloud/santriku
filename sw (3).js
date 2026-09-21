// Service worker SIBEST
//  - Cache sederhana: selalu ambil versi terbaru dari internet, salinan hanya dipakai saat offline.
//  - Notifikasi push dari Firebase Cloud Messaging (guru & admin).
const CACHE = "sibest-v2";

self.addEventListener("install", () => { self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match("./")))
  );
});

async function updateBadge() {
  try {
    const n = (await self.registration.getNotifications()).length;
    if (self.navigator && self.navigator.setAppBadge) {
      if (n > 0) await self.navigator.setAppBadge(n);
      else if (self.navigator.clearAppBadge) await self.navigator.clearAppBadge();
    }
  } catch (_) {}
}

self.addEventListener("push", e => {
  e.waitUntil((async () => {
    let payload = {};
    try { payload = e.data ? e.data.json() : {}; }
    catch (_) { try { payload = { data: { body: e.data.text() } }; } catch (__) {} }

    const d = Object.assign({}, payload.notification || {}, payload.data || {});
    const title = d.title || "SIBEST";
    const body = d.body || "Ada pembaruan baru.";

    // Jika aplikasi sedang terbuka dan terlihat, kabari halaman itu supaya langsung menampilkan pemberitahuan di dalam aplikasi.
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const visible = wins.filter(c => c.visibilityState === "visible");
    if (visible.length) {
      visible.forEach(c => c.postMessage({ sibestPush: true, title, body, type: d.type || "" }));
      return;
    }

    await self.registration.showNotification(title, {
      body,
      icon: "icon-192.png",
      badge: "icon-192.png",
      tag: d.type || "sibest",
      renotify: true,
      data: { url: d.url || "./" }
    });
    await updateBadge();
  })());
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    let opened = false;
    for (const c of wins) {
      if ("focus" in c) { await c.focus(); opened = true; break; }
    }
    if (!opened && self.clients.openWindow) {
      await self.clients.openWindow((e.notification.data && e.notification.data.url) || "./");
    }
    await updateBadge();
  })());
});
