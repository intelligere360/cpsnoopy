// drive-config.js - Para sistema dinámico

const GOOGLE_DRIVE_CONFIG = {
    // AQUÍ TU API KEY
    //API_KEY : "...",

    // ID de la carpeta donde tienes las imágenes
    FOLDER_ID: '16YT-X9Bew6QejnQQY3SZH-Bjah5cJGlY', // ← Este es el ID del JSON, ajusta si es diferente

    // ID del archivo JSON de productos
    PRODUCTS_JSON_ID: '16dIrjnuDWYU6HbF8-4UVOnWT-X3HS8b6',

    // 🔗 URL del JSON principal
    // https://drive.google.com/file/d/16dIrjnuDWYU6HbF8-4UVOnWT-X3HS8b6/view?usp=drive_link
    // https://drive.google.com/file/d/16dIrjnuDWYU6HbF8-4UVOnWT-X3HS8b6/view?usp=sharing
    productsJsonUrl: 'https://drive.google.com/uc?export=download&id=16dIrjnuDWYU6HbF8-4UVOnWT-X3HS8b6',
    
    // 🔗 NUEVO: URL del JSON de configuración 
    CONFIG_JSON_ID: '1lE5srirGH7SQeAz6SqGj2GINB4r37peG',

    // 🖼️ Nueva Base URL que SI funciona para embedding
    baseImageUrl: 'https://drive.google.com/uc?export=view&id=', //'https://lh3.googleusercontent.com/d/',
    
    // ⚙️ Configuración
    cacheDuration: 30 * 60 * 1000,
    retryAttempts: 3
};

/**
 * Obtiene la API Key de forma segura
 */
function getApiKey() {
    // 1. Intentar desde variable de entorno (si existe)
    if (typeof process !== 'undefined' && process.env.GOOGLE_API_KEY) {
        return process.env.GOOGLE_API_KEY;
    }
    
    // 2. Intentar desde meta tag en HTML (más seguro)
    const metaTag = document.querySelector('meta[name="google-api-key"]');
    if (metaTag) {
        return metaTag.getAttribute('content');
    }
    
    // 3. Devolver clave pública de solo lectura (si configuraste una)
    return null; // O una clave específica para solo lectura
}

/**
 * Genera URL para imagen usando Google Drive API
 */
function buildImageUrl(fileId) {
    if (!fileId || fileId === 'undefined') {
        return './images/placeholder.jpg';
    }
    
    const cleanId = fileId.trim();
    const apiKey = getApiKey();
    
    // ✅ URL usando Google Drive API (más confiable)
    return `https://www.googleapis.com/drive/v3/files/${cleanId}?alt=media&key=${apiKey}`;
}

/**
 * Obtiene el JSON de productos usando Google Drive API
 */
async function getProductsJson() {
    try {
        const fileId = GOOGLE_DRIVE_CONFIG.PRODUCTS_JSON_ID;
        const apiKey = getApiKey();
        
        // URL para descargar archivo
        const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`;
        
        console.log('📥 Descargando JSON vía Google Drive API...');
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Error API: ${response.status} ${response.statusText}`);
        }
        
        return await response.json();
        
    } catch (error) {
        console.error('❌ Error con Google Drive API:', error);
        
        // Fallback al método antiguo
        console.log('🔄 Usando método alternativo...');
        const fallbackUrl = `https://drive.google.com/uc?export=download&id=${GOOGLE_DRIVE_CONFIG.PRODUCTS_JSON_ID}`;
        const response = await fetch(fallbackUrl);
        return await response.json();
    }
}

/**
 * NUEVO: Obtiene la URL del JSON de configuración
 */
async function getConfigJson() {
    try {
        const fileId = GOOGLE_DRIVE_CONFIG.CONFIG_JSON_ID;
        const apiKey = getApiKey();
        
        // URL para descargar archivo
        const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`;
        
        console.log('📥 Descargando JSON de Configuración vía Google Drive API...');
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Error API: ${response.status} ${response.statusText}`);
        }
        
        return await response.json();
        
    } catch (error) {
        console.error('❌ Error con Google Drive API:', error);
        
        // Fallback al método antiguo
        console.log('🔄 Usando método alternativo...');
        const fallbackUrl = `https://drive.google.com/uc?export=download&id=${GOOGLE_DRIVE_CONFIG.CONFIG_JSON_ID}`;
        const response = await fetch(fallbackUrl);
        return await response.json();
    }
}
