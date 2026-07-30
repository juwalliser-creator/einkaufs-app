const CACHE_NAME = "einkaufs-app-v41";

const PRECACHE_URLS = [
  "./manifest.json",
  "./icons/icon.svg",
];

function isAppShellRequest(url) {
  const path = url.pathname;
  if (url.searchParams.has("gruppe")) {
    return path.endsWith("/") || path.endsWith(".html") || path.endsWith("index.html");
  }
  return (
    path.endsWith("/index.html") ||
    path.endsWith("/js/app.js") ||
    path.endsWith("/js/auth.js") ||
    path.endsWith("/js/firebase-config.js") ||
    path.endsWith("/css/style.css") ||
    path.endsWith("/sw.js") ||
    (!path.includes(".") && path.endsWith("/"))
  );
}

function networkFirst(request) {
  return fetch(request).then(function (response) {
    if (response && response.status === 200) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(function (cache) {
        cache.put(request, copy);
      });
    }
    return response;
  }).catch(function () {
    return caches.match(request).then(function (cached) {
      if (cached) return cached;
      if (request.mode === "navigate") {
        return caches.match("./index.html");
      }
      throw new Error("offline");
    });
  });
}

function cacheFirst(request) {
  return caches.match(request).then(function (cached) {
    if (cached) return cached;
    return networkFirst(request);
  });
}

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE_URLS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE_NAME) return caches.delete(key);
        return undefined;
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate" || isAppShellRequest(url)) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(cacheFirst(event.request));
});
