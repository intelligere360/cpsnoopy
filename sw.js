// sw.js - CON SISTEMA DE VERSIONADO
const APP_VERSION = 'v2.0.8'; // Actualizar manualmente aquí también
const CACHE_NAME = 'catalogo-peter-snoopy-local-v1.0';
const STATIC_CACHE = `static-catalogo-peter-snoopy-${APP_VERSION}`;
const DYNAMIC_CACHE = `dynamic-catalogo-peter-snoopy-${APP_VERSION}`;
const APP_SHELL = [
  './',
  './index.html', 
  './css/style.css',
  './js/app.js',
  './js/local-config.js',
  './js/notifications-helper.js',
  './js/version-manager.js',
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
    console.log(`🔄 Service Worker ${APP_VERSION} instalando...`);
    
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
    console.log(`🔄 Service Worker ${APP_VERSION} activado`);
    
    e.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.map(key => {
                    // Eliminar todas las caches excepto las de la versión actual
                    if (!key.includes(APP_VERSION)) {
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

// Interceptar mensajes sobre nuevas versiones
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'NEW_VERSION') {
        console.log(`🆕 Nueva versión recibida: ${event.data.version}`);
        
        // Opcional: Actualizar cache de recursos estáticos
        event.waitUntil(
            updateStaticCache(event.data.version)
        );
    }
});

// Función para actualizar cache estático
async function updateStaticCache(newVersion) {
    try {
        const cache = await caches.open(STATIC_CACHE);
        
        // Actualizar recursos críticos
        const resourcesToUpdate = [
            './index.html',
            './js/app.js',
            './js/local-config.js',
            './js/notifications-helper.js',
            './js/version-manager.js',
            './data/config.json',
            './data/productos.json',
            './css/style.css'
        ];
        
        const updatePromises = resourcesToUpdate.map(resource => {
            return fetch(resource, { cache: 'no-store' })
                .then(response => {
                    if (response.ok) {
                        return cache.put(resource, response);
                    }
                })
                .catch(err => {
                    console.warn(`⚠️ Error actualizando ${resource}:`, err);
                });
        });
        
        await Promise.all(updatePromises);
        console.log('✅ Cache estático actualizado para versión', newVersion);
        
        // Notificar a todos los clientes
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'VERSION_UPDATED',
                version: newVersion
            });
        });
        
    } catch (error) {
        console.error('❌ Error actualizando cache:', error);
    }
}

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

// Manejar errores no capturados
self.addEventListener('error', event => {
    console.error('❌ Error en Service Worker:', event.error);
});

self.addEventListener('unhandledrejection', event => {
    console.error('❌ Promise rechazada en Service Worker:', event.reason);
});