// sw.js - VERSIÓN MEJORADA PARA EVITAR ERRORES
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
  './images/icon-192-2.png',
  './images/icon-512-2.png',
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

// ✅ NUEVO: Función para manejar errores de fetch de forma segura
function handleFetchWithFallback(event, cacheStrategy) {
  // Verificar que el evento aún es válido
  if (event.request.cache === 'only-if-cached' && event.request.mode !== 'same-origin') {
    return;
  }
  
  event.respondWith(
    cacheStrategy(event).catch(error => {
      console.warn('❌ Error en fetch, usando fallback:', error);
      // Fallback seguro para evitar el error de canal cerrado
      return new Response('', {
        status: 408,
        statusText: 'Request Timeout'
      });
    })
  );
}

// Fetch - Estrategias mejoradas
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Estrategia para JSON (siempre red primero)
  if (url.pathname.includes(GOOGLE_DRIVE_CONFIG.PRODUCTS_JSON_ID) || 
      url.pathname.endsWith('.json') ||
      url.pathname.includes(GOOGLE_DRIVE_CONFIG.CONFIG_JSON_ID)) {
    handleFetchWithFallback(event, async (event) => {
      try {
        const networkResponse = await fetch(event.request);
        if (networkResponse.status === 200 && isCacheableRequest(event.request)) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      } catch (error) {
        const cachedResponse = await caches.match(event.request);
        return cachedResponse || new Response('{}', {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    });
  }
  // Estrategia para imágenes 
  else if (url.href.includes('googleapis.com') || url.href.includes('uc?export=download') ||
      url.pathname.endsWith('.jpg') || 
      url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.jpeg')) {
    
    handleFetchWithFallback(event, async (event) => {
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(event.request);
      
      if (cachedResponse) {
        console.log('🖼️ Imagen servida desde cache:', url.pathname);
        return cachedResponse;
      }
      
      try {
        const networkResponse = await fetch(event.request);
        if (networkResponse.status === 200 && isCacheableRequest(event.request)) {
          console.log('📥 Guardando imagen en cache:', url.pathname);
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      } catch (error) {
        console.warn('🌐 Error de red, usando placeholder');
        const placeholder = await caches.match('./images/placeholder.jpg');
        return placeholder || new Response('Placeholder image not available', { status: 404 });
      }
    });
  }
  
  // Para otros archivos (CSS, JS, HTML) - Cache First
  else {
    handleFetchWithFallback(event, async (event) => {
      const cachedResponse = await caches.match(event.request);
      return cachedResponse || fetch(event.request);
    });
  }
});

// En sw.js - agregar después de las estrategias existentes

// ✅ NUEVO: Estrategia de precarga agresiva para imágenes
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'PRECACHE_IMAGES') {
        event.waitUntil(
            precacheImages(event.data.urls)
        );
    }
});

async function precacheImages(urls) {
    const cache = await caches.open(CACHE_NAME);
    
    for (const url of urls) {
        try {
            // Verificar si ya está en cache
            const cached = await cache.match(url);
            if (!cached) {
                const response = await fetch(url, {
                    mode: 'cors',
                    credentials: 'omit'
                });
                
                if (response.status === 200) {
                    await cache.put(url, response.clone());
                    console.log('✅ Precached en SW:', url);
                }
            }
        } catch (error) {
            console.warn('❌ Error precaching en SW:', url);
        }
    }
}