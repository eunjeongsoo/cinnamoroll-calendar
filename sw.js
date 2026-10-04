/* sw.js — 오프라인 동작용 서비스워커 (앱 파일을 기기에 저장해 둬요) */
var CACHE = "cinnamo-calendar-v4";
var ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/theme.css",
  "./css/app.css",
  "./js/storage.js",
  "./js/utils.js",
  "./js/ui.js",
  "./js/calendar.js",
  "./js/events.js",
  "./js/members.js",
  "./js/fun.js",
  "./js/settings.js",
  "./js/app.js",
  "./icons/app/face.png",
  "./icons/app/face-lg.png",
  "./icons/app/important.png",
  "./icons/app/lesson.png",
  "./icons/app/duty.png",
  "./icons/app/off.png",
  "./icons/app/wave.png",
  "./icons/app/hat.png",
  "./icons/app/ears.png",
  "./icons/app/lying.png",
  "./icons/app/peek.png",
  "./icons/app/toast.png",
  "./icons/app/fy.png",
  "./icons/app/gift.png",
  "./icons/app/stickers.png",
  "./icons/app/icon-192.png",
  "./icons/app/icon-512.png",
  "./icons/app/apple-touch-icon.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // 파일을 하나씩 받아 저장 (하나가 실패해도 나머지는 저장돼요)
      return Promise.all(ASSETS.map(function (url) {
        return fetch(url, { cache: "reload" }).then(function (res) {
          if (res.ok) return c.put(url, res);
        }).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// 저장된 파일을 먼저 보여주고, 온라인이면 뒤에서 최신 파일로 갱신해요
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(req, { ignoreSearch: true }).then(function (cached) {
        var network = fetch(req).then(function (res) {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(function () {
          if (req.mode === "navigate") return cache.match("./index.html");
          return cached || Response.error();
        });
        if (cached) {
          e.waitUntil(network.catch(function () {}));
          return cached;
        }
        return network;
      });
    })
  );
});

self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) if ("focus" in list[i]) return list[i].focus();
      if (self.clients.openWindow) return self.clients.openWindow("./");
    })
  );
});
