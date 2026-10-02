const CACHE_NAME = "p3hpl-static-v4";

const NAVIGATION_PAGES = [
  "index.html",
  "input-realisasi.html",
  "rpd.html",
  "monitoring.html",
  "grafik.html",
  "laporan.html",
  "audit.html"
];

self.addEventListener("install", function (event) {
  self.skipWaiting();

  // Cache only the lightweight HTML shells during installation.
  // JS/CSS/images are cached naturally as they are requested.
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(NAVIGATION_PAGES);
    }).catch(function (error) {
      console.warn("Pre-cache halaman P3HPL gagal:", error);
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then(function (keys) {
        return Promise.all(
          keys
            .filter(function (key) {
              return key.startsWith("p3hpl-static-") && key !== CACHE_NAME;
            })
            .map(function (key) {
              return caches.delete(key);
            })
        );
      })
    ])
  );
});

self.addEventListener("fetch", function (event) {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Hanya cache resource dari GitHub Pages sendiri.
  if (url.origin !== self.location.origin) return;

  // Navigasi antar-menu: tampilkan cache segera, lalu update cache
  // dari jaringan di belakang layar.
  if (request.mode === "navigate") {
    event.respondWith(
      caches.open(CACHE_NAME).then(async function (cache) {
        const cached = await cache.match(request);

        const networkPromise = fetch(request)
          .then(function (response) {
            if (response && response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(function () {
            return cached || Response.error();
          });

        return cached || networkPromise;
      })
    );
    return;
  }

  // Resource aplikasi lokal menggunakan NETWORK-FIRST.
  // Ini penting agar perubahan JS/CSS langsung diterima tanpa
  // pengguna harus menekan Ctrl+F5. Jika jaringan gagal,
  // resource lama dari cache tetap menjadi fallback.
  const destination = request.destination;

  if (
    destination === "script" ||
    destination === "style" ||
    destination === "image" ||
    destination === "font"
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async function (cache) {
        try {
          const response = await fetch(request, {
            cache: "no-cache"
          });

          if (response && response.ok) {
            await cache.put(request, response.clone());
          }

          return response;
        } catch (error) {
          const cached = await cache.match(request);
          if (cached) return cached;
          throw error;
        }
      })
    );
  }
});
