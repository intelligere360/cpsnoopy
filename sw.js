// sw.js - VERSIÓN MEJORADA PARA EVITAR ERRORES
const CACHE_NAME = 'catalogo-peter-snoopy-local-v1.0';
const STATIC_CACHE = 'static-catalogo-v2.0';
const DYNAMIC_CACHE = 'dynamic-catalogo-local-v1.0';
const APP_SHELL = [
  './',
  './index.html', 
  './css/style.css',
  './js/app.js',
  './js/local-config.js',
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

// Instalación - Cachear recursos estáticos
self.addEventListener('install', e => {
    console.log('🔄 Service Worker instalando (versión local)...');
    
    e.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('📂 Cacheando shell de la app');
                return cache.addAll(APP_SHELL);
            })
            .then(() => {
                console.log('✅ Instalación completada');
                return self.skipWaiting();
            })
    );
});

// Activar y limpiar caches viejos
self.addEventListener('activate', e => {
    console.log('🔄 Service Worker activado (versión local)');
    
    e.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.map(key => {
                    if (key !== STATIC_CACHE && key !== DYNAMIC_CACHE) {
                        console.log('🗑️ Eliminando cache vieja:', key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => {
            console.log('✅ Activación completada');
            return self.clients.claim();
        })
    );
});

// Estrategia de cache: Cache First, Network Fallback
self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);
    
    // Ignorar solicitudes no HTTP
    if (!e.request.url.startsWith('http')) return;
    
    // Para archivos de datos e imágenes, usar estrategia diferente
    if (url.pathname.includes('/data/')) {
        // Para archivos JSON e imágenes locales
        e.respondWith(
            caches.match(e.request)
                .then(cachedResponse => {
                    // Si está en cache, devolverlo
                    if (cachedResponse) {
                        console.log('✅ Sirviendo desde cache:', url.pathname);
                        return cachedResponse;
                    }
                    
                    // Si no está en cache, obtener de red y guardar en cache dinámica
                    return fetch(e.request)
                        .then(networkResponse => {
                            // Clonar respuesta para cache y uso
                            const responseClone = networkResponse.clone();
                            
                            caches.open(DYNAMIC_CACHE)
                                .then(cache => {
                                    cache.put(e.request, responseClone);
                                });
                            
                            return networkResponse;
                        })
                        .catch(() => {
                            // Fallback para imágenes
                            if (url.pathname.includes('.jpg') || 
                                url.pathname.includes('.png') || 
                                url.pathname.includes('.webp')) {
                                return caches.match('./images/placeholder.jpg');
                            }
                            return new Response('Recurso no disponible', {
                                status: 404,
                                headers: { 'Content-Type': 'text/plain' }
                            });
                        });
                })
        );
    } else {
        // Para otros recursos, usar estrategia estándar
        e.respondWith(
            caches.match(e.request)
                .then(cachedResponse => {
                    return cachedResponse || fetch(e.request)
                        .then(networkResponse => {
                            return caches.open(DYNAMIC_CACHE)
                                .then(cache => {
                                    cache.put(e.request, networkResponse.clone());
                                    return networkResponse;
                                });
                        })
                        .catch(() => {
                            // Fallback para página principal
                            if (e.request.mode === 'navigate') {
                                return caches.match('./index.html');
                            }
                        });
                })
        );
    }
});

// Mensajes para precarga
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'PRECACHE_IMAGES') {
        const urls = event.data.urls;
        console.log('📥 Precargando imágenes en Service Worker:', urls.length);
        
        event.waitUntil(
            caches.open(DYNAMIC_CACHE)
                .then(cache => {
                    const cachePromises = urls.map(url => {
                        return fetch(url, { mode: 'no-cors' })
                            .then(response => {
                                if (response.ok || response.type === 'opaque') {
                                    return cache.put(url, response);
                                }
                            })
                            .catch(err => {
                                console.warn('❌ Error cacheando imagen:', url, err);
                            });
                    });
                    return Promise.all(cachePromises);
                })
        );
    }
});