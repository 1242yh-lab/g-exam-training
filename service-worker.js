const CACHE_NAME = "g-exam-v11";

const urlsToCache = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js?v=20260618-7",
  "./questions.js?v=20260618-7",
  "./manifest.json"
];

// インストール時にキャッシュを作成
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log("キャッシュを開きました");
        return cache.addAll(urlsToCache);
      })
  );
});

// キャッシュから応答を返す
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});

// 古いキャッシュを削除
self.addEventListener("activate", event => {
  const cacheWhitelist = [CACHE_NAME];

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
