// drive-config.js - Para sistema dinámico
const GOOGLE_DRIVE_CONFIG = {
    // 🔗 URL del JSON principal
    // https://drive.google.com/file/d/16dIrjnuDWYU6HbF8-4UVOnWT-X3HS8b6/view?usp=drive_link
    // https://drive.google.com/file/d/16dIrjnuDWYU6HbF8-4UVOnWT-X3HS8b6/view?usp=sharing
    productsJsonUrl: 'https://drive.google.com/uc?export=download&id=16dIrjnuDWYU6HbF8-4UVOnWT-X3HS8b6',
    
    // 🔗 NUEVO: URL del JSON de configuración
    configJsonUrl: 'https://drive.google.com/uc?export=download&id=1lE5srirGH7SQeAz6SqGj2GINB4r37peG',

    // 🖼️ Nueva Base URL que SI funciona para embedding
    baseImageUrl: 'https://drive.google.com/uc?export=view&id=', //'https://lh3.googleusercontent.com/d/',
    
    // ⚙️ Configuración
    cacheDuration: 30 * 60 * 1000,
    retryAttempts: 3
};

/**
 * Construye URL para imagen usando ID de Google Drive
 * ESTA VERSIÓN SÍ FUNCIONA para mostrar imágenes en la web
 */
function buildImageUrl(fileId) {
    if (!fileId || fileId === 'undefined' || fileId.includes('undefined')) {
        console.warn('❌ fileId inválido para imagen:', fileId);
        return './images/placeholder.jpg';
    }
    
    // Limpiar el fileId
    const cleanFileId = fileId.trim();
    
    // ✅ URL ORIGINAL de Google Drive
    const originalUrl = `${GOOGLE_DRIVE_CONFIG.baseImageUrl}${cleanFileId}`;
    
    // ✅ USAR PROXY PARA IMÁGENES TAMBIÉN (probar tambien con: https://corsproxy.io/?) 
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(originalUrl)}`;
    
    console.log(`🖼️ URL con proxy: ${cleanFileId} -> ${proxyUrl}`);
    return proxyUrl;
}

/**
 * Obtiene la URL del JSON
 */
function getProductsJsonUrl() {
    const jsonUrl = GOOGLE_DRIVE_CONFIG.productsJsonUrl;
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(jsonUrl)}`;
    return proxyUrl;
}

/**
 * NUEVO: Obtiene la URL del JSON de configuración
 */
function getConfigJsonUrl() {
    const jsonUrl = GOOGLE_DRIVE_CONFIG.configJsonUrl;
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(jsonUrl)}`;
    return proxyUrl;
}