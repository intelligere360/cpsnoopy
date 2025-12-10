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
        return image !== undefined && image !== null;
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
        mostrar_precios: false, // Valor por defecto
        version: "1.0.0",
        idioma: "es"
    }
};

// =============================================
// SISTEMA DE CONFIGURACIÓN
// =============================================

// Al inicio de app.js, después de las definiciones
if (!('indexedDB' in window)) {
    console.error('❌ IndexedDB no soportado - Cache no disponible');
}

if (!('serviceWorker' in navigator)) {
    console.warn('⚠️ Service Worker no soportado - Modo offline limitado');
}

// Detectar si estamos en iOS para ajustes específicos
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
if (isIOS) {
    console.log('📱 Detectado iOS - Aplicando ajustes específicos');
    document.documentElement.classList.add('ios-device');
}
/**
 * Carga la configuración desde config.json
 */
async function cargarConfiguracion() {
    try {
        console.log('⚙️ Cargando configuración...');
        
        // Intentar cargar desde Google Drive
        const configData = await getLocalJson(LOCAL_CONFIG.CONFIG_JSON);
        
        // Verificar estructura del archivo
        if (configData && typeof configData === 'object') {
            // Si es un objeto directo
            AppState.config = { ...AppState.config, ...configData };
            console.log('✅ Configuración local cargada:', AppState.config);
        } else if (Array.isArray(configData) && configData.length > 0) {
            // Si es un array (compatibilidad)
            AppState.config = { ...AppState.config, ...configData[0] };
            console.log('✅ Configuración local cargada desde array:', AppState.config);
        }
        
        // Guardar en cache local
        guardarConfigCache(AppState.config);
        
    } catch (error) {
        console.warn('❌ Error cargando configuración local, usando cache o valores por defecto:', error);
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
        document.title = 'Peter Snoopy - Catálogo Portátil';
    }
    
    // Buscar y limpiar elementos que puedan contener la URL
    const elementosSospechosos = document.querySelectorAll('*');
    elementosSospechosos.forEach(elemento => {
        const html = elemento.innerHTML || '';
        const text = elemento.textContent || '';
        
        // Si contiene la URL de GitHub, limpiar o ocultar
        if (html.includes('github.io') || text.includes('github.io') ||
            html.includes('intelligere360') || text.includes('intelligere360')) {
            
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
    });
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

/**
 * Maneja errores de carga de imágenes
 */
async function manejarErrorImagen(imgElement, urlOriginal) {
    console.warn('❌ Error cargando imagen, intentando desde cache:', urlOriginal);
    
    try {
        // Intentar obtener desde cache
        const cachedImage = await ImageCacheDB.getImage(urlOriginal);
        if (cachedImage) {
            imgElement.src = URL.createObjectURL(cachedImage);
            imgElement.style.opacity = '1';
            console.log('✅ Imagen recuperada desde cache después de error');
        } else {
            // Usar placeholder
            imgElement.src = './images/placeholder.jpg';
            imgElement.style.opacity = '1';
            console.log('🟡 Usando placeholder después de error');
        }
    } catch (error) {
        imgElement.src = './images/placeholder.jpg';
        imgElement.style.opacity = '1';
    }
}

function generarSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function obtenerDatosUsuario() {
    return {
        sessionId: AppState.sessionId,
        timestamp: new Date().toISOString(),
        plataforma: navigator.userAgent.platform,
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
async function enviarNotificacionProveedor(notificationData) {

    async function registrarConsultaEnExcel(notificationData) {   
        // Incrementar contador local
        incrementarContadorConsulta(notificationData.producto.id);
        
        // Enviar a servidor/Google Apps Script para Excel
        await enviarConsultaAExcel(notificationData);
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
        await registrarConsultaEnExcel(notificationData)
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
        product_price: `${formatearPrecio(data.producto.precioMin, data.producto.precioMax)}`,
        product_category: data.producto.categoria,
        product_id: data.producto.id,
        contact_type: data.tipo,
        session_id: data.usuario.sessionId,
        platform: data.usuario.plataforma,
        language: data.usuario.idioma,
        timestamp: new Date(data.timestamp).toLocaleString('es-ES'),
        user_agent: data.usuario.userAgent,
        current_date: new Date().toLocaleDateString('es-ES'),
        to_email: configContacto.proveedor.email,
        navegador: data.infoCompleta.navegador,
        hardware: data.infoCompleta.hardware,
        pantalla: data.infoCompleta.pantalla,
        conexion: data.infoCompleta.conexion,
        dispositivo: data.infoCompleta.dispositivo,
        multimedia: data.infoCompleta.multimedia
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
// MOSTRANDO LISTADO DE ARTICULOS/PRODUCTOS EXISTENTES
// =============================================

async function mostrarProductosDesdeCache(productosAMostrar) {
    const grid = document.getElementById('productsGrid');
    
    if (!productosAMostrar || productosAMostrar.length === 0) {
        grid.innerHTML = `<div class="no-products">No hay productos disponibles.</div>`;
        return;
    }
    
    console.log('🖼️ Renderizando desde cache...');

    const mostrarPrecios = debeMostrarPrecios();
    
    // Crear HTML con imágenes desde cache
    const productosHTML = await Promise.all(
        productosAMostrar.map(async (producto) => {
            let imagenSrc = './images/placeholder.jpg';
            
            // ✅ MEJORADO: Intentar múltiples fuentes
            if (producto.imagenPrincipal) {
                try {
                    const cachedImage = await ImageCacheDB.getImage(producto.imagenPrincipal);
                    if (cachedImage) {
                        imagenSrc = URL.createObjectURL(cachedImage);
                        console.log('✅ Imagen servida desde cache:', producto.nombre);
                    } else {
                        // Si no está en cache, usar la URL original pero forzar descarga
                        imagenSrc = producto.imagenPrincipal;
                        console.log('🌐 Imagen servida desde red:', producto.nombre);
                    }
                } catch (error) {
                    console.warn('❌ Error obteniendo imagen de cache:', error);
                    imagenSrc = producto.imagenPrincipal;
                }
            }
            
            const precioHTML = mostrarPrecios 
                ? `<div class="product-price">${formatearPrecio(producto.precioMin, producto.precioMax)}</div>` : ``;
            
            const badgeNuevo = producto.nuevo 
                ? `<div class="product-badge" data-product-id="${producto.id}">¡Como Nuevo!</div>` : ``;

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
                         onerror="manejarErrorImagen(this, '${producto.imagenPrincipal}')"
                         style="opacity: 0.7; transition: opacity 0.3s ease">
                    ${badgeNuevo}
                </div>
                <div class="product-info">
                    <div class="product-name">${producto.nombre}</div>
                    ${precioHTML}
                </div>
            </div>
            `;
        })
    );
    
    grid.innerHTML = productosHTML.join('');
    
    // ✅ FORZAR ACTUALIZACIÓN DESPUÉS DE RENDERIZAR
    setTimeout(() => {
        imagePreloader.actualizarImagenesVisibles();
    }, 1000);
}
/**
 * Muestra esqueletos de carga mientras se obtienen los productos
 */
async function mostrarEsqueletosCarga() {
    const grid = document.getElementById('productsGrid');
    // CARGAR LOS PRODUCTOS...
    let productos = await getLocalJson(LOCAL_CONFIG.PRODUCTS_JSON);
    // CALCULAR # TOTAL DE PRODUCTOS
    const skeletonCount = productos.length;

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
    // RETORNAR LA LISTA ARRAY CON TODOS LOS PRODUCTOS Y SUS DETALLES
    return productos;
}
/**
 * Procesa las imágenes que vienen en el JSON
 */
function procesarImagenesDesdeJSON(producto) {
    if (producto.imagenes && Array.isArray(producto.imagenes)) {
        return producto.imagenes.map(img => ({
            id: img.id || img.nombre, // Usar nombre como ID
            url: buildLocalImageUrl(img.nombre), // ← Cambio importante
            nombre: img.nombre,
            principal: img.principal || false,
            orden: img.orden || 1
        }));
    }
    
    // Fallback
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
            return buildLocalImageUrl(principal.nombre); // ← Cambio
        }
        // Si no hay principal, usar la primera
        return buildLocalImageUrl(producto.imagenes[0].nombre); // ← Cambio
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
            productos = data.productos;
            console.log('📂 Productos cargados desde cache');
            mostrarProductosDesdeCache(productos);
            cargarCategorias();
            return true;
            
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
        : `<div class="product-price no-price">Consulta el precio</div>`;
    
    // ✅ NUEVO: Badge "NUEVO" para el modal
    const badgeNuevoModal = producto.nuevo ? `<div class="modal-badge">¡Como Nuevo!</div>` : '';

    // ✅ NUEVO: Mostrar esqueleto de carga mientras se obtienen las imágenes
    modalContent.innerHTML = `
        <div class="product-detail">
            <div class="detail-images">
                <div class="carousel-skeleton">
                    <div class="skeleton-image-large"></div>
                </div>
                ${badgeNuevoModal}
            </div>
            <div class="detail-info">
                <h2>${producto.nombre}</h2>
                <p class="product-category">Categoría: ${producto.categoria}</p>
                ${precioHTML}
                <div class="product-specs">
                    <h4>Descripción:</h4>
                    <p class="product-description">${producto.descripcion}</p>
                </div>
                ${formatearEspecificaciones(producto.especificaciones)}
            </div>
        </div>
    `;
    
    // ✅ NUEVO: Crear carrusel con imágenes cacheadas
    await crearCarruselConCache(producto);
    
    // Actualizar enlaces de contacto
    const str_precio_saber = AppState.config.mostrar_precios ? 
        formatearPrecio(producto.precioMin, producto.precioMax) : 
        `¿Cuándo y dónde lo puedo ver?`;
    
    // ✅ NUEVO: Configurar todos los botones de contacto
    configurarBotonesContacto(producto, str_precio_saber);

    document.getElementById('productModal').style.display = 'block';
}

// ✅ FUNCIÓN MEJORADA: Configurar todos los botones de contacto
function configurarBotonesContacto(producto, str_precio_saber) {
    // Detectar si es dispositivo móvil o tablet
    const esDispositivoMovil = detectarDispositivoMovil();
    
    // Mensaje para todos los contactos
    const mensaje = `Hola, me interesa: ${producto.nombre} - ${str_precio_saber}`;
    const asuntoCorreo = `Consulta: ${producto.nombre}`;
    
    // Configurar cada botón
    configurarBotonLlamada(producto);
    configurarBotonWhatsApp(producto, mensaje);
    configurarBotonSMS(producto, mensaje);
    configurarBotonCorreo(producto, mensaje, asuntoCorreo);
    
    // Si es dispositivo móvil/tablet, aplicar layout 2x2
    if (esDispositivoMovil) {
        aplicarLayout2x2();
    }
}

// Configurar botón de llamada
function configurarBotonLlamada(producto) {
    const telefono = configContacto.telefono || '+584126597297';
    const btn = document.getElementById('btnLlamada');
    
    if (btn) {
        btn.href = `tel:${telefono}`;
        btn.title = `Llamar a ${telefono}`;
        
        // Configurar tracking
        btn.onclick = function(e) {
            e.preventDefault();
            registerProductConsult(producto, 'Llamada')
                .finally(() => {
                    window.location.href = btn.href;
                });
        };
    }
}

// Configurar botón de WhatsApp
function configurarBotonWhatsApp(producto, mensaje) {
    const whatsapp = configContacto.whatsapp || '584126597297';
    const urlWhatsapp = `https://wa.me/${whatsapp}?text=${encodeURIComponent(mensaje)}`;
    const btn = document.getElementById('whatsappModal');
    
    if (btn) {
        btn.href = urlWhatsapp;
        btn.title = 'Abrir WhatsApp para consultar';
        
        // Configurar tracking
        btn.onclick = function(e) {
            e.preventDefault();
            registerProductConsult(producto, 'Whatsapp')
                .finally(() => {
                    window.location.href = btn.href;
                });
        };
    }
}

// Configurar botón de SMS
function configurarBotonSMS(producto, mensaje) {
    const telefono = configContacto.telefono || '+584126597297';
    const urlSMS = `sms:${telefono}?body=${encodeURIComponent(mensaje)}`;
    const btn = document.getElementById('btnSMS');
    
    if (btn) {
        btn.href = urlSMS;
        btn.title = 'Enviar SMS';
        
        // Configurar tracking
        btn.onclick = function(e) {
            e.preventDefault();
            registerProductConsult(producto, 'SMS')
                .finally(() => {
                    window.location.href = btn.href;
                });
        };
    }
}

// Configurar botón de Correo
function configurarBotonCorreo(producto, mensaje, asuntoCorreo) {
    const email = configContacto.email || 'ramonsimancas61@gmail.com';
    const urlCorreo = `mailto:${email}?subject=${encodeURIComponent(asuntoCorreo)}&body=${encodeURIComponent(mensaje)}`;
    const btn = document.getElementById('btnCorreo');
    
    if (btn) {
        btn.href = urlCorreo;
        btn.title = `Enviar correo a ${email}`;
        
        // Configurar tracking
        btn.onclick = function(e) {
            e.preventDefault();
            registerProductConsult(producto, 'Email')
                .finally(() => {
                    // Abrir el cliente de correo
                    setTimeout(() => {
                        window.location.href = btn.href;
                    }, 100);
                });
        };
        
        // Manejo alternativo si no hay cliente de correo
        btn.addEventListener('click', function(e) {
            try {
                return true; // Dejar que el navegador maneje el mailto
            } catch (error) {
                e.preventDefault();
                // Opción alternativa: copiar correo al portapapeles
                navigator.clipboard.writeText(email)
                    .then(() => {
                        alert(`Correo copiado: ${email}\nPega en tu cliente de correo preferido.\n\nAsunto: ${asuntoCorreo}\n\nMensaje: ${mensaje}`);
                    })
                    .catch(() => {
                        alert(`Para contactar, envía un correo a: ${email}\n\nAsunto: ${asuntoCorreo}\n\nMensaje: ${mensaje}`);
                    });
                return false;
            }
        });
    }
}

// Aplicar layout 2x2 para dispositivos móviles
function aplicarLayout2x2() {
    const modalActions = document.querySelector('.modal-actions');
    if (modalActions) {
        modalActions.classList.add('layout-2x2');
    }
}

// ✅ FUNCIÓN AUXILIAR: Detectar dispositivo móvil o tablet
function detectarDispositivoMovil() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    
    // Detección por User Agent
    const esMovilPorUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    
    // Detección por tamaño de pantalla
    const esPorPantalla = window.innerWidth <= 1024; // Incluye tablets
    
    // Detección por capacidades táctiles
    const tieneTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    
    // Es tablet si tiene pantalla mediana y capacidades táctiles
    const esTablet = window.innerWidth >= 768 && window.innerWidth <= 1024 && tieneTouch;
    
    // Combinar criterios para mayor precisión
    return (esMovilPorUA && esPorPantalla) || (tieneTouch && esPorPantalla) || esTablet;
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

        // ✅ NUEVO: Badge "NUEVO" para el carrusel
        const badgeNuevoModal = producto.nuevo ? `<div class="modal-badge">¡Como Nuevo!</div>` : '';
        
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
            ${badgeNuevoModal}
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
        }, { passive: false});

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
    if (!especificaciones) return ``;
    
    // Dividir por punto y coma y limpiar espacios
    const items = especificaciones.split(';')
        .map(item => item.trim())
        .filter(item => item.length > 0);
    
    if (items.length === 0) return ``;
    
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
    try {
        // 1. Registrar Service Worker PRIMERO
        // esta en index.html
        await obtenerTodaInfoDispositivo();       
        // 2. Configurar modo App/APK
        configurarModoApp();
        
        // ✅ NUEVO: 3. Cargar configuración primero
        await cargarConfiguracion();
        
        // 4. Inicializar EmailJS
        if (typeof emailjs !== 'undefined') {
            emailjs.init(configContacto.proveedor.userId);
        }
        
        // 5. Cargar productos CON PRECARGA PERSISTENTE
        await cargarProductosConPrecargaPersistente();
        
        // 6. Configurar eventos básicos
        configurarEventListeners();
            
        // 8. Configurar detección de conexión
        configurarDeteccionConexion();
        
        // ✅ NUEVO: 9. Aplicar configuración de precios
        aplicarConfiguracionPrecios();

        // 10. Verificar estado de cache
        setTimeout(() => verificarEstadoCache(), 2000);
        
        console.log('🚀 Catálogo iniciado con soporte para APK');
    } catch (error) {
        console.error('❌ Error crítico al iniciar:', error);
        mostrarNotificacion('Error al cargar el catálogo', 'error');
    }
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
        mostrarNotificacion('Conexión restablecida - Reanudando precarga', 'success');
        // Reanudar precarga persistente si hay productos cargados
        if (productos.length > 0) {
            imagePreloader.resumeWithNewProducts(productos);
        }
        procesarColaOffline();
        setTimeout(() => {
            procesarColaExcel();
            procesarConsultasLocales();
        }, 3000);
    });

    // Procesar al cargar la página si hay conexión
    if (navigator.onLine) {
        setTimeout(() => {
            procesarColaExcel();
            procesarConsultasLocales();
        }, 5000);
    }

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
    // ✅ ORDENAR CATEGORÍAS ALFABÉTICAMENTE DE FORMA INCREMENTAL (A-Z)
    categorias.sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

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
      key.url.includes('googleapis.com')
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

/* FUNCIONES PARA EL QUICK LOADER */
function mostrarLoaderRapido() {
    const loader = document.getElementById('quickLoader');
    if (loader) loader.style.display = 'flex';
}

function ocultarLoaderRapido() {
    const loader = document.getElementById('quickLoader');
    if (loader) loader.style.display = 'none';
}

/**
 * Envía consulta a Google Sheets/Excel en Google Drive
 * @param {Object} consultaData - Datos de la consulta del producto
 */
async function enviarConsultaAExcel(consultaData) {
    try {
        console.log('📊 Enviando consulta a Excel...');
        
        // ID del archivo Excel en Google Drive (debes reemplazar con tu ID real)
        // const EXCEL_FILE_ID = '1ZhD6a1t_1tVJz7fQv9DnMmqUTnSEjXwsyjcvh57OMSk'; // ← REEMPLAZAR CON ID REAL
        
        // URL de Google Apps Script para procesar los datos
        // const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxmpC7OfqAo_r5K7affexSoCS9csY2iqg7XYaEv_dBLtdNwoslCGoayMRqKiEWPyEEDhw/exec'; // ← REEMPLAZAR CON URL REAL
        
        // Preparar datos para el Excel (mapear a las columnas del Excel)
        const excelData = {
            product_id: consultaData.producto.id,
            product_name: consultaData.producto.nombre,
            product_category: consultaData.producto.categoria,
            precioMin: consultaData.producto.precioMin,
            precioMax: consultaData.producto.precioMax,
            fecha: new Date(consultaData.timestamp).toLocaleDateString('es-ES'),
            hora: new Date(consultaData.timestamp).toLocaleTimeString('es-ES'),
            contact_type: consultaData.tipo,
            user_platform: consultaData.usuario.plataforma,
            user_agent: consultaData.usuario.userAgent,
            status: 'consulta',
            session_id: consultaData.usuario.sessionId,
            timestamp: consultaData.timestamp
        };

        // Opción 1: Usar Google Apps Script (RECOMENDADO)
        await enviarViaGoogleAppsScript(excelData);
        
        // Opción 2: Fallback - Guardar localmente para procesar después
        guardarConsultaLocal(excelData);
        
        console.log('✅ Consulta registrada para Excel');
        
    } catch (error) {
        console.error('❌ Error enviando consulta a Excel:', error);
        // Guardar en cola local para reintentar después
        guardarEnColaExcel(consultaData);
    }
}
/**
 * Envía datos a Google Apps Script para escribir en Excel
 */
async function enviarViaGoogleAppsScript(excelData) {
    try {
        console.log('📤 Enviando datos via POST...', excelData);
        
        const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxmpC7OfqAo_r5K7affexSoCS9csY2iqg7XYaEv_dBLtdNwoslCGoayMRqKiEWPyEEDhw/exec';
        
        // SOLO usar no-cors (es lo único que funciona)
        const response = await fetch(WEB_APP_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(excelData)
        });

        console.log('✅ Solicitud no-cors enviada (asumiendo éxito)');
        return true;
        
    } catch (error) {
        console.warn('❌ Error enviando datos:', error);
        // Siempre retornar true para no bloquear el flujo
        return true;
    }
}
/**
 * Guarda consulta localmente para procesar después
 */
function guardarConsultaLocal(excelData) {
    try {
        let consultasLocales = JSON.parse(localStorage.getItem('consultas_excel_pendientes') || '[]');
        
        consultasLocales.push({
            ...excelData,
            intentos: 0,
            fechaCreacion: new Date().toISOString()
        });
        
        localStorage.setItem('consultas_excel_pendientes', JSON.stringify(consultasLocales));
        console.log('💾 Consulta guardada localmente para Excel');
        
    } catch (error) {
        console.error('❌ Error guardando consulta local:', error);
    }
}
/**
 * Guarda en cola para reintentos
 */
function guardarEnColaExcel(consultaData) {
    try {
        let colaExcel = JSON.parse(localStorage.getItem('cola_excel_pendientes') || '[]');
        
        colaExcel.push({
            ...consultaData,
            intentos: 0,
            fechaCreacion: new Date().toISOString()
        });
        
        localStorage.setItem('cola_excel_pendientes', JSON.stringify(colaExcel));
        console.log('📦 Consulta en cola para Excel');
        
    } catch (error) {
        console.error('❌ Error guardando en cola Excel:', error);
    }
}
/**
 * Procesa consultas pendientes para Excel cuando hay conexión
 */
async function procesarColaExcel() {
    if (!navigator.onLine) return;
    
    let colaExcel = JSON.parse(localStorage.getItem('cola_excel_pendientes') || '[]');
    if (colaExcel.length === 0) return;

    console.log(`🔄 Procesando ${colaExcel.length} consultas pendientes para Excel...`);
    
    const pendientes = [];
    
    for (let i = 0; i < colaExcel.length; i++) {
        const item = colaExcel[i];
        if (item.intentos < 3) {
            try {
                await enviarConsultaAExcel(item);
                console.log('✅ Consulta Excel pendiente procesada');
            } catch (error) {
                item.intentos++;
                pendientes.push(item);
            }
        } else {
            console.warn('❌ Consulta Excel descartada después de 3 intentos:', item);
        }
    }
    
    localStorage.setItem('cola_excel_pendientes', JSON.stringify(pendientes));
}
/**
 * Procesa consultas locales guardadas
 */
async function procesarConsultasLocales() {
    if (!navigator.onLine) return;
    
    let consultasLocales = JSON.parse(localStorage.getItem('consultas_excel_pendientes') || '[]');
    if (consultasLocales.length === 0) return;

    console.log(`🔄 Procesando ${consultasLocales.length} consultas locales...`);
    
    const pendientes = [];
    
    for (let i = 0; i < consultasLocales.length; i++) {
        const item = consultasLocales[i];
        try {
            await enviarViaGoogleAppsScript(item);
            console.log('✅ Consulta local enviada a Excel');
        } catch (error) {
            pendientes.push(item);
        }
    }
    
    localStorage.setItem('consultas_excel_pendientes', JSON.stringify(pendientes));
}

// =============================================
// SISTEMA DE PRECARGA PERSISTENTE DE IMÁGENES
// =============================================

/**
 * Envía URLs al Service Worker para precache agresivo
 */
function enviarUrlsAlServiceWorker(urls) {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
            type: 'PRECACHE_IMAGES',
            urls: urls
        });
        console.log('📤 Enviadas URLs al Service Worker para precache:', urls.length);
    }
}
// Clase PersistentImagePreloader =========================================
class PersistentImagePreloader {
    constructor() {
        this.isPreloading = false;
        this.currentBatch = 0;
        this.maxRetries = 5;
        this.retryDelay = 5000; // 5 segundos entre intentos
        this.batchSize = 3; // Imágenes simultáneas
        this.pendingUrls = new Set();
        this.retryCounts = new Map();
    }

    /**
     * Inicia el sistema de precarga persistente
     */
    startPersistentPreloading(productos) {
        if (this.isPreloading) return;
        
        console.log('🚀 Iniciando precarga persistente de imágenes...');
        this.isPreloading = true;
        
        // Recolectar todas las URLs de imágenes
        this.collectImageUrls(productos);
        
        // Iniciar el bucle de precarga
        this.preloadLoop();
        
        // También precargar inmediatamente
        this.preloadBatch();
    }

    /**
     * Recolecta todas las URLs de imágenes de los productos
     */
    collectImageUrls(productos) {
        this.pendingUrls.clear();
        
        productos.forEach(producto => {
            if (producto.imagenes && producto.imagenes.length > 0) {
                producto.imagenes.forEach(imagen => {
                    if (imagen.url && 
                        !imagen.url.includes('placeholder') && 
                        !imagen.url.includes('undefined')) {
                        this.pendingUrls.add(imagen.url);
                    }
                });
            }
        });
        
        console.log(`📸 ${this.pendingUrls.size} imágenes para precargar`);
    }

    /**
     * Bucle principal de precarga
     */
    async preloadLoop() {
        while (this.isPreloading && this.pendingUrls.size > 0) {
            await this.delay(this.retryDelay);
            
            // Verificar conexión antes de intentar
            if (navigator.onLine) {
                await this.preloadBatch();
            } else {
                console.log('🌐 Sin conexión, esperando para reintentar precarga...');
            }
        }
        
        if (this.pendingUrls.size === 0) {
            console.log('✅ Todas las imágenes precargadas exitosamente');
        }
    }

    /**
     * Precarga un lote de imágenes
     */
    async preloadBatch() {
        if (this.pendingUrls.size === 0) return;

        const urlsToProcess = Array.from(this.pendingUrls)
            .slice(0, this.batchSize);
        
        console.log(`🔄 Precargando lote de ${urlsToProcess.length} imágenes...`);

        // ✅ ENVIAR AL SERVICE WORKER TAMBIÉN
        enviarUrlsAlServiceWorker(urlsToProcess);

        const results = await Promise.allSettled(
            urlsToProcess.map(url => this.preloadSingleImage(url))
        );

        // Procesar resultados
        results.forEach((result, index) => {
            const url = urlsToProcess[index];
            
            if (result.status === 'fulfilled') {
                // Éxito: remover de pendientes
                this.pendingUrls.delete(url);
                this.retryCounts.delete(url);
                console.log(`✅ Precargada: ${this.getShortUrl(url)}`);
            } else {
                // Error: incrementar contador de reintentos
                const retries = (this.retryCounts.get(url) || 0) + 1;
                this.retryCounts.set(url, retries);
                
                if (retries >= this.maxRetries) {
                    // Demasiados intentos, remover
                    this.pendingUrls.delete(url);
                    this.retryCounts.delete(url);
                    console.warn(`❌ Removida después de ${retries} intentos: ${this.getShortUrl(url)}`);
                } else {
                    console.warn(`⚠️ Reintento ${retries}/${this.maxRetries} para: ${this.getShortUrl(url)}`);
                }
            }
        });

        this.currentBatch++;
    }

    /**
     * Precarga una imagen individual con manejo robusto de errores
     */
    async preloadSingleImage(url) {
        try {
            // 1. Verificar si ya está en cache
            const existsInCache = await ImageCacheDB.imageExists(url);
            if (existsInCache) {
                return { cached: true, url };
            }

            // 2. Intentar descargar
            const response = await fetch(url, {
                mode: 'cors',
                credentials: 'omit',
                signal: AbortSignal.timeout(15000) // Timeout de 15 segundos
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            // 3. Guardar en cache
            const blob = await response.blob();
            await ImageCacheDB.saveImage(url, blob);

            // 4. Notificar a la UI si es necesario
            this.notifyImageLoaded(url);

            return { success: true, url };

        } catch (error) {
            console.warn(`❌ Error precargando ${this.getShortUrl(url)}:`, error.message);
            throw error;
        }
    }

    /**
     * Notifica cuando una imagen se carga para actualizar UI si es necesario
     */
    notifyImageLoaded(imageUrl) {
        // Actualizar imágenes visibles después de cada lote
        setTimeout(() => {
            this.actualizarImagenesVisibles();
        }, 500);
    }
    /**
     * Actualiza todas las imágenes visibles con versiones cacheadas
     */
    async actualizarImagenesVisibles() {
        const productCards = document.querySelectorAll('.product-card');
        
        for (const card of productCards) {
            const img = card.querySelector('.product-image');
            if (img && img.src && !img.src.includes('placeholder')) {
                try {
                    const cachedImage = await ImageCacheDB.getImage(img.src);
                    if (cachedImage) {
                        const cachedUrl = URL.createObjectURL(cachedImage);
                        // Solo actualizar si es diferente
                        if (img.src !== cachedUrl) {
                            img.src = cachedUrl;
                            console.log('🔄 Imagen actualizada en UI:', this.getShortUrl(img.src));
                        }
                    }
                } catch (error) {
                    // Silenciar errores
                }
            }
        }
    }
    /**
     * Obtiene URL abreviada para logging
     */
    getShortUrl(url) {
        try {
            const urlObj = new URL(url);
            // Extraer el ID de Google Drive de la URL
            const idMatch = url.match(/id=([^&]+)/);
            if (idMatch) return `Drive:${idMatch[1].substring(0, 8)}...`;
            return urlObj.pathname.split('/').pop() || url.substring(0, 30);
        } catch {
            return url.substring(0, 30);
        }
    }

    /**
     * Delay helper
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Detiene la precarga
     */
    stop() {
        this.isPreloading = false;
        console.log('🛑 Precarga persistente detenida');
    }

    /**
     * Reanuda la precarga con nuevos productos
     */
    resumeWithNewProducts(productos) {
        this.collectImageUrls(productos);
        if (!this.isPreloading) {
            this.startPersistentPreloading(productos);
        }
    }
}
// Instancia global del preloader
const imagePreloader = new PersistentImagePreloader();

/**
 * Función mejorada para cargar productos que inicia la precarga persistente
 */
async function cargarProductosConPrecargaPersistente(forzarActualizacion = false) {
    try {
        console.log('📦 Iniciando carga de productos con precarga persistente...');
        mostrarLoaderRapido();
        
        // 1. MOSTRAR ESQUELETO DEL LISTADO, RETORNAR PRODUCTOS Y CARGAR JSON DE LOS PRODUCTOS PRIMERO
        const productosData = await mostrarEsqueletosCarga();

        if (!productosData || productosData.length === 0) {
            throw new Error('No se pudieron cargar los productos');
        }
        
        // 2. PROCESAR PRODUCTOS RÁPIDAMENTE
        productos = productosData.map(producto => {
            const imagenesProcesadas = procesarImagenesDesdeJSON(producto);
            const imagenPrincipal = obtenerImagenPrincipalDesdeJSON({ ...producto, imagenes: imagenesProcesadas });
            return {
                ...producto,
                imagenes: imagenesProcesadas,
                imagenPrincipal: imagenPrincipal
            };
        });
        
        guardarCacheLocal(productos);
        console.log(`✅ ${productos.length} productos procesados`);
        
        // 3. MOSTRAR PRODUCTOS INMEDIATAMENTE
        await mostrarProductosDesdeCache(productos);
        cargarCategorias();
        actualizarBadgesConsultas();
        aplicarConfiguracionPrecios();

        // 4. ✅ INICIAR PRECARGA PERSISTENTE EN SEGUNDO PLANO
        setTimeout(() => {
            imagePreloader.startPersistentPreloading(productos);
        }, 1000);
        
        // 5. OCULTAR LOADER
        ocultarLoaderRapido();
        
    } catch (error) {
        console.error('❌ Error cargando productos:', error);
        ocultarLoaderRapido();
        await cargarDesdeCache();
    }
}