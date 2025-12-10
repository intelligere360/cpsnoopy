// sw.js - VERSIÓN CORREGIDA PARA EVITAR ERRORES CON POST
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
    
    // 1. Ignorar solicitudes no HTTP
    if (!e.request.url.startsWith('http')) return;
    
    // 2. ✅ NUEVO: IGNORAR solicitudes POST (EmailJS, Google Apps Script, etc.)
    if (e.request.method !== 'GET') {
        console.log(`⏩ Ignorando solicitud ${e.request.method} a ${url.pathname}`);
        return; // Dejar pasar sin cachear
    }
    
    // 3. ✅ NUEVO: IGNORAR URLs de APIs externas que no queremos cachear
    const externalApis = [
        'emailjs.com',
        'script.google.com',
        'googleapis.com',
        'wa.me',
        'api.whatsapp.com'
    ];
    
    const isExternalApi = externalApis.some(api => url.href.includes(api));
    if (isExternalApi) {
        console.log(`🌐 Pasando API externa sin cachear: ${url.hostname}`);
        return fetch(e.request); // Pasar directamente sin cachear
    }
    
    // 4. Para archivos de datos e imágenes locales
    if (url.pathname.includes('/data/')) {
        e.respondWith(
            caches.match(e.request)
                .then(cachedResponse => {
                    // Si está en cache, devolverlo
                    if (cachedResponse) {
                        console.log('✅ Sirviendo desde cache:', url.pathname);
                        return cachedResponse;
                    }
                    
                    // Si no está en cache, obtener de red
                    return fetch(e.request)
                        .then(networkResponse => {
                            // ✅ NUEVO: Solo cachear si la respuesta es válida
                            if (networkResponse.ok) {
                                const responseClone = networkResponse.clone();
                                caches.open(DYNAMIC_CACHE)
                                    .then(cache => {
                                        cache.put(e.request, responseClone)
                                            .catch(err => {
                                                console.warn('⚠️ Error cacheando:', url.pathname, err);
                                            });
                                    });
                            }
                            return networkResponse;
                        })
                        .catch(() => {
                            // Fallback para imágenes
                            if (url.pathname.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
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
        // Para otros recursos GET
        e.respondWith(
            caches.match(e.request)
                .then(cachedResponse => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    
                    return fetch(e.request)
                        .then(networkResponse => {
                            // ✅ NUEVO: Verificar que sea cacheable
                            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                                return networkResponse;
                            }
                            
                            const responseClone = networkResponse.clone();
                            caches.open(DYNAMIC_CACHE)
                                .then(cache => {
                                    cache.put(e.request, responseClone)
                                        .catch(err => {
                                            console.warn('⚠️ No se pudo cachear:', url.pathname, err);
                                        });
                                });
                            
                            return networkResponse;
                        })
                        .catch(() => {
                            // Fallback para navegación
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
                        // ✅ NUEVO: Solo precachear imágenes locales (no externas)
                        if (!url.includes('/data/productos/') && !url.startsWith('./')) {
                            console.log('⏩ Saltando precache de imagen externa:', url);
                            return Promise.resolve();
                        }
                        
                        return fetch(url, { mode: 'cors' }) // Cambiar de 'no-cors' a 'cors'
                            .then(response => {
                                if (response.ok) {
                                    return cache.put(url, response);
                                } else {
                                    console.warn('❌ Respuesta no OK para:', url, response.status);
                                }
                            })
                            .catch(err => {
                                console.warn('❌ Error cacheando imagen:', url, err);
                            });
                    });
                    return Promise.all(cachePromises);
                })
                .then(() => {
                    console.log('✅ Precarga de imágenes completada');
                })
        );
    }
});

// Manejar errores no capturados
self.addEventListener('error', event => {
    console.error('❌ Error en Service Worker:', event.error);
});

self.addEventListener('unhandledrejection', event => {
    console.error('❌ Promise rechazada en Service Worker:', event.reason);
});