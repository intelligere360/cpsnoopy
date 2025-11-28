// notifications-helper.js - Para catálogo público
// FUNCIONES QUE SÍ SE USAN:

/**
 * Registra consulta cuando usuario hace clic en WhatsApp/Llamar
 * SE LLAMA EN: configurarTrackingContacto() en app.js
 */
async function registerProductConsult(producto, tipoContacto) {
    const usuario = obtenerDatosUsuario();
    
    const notificationData = {
        timestamp: new Date().toISOString(),
        tipo: tipoContacto,
        usuario: usuario,
        producto: {
            id: producto.id,
            nombre: producto.nombre,
            precioMin: producto.precioMin,
            precioMax: producto.precioMax,
            categoria: producto.categoria
        }
    };

    try {
        // Usar el sistema existente de email
        await enviarNotificacionProveedor(notificationData);
        
        // Incrementar contador local
        incrementarContadorLocal(producto.id);
        
        console.log('✅ Consulta registrada:', producto.nombre);
        return { success: true };
        
    } catch (error) {
        console.error('Error registrando consulta:', error);
        guardarConsultaEnCola(notificationData);
        return { success: false, error: error.message };
    }
}

/**
 * Obtiene total de consultas para mostrar en UI
 * SE LLAMA EN: mostrarProductos() en app.js
 */
function getTotalConsultas(producto) {
    const contadoresLocales = JSON.parse(localStorage.getItem('consultas_locales') || '{}');
    const consultasLocales = contadoresLocales[producto.id] || 0;
    const consultasJson = producto.consultas || 0;
    
    return consultasJson + consultasLocales;
}

/**
 * Muestra badges rojos con consultas nuevas
 * SE LLAMA EN: 
 * - mostrarProductos() (con setTimeout)
 * - cargarProductos() 
 * - DOMContentLoaded
 */
function actualizarBadgesConsultas() {
    const productCards = document.querySelectorAll('.product-card');
    
    productCards.forEach(card => {
        const productId = card.getAttribute('data-product-id');
        const contadoresLocales = JSON.parse(localStorage.getItem('consultas_locales') || '{}');
        const consultasLocales = contadoresLocales[productId] || 0;
        
        // Remover badge existente
        const existingBadge = card.querySelector('.consultas-local-badge');
        if (existingBadge) {
            existingBadge.remove();
        }
        
        // Agregar badge si hay consultas locales
        if (consultasLocales > 0) {
            const badge = document.createElement('div');
            badge.className = 'consultas-local-badge';
            badge.textContent = `+${consultasLocales} consultas nuevas`;
            badge.style.cssText = `
                position: absolute;
                top: 10px;
                right: 10px;
                background: #e74c3c;
                color: white;
                padding: 4px 8px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: bold;
                z-index: 10;
            `;
            card.querySelector('.product-image-container').appendChild(badge);
        }
    });
}

// FUNCIONES INTERNAS (no se llaman directamente):

/**
 * Incrementa contador local (INTERNA - solo la usa registerProductConsult)
 */
function incrementarContadorLocal(productoId) {
    let contadores = JSON.parse(localStorage.getItem('consultas_locales') || '{}');
    contadores[productoId] = (contadores[productoId] || 0) + 1;
    localStorage.setItem('consultas_locales', JSON.stringify(contadores));
}

/**
 * Guarda consulta en cola offline (INTERNA)
 */
function guardarConsultaEnCola(notificationData) {
    let cola = JSON.parse(localStorage.getItem('consultas_pendientes') || '[]');
    cola.push({
        ...notificationData,
        intentos: 0,
        fechaCreacion: new Date().toISOString()
    });
    localStorage.setItem('consultas_pendientes', JSON.stringify(cola));
}

/**
 * Procesa consultas pendientes (AUTOMÁTICA - con event listener)
 */
async function procesarConsultasPendientes() {
    if (!navigator.onLine) return;
    
    let cola = JSON.parse(localStorage.getItem('consultas_pendientes') || '[]');
    if (cola.length === 0) return;

    console.log('🔄 Procesando', cola.length, 'consultas pendientes...');
    
    const pendientes = [];
    
    for (let i = 0; i < cola.length; i++) {
        const item = cola[i];
        if (item.intentos < 3) {
            try {
                await enviarNotificacionProveedor(item);
                console.log('✅ Consulta pendiente enviada');
            } catch (error) {
                item.intentos++;
                pendientes.push(item);
            }
        }
    }
    
    localStorage.setItem('consultas_pendientes', JSON.stringify(pendientes));
}

// CONFIGURACIÓN AUTOMÁTICA:
// Estas se ejecutan solas, no necesitas llamarlas

// Procesar consultas pendientes cuando hay conexión
window.addEventListener('online', procesarConsultasPendientes);

// Actualizar badges cuando la página carga
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(actualizarBadgesConsultas, 2000);
});