self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (event.request.mode === "navigate" && url.pathname.startsWith("/calda-facil")) {
    event.respondWith(fetch(event.request, { cache: "no-store" }));
  }
});
