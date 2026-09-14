const CACHE_NAME = "elshaday-bible-v1";
const CACHE_PREFIX = "elshaday-bible-";
const DB_NAME = "elshaday-offline-v1";
const OUTBOX_STORE = "outbox";
const SHELL_URLS = ["/elshaday", "/elshaday/gestao", "/elshaday/biblia"];
const SYNC_PATHS = new Set([
  "/api/elshaday/biblia/favoritos",
  "/api/elshaday/biblia/progresso"
]);

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
        .map((name) => caches.delete(name))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "CACHE_SHELL") {
    event.waitUntil(cacheShell());
  }
  if (event.data?.type === "FLUSH_OUTBOX") {
    event.waitUntil(flushOutbox());
  }
});

self.addEventListener("sync", (event) => {
  if (event.tag === "elshaday-bible-sync") {
    event.waitUntil(flushOutbox());
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  if (request.method === "POST" && SYNC_PATHS.has(url.pathname)) {
    event.respondWith(networkOrQueue(request));
    return;
  }

  if (request.method !== "GET") return;

  if (url.pathname === "/api/elshaday/biblia") {
    event.respondWith(staleWhileRevalidateBible(request, event));
    return;
  }

  if (request.mode === "navigate" && url.pathname.startsWith("/elshaday")) {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    ["style", "script", "font", "image"].includes(request.destination)
  ) {
    event.respondWith(cacheFirstAsset(request));
  }
});

async function cacheShell() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.allSettled(
    SHELL_URLS.map(async (path) => {
      const response = await fetch(path, {
        credentials: "include",
        cache: "no-store",
        headers: { "x-elshaday-offline": "shell" }
      });
      if (response.ok) await cache.put(path, response.clone());
    })
  );
}

async function staleWhileRevalidateBible(request, event) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const update = fetch(request.clone())
    .then(async (response) => {
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  if (cached) {
    event.waitUntil(update);
    return cached;
  }

  const response = await update;
  if (response) return response;

  return new Response(
    JSON.stringify({ error: "Este capítulo ainda não foi salvo para uso offline." }),
    { status: 503, headers: { "Content-Type": "application/json; charset=utf-8" } }
  );
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request.clone());
    if (response.ok) {
      try {
        await cache.put(request, response.clone());
      } catch {}
    }
    return response;
  } catch {
    const exact = await cache.match(request, { ignoreSearch: true });
    if (exact) return exact;

    const home = await cache.match("/elshaday/gestao");
    if (home) return home;

    const bible = await cache.match("/elshaday/biblia");
    if (bible) return bible;

    return new Response(
      "<!doctype html><meta name=viewport content='width=device-width,initial-scale=1'><body style='font-family:sans-serif;padding:24px;background:#f3f6f1;color:#0f172a'><h1>Elshaday</h1><p>Sem conexão. Abra a Bíblia enquanto estiver conectado uma vez e toque em ‘Preparar para uso offline’.</p></body>",
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
}

async function cacheFirstAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      try {
        await cache.put(request, response.clone());
      } catch {}
    }
    return response;
  } catch {
    return new Response("", { status: 503 });
  }
}

async function networkOrQueue(request) {
  try {
    return await fetch(request.clone());
  } catch {
    await queueRequest(request);
    try {
      if (self.registration.sync) {
        await self.registration.sync.register("elshaday-bible-sync");
      }
    } catch {}

    return new Response(
      JSON.stringify({ ok: true, offlineQueued: true }),
      { status: 202, headers: { "Content-Type": "application/json; charset=utf-8" } }
    );
  }
}

async function queueRequest(request) {
  const headers = {};
  request.headers.forEach((value, key) => {
    if (!["cookie", "host", "content-length"].includes(key.toLowerCase())) {
      headers[key] = value;
    }
  });

  const body = await request.clone().text();
  const db = await openDb();
  await dbTransaction(db, "readwrite", (store) => store.add({
    url: request.url,
    method: request.method,
    headers,
    body,
    createdAt: Date.now()
  }));
}

async function flushOutbox() {
  const db = await openDb();
  const items = await dbTransaction(db, "readonly", (store) => requestToPromise(store.getAll()));

  for (const item of items) {
    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
        credentials: "include"
      });
      if (response.ok) {
        await dbTransaction(db, "readwrite", (store) => store.delete(item.id));
      }
    } catch {
      break;
    }
  }
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        db.createObjectStore(OUTBOX_STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function dbTransaction(db, mode, operation) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OUTBOX_STORE, mode);
    const store = tx.objectStore(OUTBOX_STORE);
    let result;
    try {
      result = operation(store);
    } catch (error) {
      reject(error);
      return;
    }
    tx.oncomplete = async () => {
      try {
        resolve(result && typeof result.then === "function" ? await result : result);
      } catch (error) {
        reject(error);
      }
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
