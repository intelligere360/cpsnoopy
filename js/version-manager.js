// version-manager.js
class VersionManager {
    constructor() {
        this.currentVersion = null;
        this.updateListeners = [];
    }
    
    // En version-manager.js - VERSIÓN CORREGIDA
    async checkUpdate() {
        try {
            const response = await fetch('./data/config.json?_=' + Date.now(), {
                cache: 'no-store'
            });
            
            if (!response.ok) {
                console.error('❌ No se pudo cargar config.json');
                return { hasUpdate: false, error: 'No se pudo cargar' };
            }
            
            const config = await response.json();
            
            // ✅ VERIFICACIÓN CRÍTICA
            if (!config || typeof config !== 'object' || !config.version) {
                console.error('❌ config.json inválido o sin versión');
                return { hasUpdate: false, error: 'Config inválido' };
            }
            
            const newVersion = config.version.toString().trim();
            const storedVersion = localStorage.getItem('app_version') || '';
            
            console.log(`🔍 Versión almacenada: "${storedVersion}", Nueva: "${newVersion}"`);
            
            // ✅ SOLO NOTIFICAR SI REALMENTE HAY CAMBIO
            if (storedVersion && storedVersion === newVersion) {
                console.log('✅ Versión actual, sin cambios');
                return { hasUpdate: false };
            }
            
            if (!storedVersion || storedVersion !== newVersion) {
                console.log(`🔄 Cambio de versión: "${storedVersion}" → "${newVersion}"`);
                
                // ✅ GUARDAR Y NOTIFICAR
                localStorage.setItem('app_version', newVersion);
                localStorage.setItem('app_last_check', Date.now());
                
                // ✅ PREVENIR NOTIFICACIONES MÚLTIPLES
                const alreadyNotified = localStorage.getItem(`notified_${newVersion}`);
                if (!alreadyNotified) {
                    this.notifyUpdate(newVersion, storedVersion);
                    localStorage.setItem(`notified_${newVersion}`, 'true');
                }
                
                return {
                    hasUpdate: true,
                    oldVersion: storedVersion,
                    newVersion: newVersion,
                    forceUpdate: config.force_update || false
                };
            }
            
            return { hasUpdate: false };
        } catch (error) {
            console.error('❌ Error verificando versión:', error);
            return { hasUpdate: false, error: error.message };
        }
    }
    
    // Notificar a los listeners
    notifyUpdate(newVersion, oldVersion) {
        this.updateListeners.forEach(listener => {
            listener(newVersion, oldVersion);
        });
        
        // Mostrar notificación al usuario
        this.showUpdateNotification(newVersion);
    }
    
    // Mostrar notificación
    showUpdateNotification(version) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Nueva versión disponible', {
                body: `El catálogo se ha actualizado a la versión ${version}`,
                icon: './images/icon-192.png'
            });
        }
        
        // O mostrar notificación en UI
        mostrarNotificacion(`🔄 Nueva versión ${version} disponible. Recargando...`, 'info');
        
        // Recargar después de 3 segundos
        setTimeout(() => {
            window.location.reload();
        }, 3000);
    }
    
    // Agregar listener
    onUpdate(listener) {
        this.updateListeners.push(listener);
    }
    
    // Iniciar verificador periódico
    startPeriodicCheck(interval = 3600000) { // 1 hora por defecto
        // Verificar inmediatamente
        this.checkUpdate();
        
        // Verificar periódicamente
        setInterval(() => this.checkUpdate(), interval);
        
        // Verificar cuando vuelve online
        window.addEventListener('online', () => {
            setTimeout(() => this.checkUpdate(), 5000);
        });
    }
}

// Instancia global
window.versionManager = new VersionManager();