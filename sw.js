// sw.js - Versión corregida para evitar errores con chrome-extension
const CACHE_NAME = 'catalogo-cell-phone-snoopy-notificaciones-v1';
const STATIC_CACHE = 'static-catalogo-v1.1';
const STATIC_FILES = [
  './',
  './index.html', 
  './css/style.css',
  './js/app.js',
  './js/drive-config.js',
  './js/notifications-helper.js',
  './manifest.json',
  './images/icon-192.png',
  './images/icon-512.png',
  './images/screenshot-mobile.png',
  './images/screenshot-desktop.png',
  './images/placeholder.jpg'
];

// Instalación - Cache de archivos estáticos
self.addEventListener('install', (event) => {
  console.log('🛠️ Service Worker instalando...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('📦 Cacheando archivos estáticos');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => self.skipWaiting())
  );
});

// Activación - Limpiar caches viejas
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker activado');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE) {
            console.log('🧹 Eliminando cache vieja:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Función auxiliar para verificar si una request es cacheable
function isCacheableRequest(request) {
  const url = new URL(request.url);
  // Solo cachear solicitudes http/https y del mismo origen
  return url.protocol === 'http:' || url.protocol === 'https:';
}

// Fetch - Estrategia Cache First para imágenes, Network First para datos
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Estrategia para imágenes
  if (url.pathname.includes('/uc?export=view') || 
      url.href.includes('googleusercontent.com') ||
      url.pathname.endsWith('.jpg') || 
      url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.jpeg')) {
    
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          // Si está en cache, devolverla
          if (cachedResponse) {
            console.log('🖼️ Imagen servida desde cache:', url.pathname);
            return cachedResponse;
          }
          
          // Si no está en cache, buscarla en red y guardarla
          return fetch(event.request).then((networkResponse) => {
            if (networkResponse.status === 200 && isCacheableRequest(event.request)) {
              console.log('📥 Guardando imagen en cache:', url.pathname);
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
            // Si falla la red, devolver placeholder
            return caches.match('/images/placeholder.jpg');
          });
        });
      })
    );
  }

  // Estrategia para JSON (siempre red primero)
  else if (url.pathname.includes('/uc?export=download') || url.pathname.endsWith('.json')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // Guardar en cache para offline solo si es cacheable
          if (networkResponse.status === 200 && isCacheableRequest(event.request)) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Si falla la red, buscar en cache
          return caches.match(event.request);
        })
    );
  }
  
  // Para otros archivos (CSS, JS, HTML) - Cache First
  else {
    event.respondWith(
      caches.match(event.request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(event.request);
        })
    );
  }
});