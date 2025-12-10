// local-config.js
const LOCAL_CONFIG = {
    // Configuración de rutas locales
    BASE_URL: window.location.origin,
    DATA_PATH: './data/',
    IMAGES_PATH: './data/productos/',
    
    // Archivos JSON
    PRODUCTS_JSON: 'productos.json',
    CONFIG_JSON: 'config.json'
};

// Función para construir URL de imagen local
function buildLocalImageUrl(imageName) {
    if (!imageName) return './images/placeholder.jpg';
    
    // Limpiar nombre de archivo
    const cleanName = imageName.replace(/[^\w\s.-]/g, '');
    
    // Construir URL completa
    return `${LOCAL_CONFIG.IMAGES_PATH}${cleanName}`;
}

// Función para obtener JSON local
async function getLocalJson(filename) {
    try {
        const response = await fetch(`${LOCAL_CONFIG.DATA_PATH}${filename}`);
        if (!response.ok) throw new Error(`Error ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error(`❌ Error cargando ${filename}:`, error);
        return null;
    }
}