// version-manager.js
class VersionManager {
    constructor() {
        this.currentVersion = null;
        this.updateListeners = [];
    }
    
    // Verificar actualizaciones
    async checkUpdate() {
        try {
            const response = await fetch('./data/config.json?t=' + Date.now());
            const config = await response.json();
            const newVersion = config.version;
            
            const storedVersion = localStorage.getItem('app_version');
            
            if (storedVersion !== newVersion) {
                this.currentVersion = newVersion;
                localStorage.setItem('app_version', newVersion);
                localStorage.setItem('app_last_check', Date.now());
                
                this.notifyUpdate(newVersion, storedVersion);
                return {
                    hasUpdate: true,
                    oldVersion: storedVersion,
                    newVersion: newVersion,
                    forceUpdate: config.force_update || false
                };
            }
            
            return { hasUpdate: false };
        } catch (error) {
            console.error('Error checking version:', error);
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