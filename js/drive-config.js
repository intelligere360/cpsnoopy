// drive-config.js - CON TU API KEY
const GOOGLE_DRIVE_CONFIG = {
    // ⚠️ PEGA AQUÍ TU API KEY
    API_KEY: 'AIzaSyDH1r6ZLmj64KRr-YUe9GiVszRyMbd4Cfs',
    
    // ID de la carpeta donde tienes las imágenes
    FOLDER_ID: '16dIrjnuDWYU6HbF8-4UVOnWT-X3HS8b6', // ← Este es el ID del JSON, ajusta si es diferente
    
    // ID del archivo JSON de productos
    PRODUCTS_JSON_ID: '16dIrjnuDWYU6HbF8-4UVOnWT-X3HS8b6',

    // ID del archivo JSON de configuracion
    CONFIG_JSON_ID: '1lE5srirGH7SQeAz6SqGj2GINB4r37peG'
};

/**
 * Obtiene el JSON de productos o configuracion usando Google Drive API
 */
async function getJson(fileId) {
    try {
        const apiKey = GOOGLE_DRIVE_CONFIG.API_KEY;
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
        const fallbackUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        const response = await fetch(fallbackUrl);
        return await response.json();
    }
}

/**
 * Genera URL para imagen usando Google Drive API
 */
function buildImageUrl(fileId) {
    if (!fileId || fileId === 'undefined') {
        return './images/placeholder.jpg';
    }
    
    const cleanId = fileId.trim();
    const apiKey = GOOGLE_DRIVE_CONFIG.API_KEY;
    
    // ✅ URL usando Google Drive API (más confiable)
    return `https://www.googleapis.com/drive/v3/files/${cleanId}?alt=media&key=${apiKey}`;
}