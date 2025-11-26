// Sistema de cache de imágenes con IndexedDB
const ImageCacheDB = {
    dbName: 'ImageCacheDB',
    storeName: 'images',
    version: 1,

    async openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName);
                }
            };
        });
    },

    async saveImage(url, blob) {
        try {
            const db = await this.openDB();
            const transaction = db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            store.put(blob, url);
            return transaction.complete;
        } catch (error) {
            console.warn('❌ Error guardando imagen en IndexedDB:', error);
        }
    },

    async getImage(url) {
        try {
            const db = await this.openDB();
            const transaction = db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            return new Promise((resolve, reject) => {
                const request = store.get(url);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve(request.result);
            });
        } catch (error) {
            console.warn('❌ Error obteniendo imagen de IndexedDB:', error);
            return null;
        }
    },

    async imageExists(url) {
        const image = await this.getImage(url);
        return image !== undefined;
    }
};

// app.js - VERSIÓN CORREGIDA CON SCROLL FUNCIONAL
let productos = [];
let productoActual = null;
const STATIC_CACHE = 'static-catalogo-v1.1';

// =============================================
// CONFIGURACIÓN DE CONTACTO Y NOTIFICACIONES
// =============================================
const configContacto = {
    telefono: "+584126597297",
    whatsapp: "584126597297", 
    email: "ramonsimancas61@gmail.com",
    mensajeWhatsapp: "Hola, me interesan sus artículos del catálogo",
    vendedor: "Cell Phone Snoopy: DE TODO UN POCO",
    
    proveedor: {
        email: "intelligere360@gmail.com",
        serviceId: "service_n6cbbge",
        templateId: "template_qx7z8s9", 
        userId: "hzEWYG4E0PQlhs2e_"
    }
};

// =============================================
// ESTADO GLOBAL DE LA APLICACIÓN
// =============================================
const AppState = {
    productoActual: null,
    sessionId: generarSessionId(),
    mensajesPendientes: [],
    imagenesPrecargadas: new Set(),
    // ✅ NUEVO: Configuración de la aplicación
    config: {
        mostrar_precios: true, // Valor por defecto
        version: "1.0.0",
        idioma: "es"
    }
};

// =============================================
// SISTEMA DE CONFIGURACIÓN
// =============================================

/**
 * Carga la configuración desde config.json
 */
async function cargarConfiguracion() {
    try {
        console.log('⚙️ Cargando configuración...');
        
        // Intentar cargar desde Google Drive
        const configUrl = getConfigJsonUrl();
        const response = await fetch(configUrl);
        
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        
        const configData = await response.json();
        
        // Actualizar configuración
        if (configData && configData.length > 0) {
            AppState.config = { ...AppState.config, ...configData[0] };
            console.log('✅ Configuración cargada:', AppState.config);
        }
        
        // Guardar en cache local
        guardarConfigCache(AppState.config);
        
    } catch (error) {
        console.warn('❌ Error cargando configuración, usando cache o valores por defecto:', error);
        await cargarConfigDesdeCache();
    }
}

/**
 * Guarda la configuración en cache local
 */
function guardarConfigCache(config) {
    try {
        const cacheData = {
            config: config,
            timestamp: Date.now()
        };
        localStorage.setItem('config_cache', JSON.stringify(cacheData));
    } catch (error) {
        console.warn('No se pudo guardar configuración en cache:', error);
    }
}

/**
 * Carga la configuración desde cache local
 */
async function cargarConfigDesdeCache() {
    try {
        const cache = localStorage.getItem('config_cache');
        if (cache) {
            const data = JSON.parse(cache);
            // Cache válido por 1 hora
            if (Date.now() - data.timestamp < 60 * 60 * 1000) {
                AppState.config = { ...AppState.config, ...data.config };
                console.log('📂 Configuración cargada desde cache:', AppState.config);
                return true;
            }
        }
    } catch (error) {
        console.error('Error cargando configuración desde cache:', error);
    }
    return false;
}

/**
 * Verifica si se deben mostrar precios
 */
function debeMostrarPrecios() {
    return AppState.config.mostrar_precios === true;
}

/**
 * Aplica la configuración de precios a la UI
 */
function aplicarConfiguracionPrecios() {
    const mostrarPrecios = debeMostrarPrecios();
    console.log('💰 Configuración de precios:', mostrarPrecios ? 'MOSTRAR' : 'OCULTAR');
    
    // Aplicar a elementos existentes
    actualizarVisibilidadPrecios();
}

// =============================================
// DETECCIÓN Y CONFIGURACIÓN PARA MODO APP/APK
// =============================================

function configurarModoApp() {
    // Detectar si estamos en modo standalone (PWA instalada)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                        window.navigator.standalone === true;
    
    if (isStandalone) {
        console.log('📱 Ejecutando en modo App/APK');
        
        // Aplicar clases específicas para modo app
        document.body.classList.add('fullscreen-app');
        document.documentElement.style.setProperty('--app-mode', 'true');
        
        // ✅ NUEVO: Configurar fullscreen mejorado
        configurarFullscreenApp();
        
        // Configurar comportamiento de salida
        configurarSalidaApp();
    } else {
        console.log('🌐 Ejecutando en modo navegador');
    }
}

function configurarSalidaApp() {
    // Configurar doble tap para salir (comportamiento común en apps Android)
    let backButtonPressed = 0;
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' || e.keyCode === 27) {
            e.preventDefault();
            backButtonPressed++;
            
            if (backButtonPressed === 1) {
                mostrarNotificacion('Presiona de nuevo para salir', 'info');
                setTimeout(() => {
                    backButtonPressed = 0;
                }, 2000);
            } else if (backButtonPressed === 2) {
                // Cerrar la app (solo funciona en algunos entornos)
                if (window.navigator.app) {
                    window.navigator.app.exitApp();
                } else {
                    window.close();
                }
            }
        }
    });
}

// =============================================
// CONFIGURACIÓN FULLSCREEN MEJORADA PARA TWA
// =============================================

function configurarFullscreenApp() {
    console.log('📱 Configurando fullscreen mejorado para TWA');
    
    // Aplicar estilos fullscreen inmediatamente
    aplicarEstilosFullscreen();
    
    // Configuraciones adicionales después de carga
    setTimeout(() => {
        limpiarInterfazNavegador();
        configurarComportamientoApp();
    }, 100);
}

function aplicarEstilosFullscreen() {
    const style = document.createElement('style');
    style.textContent = `
        /* Eliminar márgenes y padding del body */
        .fullscreen-app {
            margin: 0 !important;
            padding: 0 !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            overflow: hidden !important;
        }
        
        /* Ocultar cualquier elemento que pueda mostrar URL o controles de navegación */
        [class*="address"], 
        [class*="url"],
        [id*="address"],
        [id*="url"],
        [class*="browser"],
        [class*="chrome"],
        [class*="navigation"],
        iframe[src*="browser"] {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
            opacity: 0 !important;
        }
        
        /* Prevenir scroll bounce en iOS */
        .fullscreen-app {
            overscroll-behavior: none;
            -webkit-overflow-scrolling: touch;
        }
        
        /* Asegurar que el contenedor principal ocupe toda la pantalla */
        .container, main, [class*="container"] {
            height: 100vh !important;
            height: -webkit-fill-available !important;
            overflow-y: auto !important;
        }
        
        /* Mejorar los estilos existentes de fullscreen-app */
        .fullscreen-app .container {
            height: 100% !important;
            overflow-y: auto !important;
            -webkit-overflow-scrolling: touch !important;
        }
    `;
    document.head.appendChild(style);
}

function limpiarInterfazNavegador() {
    // Limpiar título si contiene URL de GitHub
    if (document.title.includes('github.io') || 
        document.title.includes('http') ||
        document.title.includes('://')) {
        document.title = 'Cell Phone Snoopy - Catálogo';
    }
    
    // Buscar y limpiar elementos que puedan contener la URL
    const elementosSospechosos = document.querySelectorAll('*');
    elementosSospechosos.forEach(elemento => {
        const html = elemento.innerHTML || '';
        const text = elemento.textContent || '';
        
        // Si contiene la URL de GitHub, limpiar o ocultar
        if (html.includes('github.io') || text.includes('github.io') ||
            html.includes('alexpascau') || text.includes('alexpascau')) {
            
            // Si es un elemento pequeño, ocultar
            if (elemento.tagName === 'SPAN' || elemento.tagName === 'DIV' || 
                elemento.tagName === 'P' && elemento.textContent.length < 100) {
                elemento.style.display = 'none';
            }
            // Si es un elemento grande, limpiar contenido
            else if (elemento.textContent.includes('github.io')) {
                elemento.textContent = elemento.textContent.replace(/https?:\/\/[^\s]+/g, '');
            }
        }
    });
}

function configurarComportamientoApp() {
    // Prevenir gestos que puedan revelar la UI del navegador
    document.addEventListener('touchmove', function(e) {
        if (e.touches.length > 1) {
            e.preventDefault();
        }
    }, { passive: false });
    
    // Prevenir zoom con doble tap
    let lastTap = 0;
    document.addEventListener('touchend', function(e) {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTap;
        if (tapLength < 300 && tapLength > 0) {
            e.preventDefault();
        }
        lastTap = currentTime;
    });
}

// =============================================
// SISTEMA DE CARGA PROGRESIVA
// =============================================

/**
 * Precarga imágenes en segundo plano para mejor rendimiento
 */
function precargarImagenes(productos) {
    productos.forEach(producto => {
        if (producto.imagenes && producto.imagenes.length > 0) {
            // Precargar imagen principal inmediatamente
            const imgPrincipal = new Image();
            imgPrincipal.src = producto.imagenPrincipal;
            imgPrincipal.onload = () => {
                AppState.imagenesPrecargadas.add(producto.imagenPrincipal);
                // Actualizar producto si ya está visible
                actualizarImagenProducto(producto.id, producto.imagenPrincipal);
            };
            imgPrincipal.onerror = () => {
                console.warn(`❌ No se pudo precargar imagen principal de ${producto.nombre}`);
            };
            
            // Precargar otras imágenes en segundo plano
            producto.imagenes.slice(1).forEach(imagen => {
                const img = new Image();
                img.src = imagen.url;
                img.onload = () => {
                    AppState.imagenesPrecargadas.add(imagen.url);
                };
            });
        }
    });
}

/**
 * Actualiza la imagen de un producto específico cuando se carga
 */
function actualizarImagenProducto(productoId, imagenUrl) {
    const productCard = document.querySelector(`[data-product-id="${productoId}"]`);
    if (productCard) {
        const imgElement = productCard.querySelector('.product-image');
        if (imgElement && imgElement.src !== imagenUrl) {
            imgElement.src = imagenUrl;
            imgElement.style.opacity = '0';
            setTimeout(() => {
                imgElement.style.opacity = '1';
                imgElement.style.transition = 'opacity 0.3s ease';
            }, 50);
        }
    }
}

// =============================================
// FUNCIONES DE UTILIDAD PARA NOTIFICACIONES
// =============================================

function generarSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function obtenerDatosUsuario() {
    return {
        sessionId: AppState.sessionId,
        timestamp: new Date().toISOString(),
        plataforma: navigator.platform,
        idioma: navigator.language,
        userAgent: navigator.userAgent.substring(0, 100)
    };
}

function obtenerProductoActual() {
    return AppState.productoActual;
}

async function limpiarCacheAntigua() {
    try {
        const db = await ImageCacheDB.openDB();
        const transaction = db.transaction([ImageCacheDB.storeName], 'readwrite');
        const store = transaction.objectStore(ImageCacheDB.storeName);
        const request = store.clear();
        
        request.onsuccess = () => console.log('🧹 Cache limpiada');
        request.onerror = () => console.warn('❌ Error limpiando cache');
    } catch (error) {
        console.warn('❌ Error limpiando cache:', error);
    }
}

// =============================================
// SISTEMA DE NOTIFICACIONES AL PROVEEDOR
// =============================================

async function enviarNotificacionProveedor(producto, tipoContacto) {
    const usuario = obtenerDatosUsuario();
    
    const notificationData = {
        timestamp: new Date().toISOString(),
        tipo: tipoContacto,
        usuario: usuario,
        producto: {
            id: producto.id,
            nombre: producto.nombre,
            precio: formatearPrecio(producto.precioMin, producto.precioMax),
            categoria: producto.categoria
        }
    };

    async function registrarConsultaEnExcel(producto, tipoContacto) {
        const usuario = obtenerDatosUsuario();
        
        const consultaData = {
            timestamp: new Date().toISOString(),
            tipo: tipoContacto,
            usuario: usuario,
            producto: {
                id: producto.id,
                nombre: producto.nombre,
                precio: formatearPrecio(producto.precioMin, producto.precioMax),
                categoria: producto.categoria
            }
        };
        
        // Incrementar contador local
        incrementarContadorConsulta(producto.id);
        
        // Enviar a servidor/Google Apps Script para Excel
        await enviarConsultaAExcel(consultaData);
    }

    function incrementarContadorConsulta(productoId) {
        let productos = JSON.parse(localStorage.getItem('catalogo_cache') || '{}');
        if (productos.productos) {
            const producto = productos.productos.find(p => p.id === productoId);
            if (producto) {
                producto.consultas = (producto.consultas || 0) + 1;
                localStorage.setItem('catalogo_cache', JSON.stringify(productos));
            }
        }
    }

    try {
        await enviarNotificacionEmail(notificationData);
        console.log('✅ Notificación enviada al proveedor');
        mostrarNotificacion('Interés registrado correctamente', 'success');
        return Promise.resolve();
    } catch (error) {
        console.log('📦 Guardando notificación en cola offline');
        guardarEnColaOffline(notificationData);
        mostrarNotificacion('Sin conexión - Se enviará después', 'info');
        return Promise.reject(error);
    }
}

function guardarEnColaOffline(notificationData) {
    let cola = JSON.parse(localStorage.getItem('notificacionesPendientes') || '[]');
    cola.push({
        ...notificationData,
        intentos: 0,
        fechaCreacion: new Date().toISOString()
    });
    localStorage.setItem('notificacionesPendientes', JSON.stringify(cola));
    AppState.mensajesPendientes = cola;
}

async function procesarColaOffline() {
    if (!navigator.onLine) return;
    
    let cola = JSON.parse(localStorage.getItem('notificacionesPendientes') || '[]');
    if (cola.length === 0) return;

    const pendientes = [];
    
    for (let i = 0; i < cola.length; i++) {
        const item = cola[i];
        if (item.intentos < 3) {
            try {
                await enviarNotificacionEmail(item);
                console.log('✅ Notificación offline enviada');
            } catch (error) {
                item.intentos++;
                pendientes.push(item);
            }
        }
    }
    
    localStorage.setItem('notificacionesPendientes', JSON.stringify(pendientes));
    AppState.mensajesPendientes = pendientes;
}

async function enviarNotificacionEmail(data) {
    // Inicializar EmailJS si no está listo
    if (typeof emailjs === 'undefined') {
        throw new Error('EmailJS no cargado');
    }

    const templateParams = {
        vendedor: configContacto.vendedor,
        product_name: data.producto.nombre,
        product_price: `${formatearPrecio(producto.precioMin, producto.precioMax)}`,
        product_category: data.producto.categoria,
        product_id: data.producto.id,
        contact_type: data.tipo,
        session_id: data.usuario.sessionId,
        platform: data.usuario.plataforma,
        language: data.usuario.idioma,
        timestamp: new Date(data.timestamp).toLocaleString('es-ES'),
        user_agent: data.usuario.userAgent,
        current_date: new Date().toLocaleDateString('es-ES'),
        to_email: configContacto.proveedor.email
    };

    try {
        const result = await emailjs.send(
            configContacto.proveedor.serviceId,
            configContacto.proveedor.templateId,
            templateParams
        );
        console.log('✅ Email de notificación enviado al proveedor');
        return result;
    } catch (error) {
        console.error('❌ Error enviando email:', error);
        throw error;
    }
}

function mostrarNotificacion(mensaje, tipo = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${tipo}`;
    notification.textContent = mensaje;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${tipo === 'success' ? '#27ae60' : tipo === 'error' ? '#e74c3c' : '#3498db'};
        color: white;
        border-radius: 5px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideInRight 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// =============================================
// SISTEMA DE DETECCIÓN DE CONTACTO
// =============================================

// Reemplazar la función existente de configurarTrackingContacto
function configurarTrackingContacto() {
    // Detectar clics en enlaces de WhatsApp
    document.addEventListener('click', function(e) {
        const target = e.target.closest('a[href*="wa.me"], a[href*="api.whatsapp"]');
        if (target && AppState.productoActual) {
            e.preventDefault();
            const producto = obtenerProductoActual();
            
            // ANTES: enviarNotificacionProveedor(producto, 'whatsapp')
            // AHORA: 
            registerProductConsult(producto, 'whatsapp')
                .finally(() => {
                    window.location.href = target.href;
                });
        }
    });

    // Detectar clics en enlaces de teléfono
    document.addEventListener('click', function(e) {
        const target = e.target.closest('a[href^="tel:"]');
        if (target && AppState.productoActual) {
            e.preventDefault();
            const producto = obtenerProductoActual();
            
            // ANTES: enviarNotificacionProveedor(producto, 'llamada')
            // AHORA:
            registerProductConsult(producto, 'llamada')
                .finally(() => {
                    window.location.href = target.href;
                });
        }
    });
}

// =============================================
// CARGA PROGRESIVA DE PRODUCTOS
// =============================================
async function cargarProductos(forzarActualizacion = false) {
    try {
        console.log('📦 Iniciando carga de productos...');
        mostrarEsqueletosCarga();

        // ✅ NUEVO: Cargar configuración si no se ha cargado
        if (!AppState.config.version) {
            await cargarConfiguracion();
        }
        
        // 1. CARGAR JSON PRIMERO
        const jsonProxyUrl = getProductsJsonUrl();
        
        const response = await fetch(jsonProxyUrl);
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        
        const productosData = await response.json();
        
        // 2. PROCESAR PRODUCTOS
        productos = productosData.map(producto => {
            // Procesar las imágenes primero
            const imagenesProcesadas = procesarImagenesDesdeJSON(producto);
            // Luego obtener la imagen principal basada en las imágenes procesadas
            const imagenPrincipal = obtenerImagenPrincipalDesdeJSON({ ...producto, imagenes: imagenesProcesadas });
            return {
                ...producto,
                imagenes: imagenesProcesadas,
                imagenPrincipal: imagenPrincipal
            };
        });
        
        guardarCacheLocal(productos);
        console.log(`✅ ${productos.length} productos procesados`);
        
        // 3. PRECARGAR IMÁGENES PRIMERO (BLOQUEANTE)
        console.log('🔄 Precargando imágenes antes de mostrar...');
        await precargarImagenesEnCache(productos);
        
        // 4. MOSTRAR PRODUCTOS DESDE CACHE
        console.log('🎉 Mostrando productos desde cache...');
        await mostrarProductosDesdeCache(productos);
        
        cargarCategorias();
        actualizarBadgesConsultas();

        // ✅ NUEVO: Aplicar configuración de precios después de cargar productos
        aplicarConfiguracionPrecios();
        
    } catch (error) {
        console.error('❌ Error cargando productos:', error);
        await cargarDesdeCache();
    }
}

async function mostrarProductosDesdeCache(productosAMostrar) {
    const grid = document.getElementById('productsGrid');
    
    if (!productosAMostrar || productosAMostrar.length === 0) {
        grid.innerHTML = `<div class="no-products">No hay productos disponibles.</div>`;
        return;
    }
    
    console.log('🖼️ Renderizando desde cache...');

    // ✅ NUEVO: Obtener configuración de precios
    const mostrarPrecios = debeMostrarPrecios();
    
    // Crear HTML con imágenes desde cache
    const productosHTML = await Promise.all(
        productosAMostrar.map(async (producto) => {
            let imagenSrc = './images/placeholder.jpg';
            
            // Intentar obtener imagen desde cache
            if (producto.imagenPrincipal) {
                try {
                    const cachedImage = await ImageCacheDB.getImage(producto.imagenPrincipal);
                    if (cachedImage) {
                        imagenSrc = URL.createObjectURL(cachedImage);
                        console.log('✅ Imagen servida desde cache:', producto.nombre);
                    }
                } catch (error) {
                    console.warn('❌ Error obteniendo imagen de cache:', error);
                }
            }
            
            // ✅ NUEVO: Mostrar u ocultar precio según configuración
            const precioHTML = mostrarPrecios 
                ? `<div class="product-price">${formatearPrecio(producto.precioMin, producto.precioMax)}</div>`
                : `<div class="product-price no-price">Precio no disponible</div>`;

            return `
            <div class="product-card" 
                 onclick="mostrarDetallesProducto(${producto.id})"
                 data-product-id="${producto.id}">
                <div class="product-image-container">
                    <img src="${imagenSrc}" 
                         alt="${producto.nombre}"
                         class="product-image"
                         loading="lazy"
                         onload="this.style.opacity='1'"
                         onerror="this.src='./images/placeholder.jpg'; this.style.opacity='1'"
                         style="opacity: ${AppState.imagenesPrecargadas.has(producto.imagenPrincipal) ? '1' : '0.7'}; transition: opacity 0.3s ease">
                </div>
                <div class="product-info">
                    <div class="product-name">${producto.nombre}</div>
                    <div class="product-category">${producto.categoria}</div>
                    ${precioHTML}
                </div>
            </div>
            `;
        })
    );
    
    grid.innerHTML = productosHTML.join('');
}

/**
 * Muestra esqueletos de carga mientras se obtienen los productos
 */
function mostrarEsqueletosCarga() {
    const grid = document.getElementById('productsGrid');
    const skeletonCount = 8; // Número de esqueletos a mostrar
    
    grid.innerHTML = Array(skeletonCount).fill(0).map(() => `
        <div class="product-card skeleton">
            <div class="product-image-container">
                <div class="skeleton-image"></div>
            </div>
            <div class="product-info">
                <div class="skeleton-line skeleton-title"></div>
                <div class="skeleton-line skeleton-category"></div>
                <div class="skeleton-line skeleton-price"></div>
            </div>
        </div>
    `).join('');
}

/**
 * Procesa las imágenes que vienen en el JSON
 */
function procesarImagenesDesdeJSON(producto) {
    if (producto.imagenes && Array.isArray(producto.imagenes)) {
        return producto.imagenes.map(img => ({
            id: img.id,
            url: buildImageUrl(img.id),  // ← Construye URL con ID real de Google Drive
            nombre: img.nombre,
            principal: img.principal || false,
            orden: img.orden || 1
        }));
    }
    
    // Fallback para productos sin array de imágenes
    console.warn(`⚠️ Producto ${producto.id} sin array de imágenes, usando fallback`);
    return [{
        id: `${producto.id}_1`,
        url: './images/placeholder.jpg',
        nombre: 'placeholder.jpg',
        principal: true,
        orden: 1
    }];
}

/**
 * Obtiene la imagen principal desde el JSON
 */
function obtenerImagenPrincipalDesdeJSON(producto) {
    if (producto.imagenes && producto.imagenes.length > 0) {
        // Buscar imagen marcada como principal
        const principal = producto.imagenes.find(img => img.principal);
        if (principal) {
            return principal.url;
        }
        // Si no hay principal, usar la primera
        return producto.imagenes[0].url;
    }
    
    return './images/placeholder.jpg';
}

// =============================================
// SISTEMA DE CACHE
// =============================================
function guardarCacheLocal(productos) {
    try {
        const cacheData = {
            productos: productos,
            timestamp: Date.now()
        };
        localStorage.setItem('catalogo_cache', JSON.stringify(cacheData));
    } catch (error) {
        console.warn('No se pudo guardar cache:', error);
    }
}

async function cargarDesdeCache() {
    try {
        const cache = localStorage.getItem('catalogo_cache');
        if (cache) {
            const data = JSON.parse(cache);
            // Cache válido por 1 hora
            if (Date.now() - data.timestamp < 60 * 60 * 1000) {
                productos = data.productos;
                console.log('📂 Productos cargados desde cache');
                mostrarProductosDesdeCache(productos);
                cargarCategorias();
                return true;
            }
        }
    } catch (error) {
        console.error('Error cargando cache:', error);
    }
    
    // Mostrar error
    productos = [];
    //mostrarProductosDesdeCache(productos);
    mostrarError('No se pudieron cargar los productos. Verifica tu conexión.');
    return false;
}

// =============================================
// FUNCIONES DE UI MEJORADAS
// =============================================
function formatearPrecio(min, max) {
    if (min === max) {
        return `$${min.toFixed(2)}`;
    }
    return `$${min.toFixed(2)} - $${max.toFixed(2)}`;
}

// =============================================
// FUNCIONES DE DETALLES DE PRODUCTO CON CACHE
// =============================================

async function mostrarDetallesProducto(productoId) {
    const producto = productos.find(p => p.id === productoId);
    if (!producto) return;
    
    // ACTUALIZAR ESTADO GLOBAL para notificaciones
    productoActual = producto;
    AppState.productoActual = producto;
    
    const modalContent = document.getElementById('modalContent');

    // ✅ NUEVO: Mostrar u ocultar precio según configuración
    const mostrarPrecios = debeMostrarPrecios();
    const precioHTML = mostrarPrecios 
        ? `<div class="product-price">${formatearPrecio(producto.precioMin, producto.precioMax)}</div>`
        : `<div class="product-price no-price">Consultar precio</div>`;
    
    // ✅ NUEVO: Mostrar esqueleto de carga mientras se obtienen las imágenes
    modalContent.innerHTML = `
        <div class="product-detail">
            <div class="detail-images">
                <div class="carousel-skeleton">
                    <div class="skeleton-image-large"></div>
                </div>
            </div>
            <div class="detail-info">
                <h2>${producto.nombre}</h2>
                <p class="product-category">${producto.categoria}</p>
                ${precioHTML}
                <div class="product-description">${producto.descripcion}</div>
                ${formatearEspecificaciones(producto.especificaciones)}
            </div>
        </div>
    `;
    
    // ✅ NUEVO: Crear carrusel con imágenes cacheadas
    await crearCarruselConCache(producto);
    
    // Actualizar enlaces de contacto
    const mensaje = `Hola, me interesa: ${producto.nombre} - ${formatearPrecio(producto.precioMin, producto.precioMax)}`;
    const urlWhatsapp = `https://wa.me/${configContacto.whatsapp}?text=${encodeURIComponent(mensaje)}`;
    document.getElementById('whatsappModal').href = urlWhatsapp;
    
    document.getElementById('productModal').style.display = 'block';
}
/**
 * Crea el carrusel usando imágenes desde la cache de IndexedDB
 */
async function crearCarruselConCache(producto) {
    const detailImages = document.querySelector('.detail-images');
    
    if (!producto.imagenes || producto.imagenes.length === 0) {
        detailImages.innerHTML = `<div class="no-image">Imagen no disponible</div>`;
        return;
    }
    
    console.log('🖼️ Creando carrusel con cache para:', producto.nombre);
    
    try {
        // ✅ NUEVO: Obtener URLs cacheadas para todas las imágenes
        const imagenesConCache = await Promise.all(
            producto.imagenes.map(async (img, index) => {
                let imageUrl = './images/placeholder.jpg';
                
                // Intentar obtener desde cache primero
                if (img.url && !img.url.includes('placeholder')) {
                    try {
                        const cachedImage = await ImageCacheDB.getImage(img.url);
                        if (cachedImage) {
                            imageUrl = URL.createObjectURL(cachedImage);
                            console.log('✅ Imagen cargada desde cache:', img.url);
                        } else {
                            // Si no está en cache, usar la URL original
                            imageUrl = img.url;
                            console.log('🌐 Imagen cargada desde red:', img.url);
                        }
                    } catch (error) {
                        console.warn('❌ Error obteniendo imagen de cache, usando URL original:', img.url);
                        imageUrl = img.url;
                    }
                }
                
                return {
                    ...img,
                    cachedUrl: imageUrl,
                    index: index
                };
            })
        );
        
        // ✅ NUEVO: Crear HTML del carrusel con las URLs cacheadas
        const slides = imagenesConCache.map((img, index) => {
            return `
                <div class="carousel-slide ${index === 0 ? 'active' : ''}">
                    <img src="${img.cachedUrl}" 
                         alt="${producto.nombre} - Imagen ${index + 1}" 
                         onerror="this.src='./images/placeholder.jpg'; console.log('❌ Error cargando imagen: ${img.url}')"
                         loading="lazy"
                         style="width: 100%; height: 100%; object-fit: contain;">
                </div>
            `;
        }).join('');
        
        const isSingleImage = imagenesConCache.length === 1;
        const containerClass = isSingleImage ? 'carousel-container single-image' : 'carousel-container';
        
        const dots = imagenesConCache.length > 1 ? imagenesConCache.map((_, index) => `
            <span class="carousel-dot ${index === 0 ? 'active' : ''}" data-index="${index}"></span>
        `).join('') : '';
        
        const navigationButtons = imagenesConCache.length > 1 ? `
            <button class="carousel-btn carousel-prev">‹</button>
            <button class="carousel-btn carousel-next">›</button>
        ` : '';
        
        // ✅ NUEVO: Reemplazar el esqueleto con el carrusel real
        detailImages.innerHTML = `
            <div class="${containerClass}">
                <div class="carousel-track">
                    ${slides}
                </div>
                ${navigationButtons}
                ${imagenesConCache.length > 1 ? `
                    <div class="carousel-dots">
                        ${dots}
                    </div>
                ` : ''}
            </div>
        `;
        
        // ✅ NUEVO: Inicializar el carrusel inmediatamente
        console.log('🎠 Inicializando carrusel con cache...');
        inicializarCarrusel(producto);
        
    } catch (error) {
        console.error('❌ Error creando carrusel con cache:', error);
        // Fallback: usar el método original
        detailImages.innerHTML = crearCarruselImagenes(producto);
        inicializarCarruselCuandoEsteListo(producto);
    }
}
/**
 * Función auxiliar para precargar imágenes del carrusel en cache
 */
async function precargarImagenesCarrusel(producto) {
    if (!producto.imagenes || producto.imagenes.length === 0) return;
    
    console.log('📥 Precargando imágenes del carrusel en cache...');
    
    for (const imagen of producto.imagenes) {
        if (imagen.url && !imagen.url.includes('placeholder')) {
            try {
                // Verificar si ya está en cache
                const existe = await ImageCacheDB.imageExists(imagen.url);
                if (!existe) {
                    // Descargar y guardar en cache
                    const response = await fetch(imagen.url, {
                        mode: 'cors',
                        credentials: 'omit'
                    });
                    
                    if (response.ok) {
                        const blob = await response.blob();
                        await ImageCacheDB.saveImage(imagen.url, blob);
                        console.log('💾 Imagen precargada en cache:', imagen.url);
                    }
                }
            } catch (error) {
                console.warn('❌ Error precargando imagen del carrusel:', imagen.url, error);
            }
        }
    }
}
// ✅ REEMPLAZAR la función crearCarruselImagenes original por esta versión mejorada
function crearCarruselImagenes(producto) {
    console.log('🖼️ Creando carrusel MEJORADO para producto:', producto.nombre);
    
    if (!producto.imagenes || producto.imagenes.length === 0) {
        console.warn('⚠️ No hay imágenes para el producto');
        return `<div class="no-image">Imagen no disponible</div>`;
    }
    
    // ✅ MEJORADO: Usar URLs cacheadas (se cargarán dinámicamente)
    const slides = producto.imagenes.map((img, index) => {
        const imageUrl = img.url || './images/placeholder.jpg';
        console.log(`📸 Imagen ${index}:`, imageUrl);
        
        return `
            <div class="carousel-slide ${index === 0 ? 'active' : ''}">
                <img src="${imageUrl}" 
                     alt="${producto.nombre} - Imagen ${index + 1}" 
                     onerror="this.src='./images/placeholder.jpg'; console.log('❌ Error cargando imagen: ${imageUrl}')"
                     loading="lazy"
                     style="width: 100%; height: 100%; object-fit: contain;">
            </div>
        `;
    }).join('');
    
    const isSingleImage = producto.imagenes.length === 1;
    const containerClass = isSingleImage ? 'carousel-container single-image' : 'carousel-container';
    
    const dots = producto.imagenes.length > 1 ? producto.imagenes.map((_, index) => `
        <span class="carousel-dot ${index === 0 ? 'active' : ''}" data-index="${index}"></span>
    `).join('') : '';
    
    const navigationButtons = producto.imagenes.length > 1 ? `
        <button class="carousel-btn carousel-prev">‹</button>
        <button class="carousel-btn carousel-next">›</button>
    ` : '';
    
    return `
        <div class="${containerClass}">
            <div class="carousel-track">
                ${slides}
            </div>
            ${navigationButtons}
            ${producto.imagenes.length > 1 ? `
                <div class="carousel-dots">
                    ${dots}
                </div>
            ` : ''}
        </div>
    `;
}
// ✅ ACTUALIZAR la función de inicialización del carrusel para manejar mejor el cache
function inicializarCarruselCuandoEsteListo(producto) {
    let initialized = false;
    
    const initializeIfReady = () => {
        if (initialized) return;
        
        const carouselContainer = document.querySelector('.carousel-container');
        const slides = document.querySelectorAll('.carousel-slide');
        
        if (carouselContainer && slides.length > 0) {
            console.log('✅ Carrusel detectado en el DOM, inicializando con cache...');
            initialized = true;
            
            // ✅ NUEVO: Precargar imágenes en cache si no están
            precargarImagenesCarrusel(producto).then(() => {
                console.log('🎯 Precarga de carrusel completada');
            });
            
            inicializarCarrusel(producto);
            
            // ✅ FORZAR RE-FLOW para asegurar que las imágenes se muestren
            setTimeout(() => {
                carouselContainer.style.display = 'none';
                carouselContainer.offsetHeight; // Trigger reflow
                carouselContainer.style.display = '';
            }, 50);
        }
    };
    
    // Usar MutationObserver
    const observer = new MutationObserver((mutations, obs) => {
        initializeIfReady();
    });
    
    // Comenzar a observar
    observer.observe(document.getElementById('modalContent'), {
        childList: true,
        subtree: true
    });
    
    // Intentos inmediatos
    initializeIfReady();
    
    // Timeout de respaldo
    setTimeout(() => {
        initializeIfReady();
        observer.disconnect();
    }, 500);
}
/**
 * Inicializa la funcionalidad del carrusel - VERSIÓN CON MODO MAXIMIZADO Y ZOOM
 */
function inicializarCarrusel(producto) {
    const slides = document.querySelectorAll('.carousel-slide');
    const dots = document.querySelectorAll('.carousel-dot');
    const prevBtn = document.querySelector('.carousel-prev');
    const nextBtn = document.querySelector('.carousel-next');
    const carouselContainer = document.querySelector('.carousel-container');
    
    if (slides.length === 0) return;

    let currentSlide = 0;
    const totalSlides = slides.length;
    let autoSlideInterval;
    let isMaximized = false;
    let isZoomed = false;
    let currentMaximizedImage = null;

    console.log(`🖼️ Carrusel avanzado con ${totalSlides} imágenes`);

    // Función para mostrar slide específico
    function goToSlide(index) {
        // Ocultar slide actual
        slides[currentSlide].classList.remove('active');
        if (dots.length > 0) {
            dots[currentSlide].classList.remove('active');
        }
        
        // Actualizar índice
        currentSlide = (index + totalSlides) % totalSlides;
        
        // Mostrar nuevo slide
        slides[currentSlide].classList.add('active');
        if (dots.length > 0) {
            dots[currentSlide].classList.add('active');
        }
    }

    // 🆕 CORRECCIÓN: Función mejorada para inicializar eventos de imágenes
    function inicializarEventosImagenes() {
        slides.forEach((slide, index) => {
            const img = slide.querySelector('img');
            if (img) {
                // Remover event listeners previos para evitar duplicados
                const newImg = img.cloneNode(true);
                img.parentNode.replaceChild(newImg, img);
                
                // Click simple para maximizar - SOLO en la imagen, no en el slide
                newImg.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    console.log('🖱️ Click en imagen para maximizar');
                    toggleMaximizedMode(newImg);
                });
                
                // Prevenir arrastre accidental
                newImg.addEventListener('dragstart', (e) => {
                    e.preventDefault();
                });
            }
        });
    }

    // Inicializar eventos de imágenes
    inicializarEventosImagenes();

    // Función para modo maximizado - CORREGIDA
    function toggleMaximizedMode(imgElement) {
        console.log('🔍 Toggle maximized mode, estado actual:', isMaximized);
        
        if (!isMaximized) {
            // Entrar en modo maximizado
            openMaximizedMode(imgElement);
        } else {
            // Salir del modo maximizado
            closeMaximizedMode();
        }
    }

    // Abrir modo maximizado - VERSIÓN CON PANEO
    function openMaximizedMode(imgElement) {
        console.log('📱 Abriendo modo maximizado');
        isMaximized = true;
        currentMaximizedImage = imgElement;
        
        // Detener auto-slide cuando se maximiza
        stopAutoSlide();
        
        // Crear overlay para modo maximizado
        const overlay = document.createElement('div');
        overlay.className = 'maximized-overlay';
        overlay.innerHTML = `
            <div class="maximized-container">
                <img src="${imgElement.src}" alt="${imgElement.alt}" class="maximized-image">
                <button class="maximized-close">×</button>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // Elementos del DOM
        const maximizedImg = overlay.querySelector('.maximized-image');
        const closeBtn = overlay.querySelector('.maximized-close');
        const container = overlay.querySelector('.maximized-container');
        
        // Variables para el paneo/arrastre
        let isDragging = false;
        let startX, startY;
        let translateX = 0, translateY = 0;
        let currentScale = 1;

        // Función para actualizar la transformación
        function updateTransform() {
            maximizedImg.style.transform = `scale(${currentScale}) translate(${translateX}px, ${translateY}px)`;
        }

        // Función para limitar el paneo
        function constrainPan() {
            if (!isZoomed) return;
            
            const imgRect = maximizedImg.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            
            const maxX = Math.max(0, (imgRect.width * currentScale - containerRect.width) / 2);
            const maxY = Math.max(0, (imgRect.height * currentScale - containerRect.height) / 2);
            
            translateX = Math.max(-maxX, Math.min(maxX, translateX));
            translateY = Math.max(-maxY, Math.min(maxY, translateY));
        }

        // Manejar inicio del arrastre
        function startPan(e) {
            if (!isZoomed) return;
            
            isDragging = true;
            const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
            const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
            
            startX = clientX - translateX;
            startY = clientY - translateY;
            maximizedImg.style.cursor = 'grabbing';
            e.preventDefault();
        }

        // Manejar movimiento durante arrastre
        function handlePan(e) {
            if (!isDragging || !isZoomed) return;
            
            const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
            const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
            
            translateX = clientX - startX;
            translateY = clientY - startY;
            constrainPan();
            updateTransform();
            e.preventDefault();
        }

        // Detener arrastre
        function stopPan() {
            isDragging = false;
            if (isZoomed) {
                maximizedImg.style.cursor = 'grab';
            }
        }

        // Event listeners para desktop
        maximizedImg.addEventListener('mousedown', startPan);
        document.addEventListener('mousemove', handlePan);
        document.addEventListener('mouseup', stopPan);

        // Event listeners para móviles
        maximizedImg.addEventListener('touchstart', startPan);
        document.addEventListener('touchmove', handlePan);
        document.addEventListener('touchend', stopPan);

        // Toggle zoom
        function toggleZoom() {
            if (!isZoomed) {
                // Activar zoom
                currentScale = 2.0;
                isZoomed = true;
                maximizedImg.classList.add('zoomed');
                maximizedImg.style.cursor = 'grab';
                console.log('🔍 Zoom activado - Puedes arrastrar la imagen');
            } else {
                // Desactivar zoom y resetear paneo
                currentScale = 1;
                isZoomed = false;
                translateX = 0;
                translateY = 0;
                maximizedImg.classList.remove('zoomed');
                maximizedImg.style.cursor = 'zoom-in';
                console.log('🔍 Zoom desactivado');
            }
            updateTransform();
        }

        // Cerrar con botón
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeMaximizedMode();
        });

        // Cerrar haciendo clic fuera de la imagen
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeMaximizedMode();
            }
        });

        // Doble clic para zoom
        maximizedImg.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            toggleZoom();
        });

        // Double tap para móviles
        let lastTap = 0;
        maximizedImg.addEventListener('touchend', (e) => {
            if (isDragging) return;
            
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTap;
            
            if (tapLength < 300 && tapLength > 0) {
                toggleZoom();
                e.preventDefault();
            }
            lastTap = currentTime;
        });

        // Prevenir scroll del body
        document.body.style.overflow = 'hidden';

        // Efecto de entrada
        setTimeout(() => {
            overlay.classList.add('active');
        }, 10);

        // Guardar referencia para cerrar
        currentMaximizedOverlay = overlay;
    }

    // Cerrar modo maximizado - VERSIÓN CORREGIDA
    function closeMaximizedMode() {
        if (!isMaximized) return;
        
        console.log('📱 Cerrando modo maximizado');
        isMaximized = false;
        isZoomed = false;
        
        const overlay = document.querySelector('.maximized-overlay');
        if (overlay) {
            overlay.classList.remove('active');
            setTimeout(() => {
                overlay.remove();
                startAutoSlide(); // Reanudar carrusel
            }, 300);
        }
        
        // Restaurar scroll
        document.body.style.overflow = '';
        currentMaximizedImage = null;
        currentMaximizedOverlay = null;
    }

    // Toggle zoom en modo maximizado
    function toggleZoom() {
        const maximizedImg = document.querySelector('.maximized-image');
        if (!maximizedImg) return;
        
        if (!isZoomed) {
            // Activar zoom
            maximizedImg.classList.add('zoomed');
            isZoomed = true;
            console.log('🔍 Zoom activado');
        } else {
            // Desactivar zoom
            maximizedImg.classList.remove('zoomed');
            isZoomed = false;
            console.log('🔍 Zoom desactivado');
        }
    }

    // 🆕 CORRECCIÓN: Asegurar que los botones de navegación sean visibles
    function actualizarVisibilidadBotones() {
        if (prevBtn && nextBtn) {
            // Mostrar botones siempre que haya más de una imagen
            if (totalSlides > 1) {
                prevBtn.style.display = 'block';
                nextBtn.style.display = 'block';
            } else {
                prevBtn.style.display = 'none';
                nextBtn.style.display = 'none';
            }
        }
    }

    // Función para siguiente slide automático
    function nextSlide() {
        if (totalSlides > 1) {
            goToSlide(currentSlide + 1);
        }
    }

    // Iniciar auto-desplazamiento
    function startAutoSlide() {
        if (totalSlides > 1 && !isMaximized) {
            autoSlideInterval = setInterval(nextSlide, 3000);
        }
    }

    // Detener auto-desplazamiento
    function stopAutoSlide() {
        if (autoSlideInterval) {
            clearInterval(autoSlideInterval);
            autoSlideInterval = null;
        }
    }

    // Reiniciar auto-desplazamiento
    function restartAutoSlide() {
        stopAutoSlide();
        startAutoSlide();
    }

    // 🆕 CORRECCIÓN: Event listeners mejorados para botones de navegación
    if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            goToSlide(currentSlide - 1);
            restartAutoSlide();
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            goToSlide(currentSlide + 1);
            restartAutoSlide();
        });
    }

    // Event listeners para dots
    dots.forEach((dot, index) => {
        dot.addEventListener('click', (e) => {
            e.stopPropagation();
            goToSlide(index);
            restartAutoSlide();
        });
    });

    // Navegación con teclado
    document.addEventListener('keydown', (e) => {
        if (document.getElementById('productModal').style.display === 'block') {
            if (e.key === 'ArrowLeft') {
                goToSlide(currentSlide - 1);
                restartAutoSlide();
            } else if (e.key === 'ArrowRight') {
                goToSlide(currentSlide + 1);
                restartAutoSlide();
            } else if (e.key === 'Escape' && isMaximized) {
                closeMaximizedMode();
            }
        }
    });

    // Swipe para móviles
    let startX = 0;

    if (carouselContainer) {
        carouselContainer.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            stopAutoSlide();
        });

        carouselContainer.addEventListener('touchend', (e) => {
            const endX = e.changedTouches[0].clientX;
            const diff = startX - endX;
            
            if (Math.abs(diff) > 50) {
                if (diff > 0) {
                    goToSlide(currentSlide + 1);
                } else {
                    goToSlide(currentSlide - 1);
                }
            }
            startAutoSlide();
        });

        // Pausar auto-desplazamiento cuando el mouse está sobre el carrusel
        carouselContainer.addEventListener('mouseenter', stopAutoSlide);
        carouselContainer.addEventListener('mouseleave', startAutoSlide);
    }

    // 🆕 CORRECCIÓN: Asegurar visibilidad inicial de botones
    actualizarVisibilidadBotones();
    
    // Iniciar auto-desplazamiento
    startAutoSlide();
}
/**
 * Formatea las especificaciones como lista HTML con viñetas
 */
function formatearEspecificaciones(especificaciones) {
    if (!especificaciones) return '';
    
    // Dividir por punto y coma y limpiar espacios
    const items = especificaciones.split(';')
        .map(item => item.trim())
        .filter(item => item.length > 0);
    
    if (items.length === 0) return '';
    
    // Crear lista HTML
    const listaItems = items.map(item => 
        `<li>${item}</li>`
    ).join('');
    
    return `
        <div class="product-specs">
            <h4>Especificaciones:</h4>
            <ul class="specs-list">
                ${listaItems}
            </ul>
        </div>
    `;
}

// =============================================
// INICIALIZACIÓN MEJORADA
// =============================================
document.addEventListener('DOMContentLoaded', async function() {
    // 1. Registrar Service Worker PRIMERO
    // Esto ya se hace desde index.html en una porción script
    
    // 2. Configurar modo App/APK
    configurarModoApp();
    
    // ✅ NUEVO: 3. Cargar configuración primero
    await cargarConfiguracion();
    
    // 4. Inicializar EmailJS
    if (typeof emailjs !== 'undefined') {
        emailjs.init(configContacto.proveedor.userId);
    }
    
    // 5. Cargar productos (ahora con carga progresiva)
    cargarProductos();
    
    // 6. Configurar eventos básicos
    configurarEventListeners();
    
    // 7. Configurar sistema de notificaciones
    configurarTrackingContacto();
    
    // 8. Configurar detección de conexión
    configurarDeteccionConexion();
    
    // ✅ NUEVO: 9. Aplicar configuración de precios
    aplicarConfiguracionPrecios();
    
    console.log('🚀 Catálogo iniciado con soporte para APK');
});

function configurarEventListeners() {
    // Cerrar modal
    document.querySelector('.close').addEventListener('click', () => {
        document.getElementById('productModal').style.display = 'none';
    });
    
    // Cerrar modal al hacer clic fuera
    window.addEventListener('click', (event) => {
        if (event.target === document.getElementById('productModal')) {
            document.getElementById('productModal').style.display = 'none';
        }
    });
    
    // Búsqueda
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', filtrarProductos);
    }
    
    // Filtro de categoría
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', filtrarProductos);
    }
}

function configurarDeteccionConexion() {
    // Detectar cambios de conexión
    window.addEventListener('online', () => {
        mostrarNotificacion('Conexión restablecida', 'success');
        procesarColaOffline();
    });

    window.addEventListener('offline', () => {
        mostrarNotificacion('Sin conexión - Los mensajes se enviarán después', 'info');
    });
}

function filtrarProductos() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const category = document.getElementById('categoryFilter').value;
    
    const filtrados = productos.filter(producto => {
        const matchSearch = producto.nombre.toLowerCase().includes(searchTerm) ||
                           producto.descripcion.toLowerCase().includes(searchTerm);
        const matchCategory = category === 'all' || producto.categoria === category;
        
        return matchSearch && matchCategory;
    });
    
    mostrarProductosDesdeCache(filtrados);
}

function cargarCategorias() {
    const categorias = [...new Set(productos.map(p => p.categoria))];
    const filter = document.getElementById('categoryFilter');
    
    if (filter) {
        // Limpiar opciones excepto "Todas"
        filter.innerHTML = '<option value="all">Todas las categorías</option>';
        
        // Agregar categorías
        categorias.forEach(categoria => {
            const option = document.createElement('option');
            option.value = categoria;
            option.textContent = categoria;
            filter.appendChild(option);
        });
    }
}

function mostrarError(mensaje) {
    console.error('❌ Error:', mensaje);
    // Puedes mostrar una notificación en la UI si quieres
}

/**
 * Precarga imágenes en la cache del Service Worker
 */
async function precargarImagenesEnCache(productos) {
    console.log('📥 Precargando imágenes en IndexedDB...');
    
    const imagenesParaCachear = [];
    
    // Recolectar todas las URLs de imágenes
    productos.forEach(producto => {
        if (producto.imagenes && producto.imagenes.length > 0) {
            producto.imagenes.forEach(imagen => {
                if (imagen.url && !imagen.url.includes('placeholder')) {
                    imagenesParaCachear.push(imagen.url);
                }
            });
        }
    });
    
    const urlsUnicas = [...new Set(imagenesParaCachear)];
    console.log(`🖼️ Precargando ${urlsUnicas.length} imágenes en IndexedDB`);
    
    let imagenesCacheadas = 0;
    
    // Precargar con límite de concurrencia
    for (let i = 0; i < urlsUnicas.length; i += 3) {
        const lote = urlsUnicas.slice(i, i + 3);
        
        await Promise.allSettled(
            lote.map(async (urlImagen) => {
                try {
                    // Verificar si ya está en cache
                    const existe = await ImageCacheDB.imageExists(urlImagen);
                    if (existe) {
                        console.log('✅ Ya en cache:', urlImagen);
                        imagenesCacheadas++;
                        return;
                    }
                    
                    // Descargar y guardar en cache
                    console.log('⬇️ Descargando:', urlImagen);
                    const response = await fetch(urlImagen, {
                        mode: 'cors',
                        credentials: 'omit'
                    });
                    
                    if (response.ok) {
                        const blob = await response.blob();
                        await ImageCacheDB.saveImage(urlImagen, blob);
                        imagenesCacheadas++;
                        console.log('💾 Guardado en cache:', urlImagen);
                    }
                } catch (error) {
                    console.warn('❌ Error cacheando imagen:', urlImagen, error);
                }
            })
        );
        
        // Pequeña pausa entre lotes
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`🎉 Precarga completada: ${imagenesCacheadas}/${urlsUnicas.length} imágenes en cache`);
}

/**
 * Verifica el estado de la cache y muestra estadísticas
 */
async function verificarEstadoCache() {
  if (!('caches' in window)) {
    console.log('❌ Cache API no disponible');
    return;
  }
  
  try {
    const cache = await caches.open(STATIC_CACHE);
    const keys = await cache.keys();
    const imagenesEnCache = keys.filter(key => 
      key.url.includes('/uc?export=view') || 
      key.url.includes('googleusercontent.com')
    );
    
    console.log(`📊 Cache: ${imagenesEnCache.length} imágenes almacenadas`);
    
    // Mostrar notificación si hay muchas imágenes en cache
    if (imagenesEnCache.length > 0) {
      console.log('✅ Modo offline disponible');
    }
  } catch (error) {
    console.warn('❌ Error verificando cache:', error);
  }
}

/* SOBRE LOS PRECIOS A MOSTRAR U OCULTAR */
/**
 * Actualiza la visibilidad de precios en elementos existentes
 */
function actualizarVisibilidadPrecios() {
    const mostrarPrecios = debeMostrarPrecios();
    const precioElements = document.querySelectorAll('.product-price');
    
    precioElements.forEach(element => {
        if (mostrarPrecios) {
            element.classList.remove('no-price');
            // Aquí podrías restaurar el precio original si lo guardaste en un data attribute
        } else {
            element.classList.add('no-price');
            element.textContent = 'Consultar precio';
        }
    });
}