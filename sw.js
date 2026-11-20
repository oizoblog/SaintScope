const CACHE = 'saintscope-v03-ai8';
const ASSETS = [
  './', './index.html', './saints.js', './prompts.js', './recognition-history.js',
  './image-guard.js', './app.js', './ai-worker.bundle.js', './manifest.webmanifest', './icon.svg',
  './icon-192.png', './icon-512.png', './apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS);
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE && /^saintscope-v\d+-ai\d+$/.test(key)).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith((async () => (await caches.match(request)) || fetch(request))());
});
