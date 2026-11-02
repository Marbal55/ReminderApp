const CACHE_NAME = 'reminder-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './js/main.js',
    './js/supabase-config.js',
    './manifest.json'
];

// Instalación: Guardar archivos estáticos en caché
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS_TO_CACHE))
            .then(() => self.skipWaiting())
    );
});

// Activación: Limpiar cachés antiguas si actualizamos la versión
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) return caches.delete(cache);
                })
            );
        })
    );
    self.clients.claim();
});

// Intercepción de peticiones
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // No cachear las llamadas a la base de datos de Supabase ni la API de QR
    if (url.hostname.includes('supabase.co') || url.hostname.includes('qrserver.com')) {
        return; 
    }

    // Estrategia Stale-While-Revalidate para el resto de archivos
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, networkResponse.clone());
                });
                return networkResponse;
            }).catch(() => {
                // Falla la red silenciosamente si estamos offline
            });
            return cachedResponse || fetchPromise;
        })
    );
});