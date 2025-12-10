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
    CACHE_VERSION: 'v2.0.0', // Debe coincidir con config.json
    CHECK_INTERVAL: 3600000, // 1 hora en milisegundos
};

// Función para verificar actualizaciones
async function checkForUpdates() {
    try {
        const currentVersion = localStorage.getItem(LOCAL_CONFIG.VERSION_KEY);
        const response = await fetch(`${LOCAL_CONFIG.DATA_PATH}${LOCAL_CONFIG.CONFIG_JSON}?t=${Date.now()}`);
        
        if (!response.ok) return false;
        
        const config = await response.json();
        const newVersion = config.version;
        
        // Si no hay versión guardada o hay nueva versión
        if (!currentVersion || currentVersion !== newVersion) {
            console.log(`🔄 Nueva versión detectada: ${currentVersion || 'ninguna'} → ${newVersion}`);
            
            // Guardar nueva versión
            localStorage.setItem(LOCAL_CONFIG.VERSION_KEY, newVersion);
            
            // Guardar información de la versión
            localStorage.setItem('app_version_info', JSON.stringify({
                version: newVersion,
                version_code: config.version_code,
                last_updated: config.last_updated,
                updated_at: new Date().toISOString()
            }));
            
            // Notificar al Service Worker
            notifyServiceWorkerUpdate(newVersion);
            
            return true;
        }
        
        return false;
    } catch (error) {
        console.warn('❌ Error verificando actualizaciones:', error);
        return false;
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

// Verificar actualizaciones periódicamente
function startUpdateChecker() {
    // Verificar inmediatamente al cargar
    setTimeout(() => checkForUpdates(), 5000);
    
    // Verificar periódicamente
    setInterval(checkForUpdates, LOCAL_CONFIG.CHECK_INTERVAL);
    
    // Verificar cuando la app vuelve a estar online
    window.addEventListener('online', () => {
        setTimeout(checkForUpdates, 2000);
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