// Service Worker: stale-while-revalidate 캐시 전략
const CACHE_NAME = "theme-analysis-v1"
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

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(event.request).then((cached) => {
        const fetchPromise = fetch(event.request)
          .then((response) => {
            if (response.ok) {
              cache.put(event.request, response.clone())
            }
            return response
          })
          .catch(() => cached)

        // stale-while-revalidate: 캐시된 응답 즉시 반환, 백그라운드에서 갱신
        return cached || fetchPromise
      })
    )
  )
})
