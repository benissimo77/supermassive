const CACHE_NAME = 'supermassive-cache-v1';
const ASSETS = [
    // Entry page assets
    '/play/',
    '/play/index.html',
    '/css/play.css',
    '/img/w3logo.png',

    // Game page assets
    '/play/phaserplay.html',
    '/js/phaser.min.js',
    '/js/bundle.js',
    '/audio/silent-heartbeat.mp3',

    // Common assets (fonts, etc)
    'https://fonts.googleapis.com/css2?family=Titan+One&display=swap',
    'https://fonts.googleapis.com/css2?family=Poppins:wght@400;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.4/gsap.min.js'
];

// Cache strategy: Cache first, then network
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
    // Network-first strategy for socket.io and API calls
    if (event.request.url.includes('/socket.io/') ||
        event.request.url.includes('/api/')) {
        event.respondWith(
            fetch(event.request).catch(() => {
                return caches.match(event.request);
            })
        );
        return;
    }

    // Cache-first strategy for assets
    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(event.request);
            })
    );
});