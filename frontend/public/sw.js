// Service Worker: network-first 캐시 전략 (오프라인 fallback)
const CACHE_NAME = "theme-analysis-v2"
const DATA_PATTERN = /\/data\/.*\.json$/

self.addEventListener("install", (event) => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url)

  // data/*.json 파일만 캐싱 대상
  if (!DATA_PATTERN.test(url.pathname)) return

  // network-first: 네트워크 우선, 실패 시 캐시 fallback
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            cache.put(event.request, response.clone())
          }
          return response
        })
        .catch(() => cache.match(event.request))
    )
  )
})
