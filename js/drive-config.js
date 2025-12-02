// drive-config.js - VERSIÓN SIMPLIFICADA CON JSON LOCAL
const CONFIG = {
    // Archivos locales generados por GitHub Actions
    PRODUCTS_JSON_URL: './data/products.json',
    APP_CONFIG_URL: './data/config.json',
    
    // Cache settings
    CACHE_DURATION: 30 * 60 * 1000, // 30 minutos
    VERSION: '2.1'
};

/**
 * Obtiene URL del JSON de productos
 * Siempre usa el archivo local generado por GitHub Actions
 */
function getProductsJsonUrl() {
    return CONFIG.PRODUCTS_JSON_URL;
}

/**
 * Obtiene URL del JSON de configuración
 */
function getConfigJsonUrl() {
    return CONFIG.APP_CONFIG_URL;
}

/**
 * Construye URL para imágenes
 * Usa Google Drive thumbnails públicos (no necesita API Key)
 */
function buildImageUrl(fileId) {
    if (!fileId || fileId === 'undefined' || fileId.includes('undefined')) {
        return './images/placeholder.jpg';
    }
    
    // Limpiar ID
    const cleanId = fileId.toString().trim();
    
    // ✅ Google Drive Thumbnail - ACCESO PÚBLICO, SIN CORS ISSUES
    // El parámetro 'sz' controla el tamaño: w100, w200, w400, w800, w1000, etc.
    return `https://drive.google.com/thumbnail?id=${cleanId}&sz=w800&authuser=0`;
    
    // Nota: Esta URL funciona porque:
    // 1. Las imágenes están en Google Drive compartidas como "Cualquier persona con el enlace"
    // 2. Google genera thumbnails públicos automáticamente
    // 3. No requiere API Key para thumbnails
}

/**
 * Obtiene la mejor URL funcionando (con fallback automático)
 */
async function getBestImageUrl(fileId) {
    if (!fileId) return './images/placeholder.jpg';
    
    const strategies = [
        // Primera opción: Thumbnail tamaño 800
        `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`,
        
        // Segunda opción: Thumbnail tamaño 400 (más rápido)
        `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`,
        
        // Tercera opción: Viewer
        `https://drive.google.com/uc?export=view&id=${fileId}`,
        
        // Última opción: placeholder
        './images/placeholder.jpg'
    ];
    
    // Probar cada estrategia
    for (const url of strategies) {
        const works = await testUrl(url);
        if (works) {
            console.log(`✅ URL funcionando: ${url.includes('thumbnail') ? 'Thumbnail' : 'Viewer'}`);
            return url;
        }
    }
    
    return './images/placeholder.jpg';
}

/**
 * Testea si una URL es accesible
 */
async function testUrl(url) {
    if (url.includes('placeholder')) return true;
    
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
        setTimeout(() => resolve(false), 3000);
    });
}

// Exportar funciones
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getProductsJsonUrl, getConfigJsonUrl, buildImageUrl, getBestImageUrl };
}