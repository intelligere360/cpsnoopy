// local-config.js - CON SISTEMA DE VERSIONADO
const LOCAL_CONFIG = {
    // Configuración de rutas locales
    BASE_URL: window.location.origin,
    DATA_PATH: './data/',
    IMAGES_PATH: './data/productos/',
    
    // Archivos JSON
    PRODUCTS_JSON: 'products.json',
    CONFIG_JSON: 'config.json',
    
    // Sistema de versionado
    VERSION_KEY: 'app_version_cache',
    CACHE_VERSION: 'v2.0.15', // Debe coincidir con config.json
    CHECK_INTERVAL: 3600000, // 1 hora en milisegundos
};

// Función para verificar actualizaciones
async function checkForUpdates() {
    try {
        const currentVersion = localStorage.getItem(LOCAL_CONFIG.VERSION_KEY);
        // ✅ AÑADIR headers para evitar cache
        const response = await fetch(`${LOCAL_CONFIG.DATA_PATH}${LOCAL_CONFIG.CONFIG_JSON}?_=${Date.now()}`, {
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });
        
        if (!response.ok) {
            console.warn('❌ No se pudo cargar config.json');
            return false;
        }
        
        const config = await response.json();
        
        // ✅ VERIFICAR QUE LA VERSIÓN EXISTA
        if (!config.version) {
            console.error('❌ config.json no tiene propiedad "version"');
            return false;
        }

        const newVersion = config.version.toString(); // Convertir a string

        console.log(`🔍 Verificando versión: Actual=${currentVersion || 'ninguna'}, Nueva=${newVersion}`);
        
        // Si no hay versión guardada o hay nueva versión
        if (!currentVersion || currentVersion !== newVersion) {
            console.log(`🔄 Nueva versión detectada: ${currentVersion || 'ninguna'} → ${newVersion}`);
            
            // ✅ GUARDAR ANTES DE NOTIFICAR
            localStorage.setItem(LOCAL_CONFIG.VERSION_KEY, newVersion);
            
            // Notificar al Service Worker
            notifyServiceWorkerUpdate(newVersion);
            
            // ✅ MOSTRAR NOTIFICACIÓN UNA SOLA VEZ
            setTimeout(() => {
                mostrarNotificacionUnaVez(`🔄 Nueva versión ${newVersion} disponible. Recargando...`, 'info', newVersion);
            }, 1000);
            
            return true;
        }
        
        return false;
    } catch (error) {
        console.warn('❌ Error verificando actualizaciones:', error);
        return false;
    }
}

// ✅ NUEVA FUNCIÓN: Mostrar notificación solo una vez por versión
function mostrarNotificacionUnaVez(mensaje, tipo, version) {
    const lastNotifiedVersion = localStorage.getItem('last_notified_version');
    
    if (lastNotifiedVersion === version) {
        console.log(`⏩ Ya se notificó versión ${version}, omitiendo...`);
        return;
    }
    
    mostrarNotificacion(mensaje, tipo);
    
    // Guardar que ya notificamos esta versión
    localStorage.setItem('last_notified_version', version);
    
    // ✅ RECARGAR SOLO DESPUÉS DE 5 SEGUNDOS, UNA SOLA VEZ
    const reloadKey = `reloaded_${version}`;
    if (!localStorage.getItem(reloadKey)) {
        setTimeout(() => {
            console.log(`🔄 Recargando para versión ${version}...`);
            localStorage.setItem(reloadKey, 'true');
            window.location.reload();
        }, 5000);
    }
}

// Notificar al Service Worker sobre nueva versión
function notifyServiceWorkerUpdate(version) {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
            type: 'NEW_VERSION',
            version: version,
            timestamp: Date.now()
        });
    }
}

// Verificar actualizaciones periódicamente - VERSIÓN MEJORADA
function startUpdateChecker() {
    // ✅ VERIFICAR INMEDIATAMENTE SOLO SI NO SE HA HECHO HOY
    const lastCheck = localStorage.getItem('last_update_check');
    const today = new Date().toISOString().split('T')[0]; // Solo fecha
    
    if (lastCheck !== today) {
        setTimeout(() => {
            console.log('🔍 Verificando actualizaciones...');
            checkForUpdates();
            localStorage.setItem('last_update_check', today);
        }, 10000); // Esperar 10 segundos después de cargar
    }
    
    // ✅ VERIFICAR CADA 4 HORAS, NO CADA 1 HORA
    setInterval(() => {
        console.log('🕐 Verificación periódica de actualizaciones...');
        checkForUpdates();
    }, 4 * 60 * 60 * 1000); // 4 horas
    
    // Verificar cuando la app vuelve a estar online
    window.addEventListener('online', () => {
        console.log('🌐 Conectado, verificando actualizaciones...');
        setTimeout(checkForUpdates, 5000);
    });
}

// Función para construir URL de imagen local
function buildLocalImageUrl(imageName) {
    if (!imageName) return './images/placeholder.jpg';
    
    // Limpiar nombre de archivo
    const cleanName = imageName.replace(/[^\w\s.-]/g, '');
    
    // Añadir timestamp de versión para evitar cache
    const version = localStorage.getItem(LOCAL_CONFIG.VERSION_KEY) || '1.0.0';
    const cacheBuster = `?v=${version.replace(/\./g, '')}`;
    
    return `${LOCAL_CONFIG.IMAGES_PATH}${cleanName}${cacheBuster}`;
}

// Función para obtener JSON local con cache busting
async function getLocalJson(filename) {
    try {
        const version = localStorage.getItem(LOCAL_CONFIG.VERSION_KEY) || '1.0.0';
        const url = `${LOCAL_CONFIG.DATA_PATH}${filename}?v=${version.replace(/\./g, '')}`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Error ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error(`❌ Error cargando ${filename}:`, error);
        return null;
    }
}

// Exportar funciones
window.LocalConfig = {
    ...LOCAL_CONFIG,
    checkForUpdates,
    startUpdateChecker,
    buildLocalImageUrl,
    getLocalJson
};