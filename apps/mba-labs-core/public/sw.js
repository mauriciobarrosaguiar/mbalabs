const CACHE_VERSION = "mba-labs-pwa-v2";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const ELSHADAY_PAGE_CACHE = `${CACHE_VERSION}-elshaday-pages`;
const BIBLE_CACHE = `${CACHE_VERSION}-bible`;
const OFFLINE_URL = "/offline";

const SAFE_ELSHADAY_PAGES = new Set([
  "/elshaday/biblia",
  "/elshaday/eventos",
  "/elshaday/pregacoes"
]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) =>
        cache.addAll([
          new Request(OFFLINE_URL, { cache: "reload" }),
          new Request("/manifest.webmanifest", { cache: "reload" })
        ])
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(CACHE_VERSION))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CLEAR_PRIVATE_CACHES") return;

  event.waitUntil(
    caches.delete(ELSHADAY_PAGE_CACHE)
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  if (
    url.pathname.startsWith("/_next/webpack-hmr") ||
    url.pathname.includes("supabase")
  ) {
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/elshaday/biblia") {
    event.respondWith(networkFirstBible(request));
    return;
  }

  if (request.method !== "GET") return;

  if (request.mode === "navigate") {
    if (SAFE_ELSHADAY_PAGES.has(url.pathname)) {
      event.respondWith(networkFirstSafePage(request));
      return;
    }

    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(STATIC_CACHE);
        return (await cache.match(OFFLINE_URL)) || Response.error();
      })
    );
    return;
  }

  const isSafeStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/pwa/") ||
    url.pathname === "/manifest.webmanifest" ||
    /\.(?:css|js|woff2?|png|jpg|jpeg|svg|webp|ico)$/i.test(url.pathname);

  if (!isSafeStaticAsset) return;

  event.respondWith(cacheFirstStatic(request));
});

async function networkFirstBible(request) {
  const cache = await caches.open(BIBLE_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;

    return new Response(
      JSON.stringify({
        error: "Este capítulo ainda não foi aberto neste aparelho e não está disponível offline."
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      }
    );
  }
}

async function networkFirstSafePage(request) {
  const cache = await caches.open(ELSHADAY_PAGE_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;

    const staticCache = await caches.open(STATIC_CACHE);
    return (await staticCache.match(OFFLINE_URL)) || Response.error();
  }
}

async function cacheFirstStatic(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (!response || response.status !== 200 || response.type !== "basic") {
    return response;
  }

  const copy = response.clone();
  void caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
  return response;
}
