// version-manager.js - CPSNOOPY
class VersionManager {
    constructor(siteIdentifier = 'app_default') {
        this.siteIdentifier = siteIdentifier;
        this.currentVersion = null;
        this.updateListeners = [];
        
        // Usar claves específicas por sitio
        this.STORAGE_KEYS = {
            VERSION: `${siteIdentifier}_version`,
            LAST_CHECK: `${siteIdentifier}_last_check`,
            NOTIFIED: (version) => `${siteIdentifier}_notified_${version}`
        };
        // limpiar versiones cruzadas
        this.cleanupOldKeys();
    }
    
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
            
            if (!config || typeof config !== 'object' || !config.version) {
                console.error('❌ config.json inválido o sin versión');
                return { hasUpdate: false, error: 'Config inválido' };
            }
            
            const newVersion = config.version.toString().trim();
            const storedVersion = localStorage.getItem(this.STORAGE_KEYS.VERSION) || '';
            
            console.log(`🔍 [${this.siteIdentifier}] Versión almacenada: "${storedVersion}", Nueva: "${newVersion}"`);
            
            if (storedVersion && storedVersion === newVersion) {
                console.log(`✅ [${this.siteIdentifier}] Versión actual`);
                return { hasUpdate: false };
            }
            
            if (!storedVersion || storedVersion !== newVersion) {
                console.log(`🔄 [${this.siteIdentifier}] Cambio: "${storedVersion}" → "${newVersion}"`);
                
                // Guardar con clave específica del sitio
                localStorage.setItem(this.STORAGE_KEYS.VERSION, newVersion);
                localStorage.setItem(this.STORAGE_KEYS.LAST_CHECK, Date.now());
                
                const alreadyNotified = localStorage.getItem(this.STORAGE_KEYS.NOTIFIED(newVersion));
                if (!alreadyNotified) {
                    this.notifyUpdate(newVersion, storedVersion);
                    localStorage.setItem(this.STORAGE_KEYS.NOTIFIED(newVersion), 'true');
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
            console.error(`❌ [${this.siteIdentifier}] Error:`, error);
            return { hasUpdate: false, error: error.message };
        }
    }
    
    notifyUpdate(newVersion, oldVersion) {
        this.updateListeners.forEach(listener => {
            listener(newVersion, oldVersion);
        });
        
        this.showUpdateNotification(newVersion);
    }
    
    showUpdateNotification(version) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`${this.siteIdentifier} - Nueva versión`, {
                body: `Actualizado a versión ${version}`,
                icon: './images/icon-192.png'
            });
        }
        
        mostrarNotificacion(`🔄 [${this.siteIdentifier}] Nueva versión ${version}. Recargando...`, 'info');
        
        setTimeout(() => {
            window.location.reload();
        }, 3000);
    }
    
    onUpdate(listener) {
        this.updateListeners.push(listener);
    }
    
    startPeriodicCheck(interval = 3600000) {
        this.checkUpdate();
        setInterval(() => this.checkUpdate(), interval);
        
        window.addEventListener('online', () => {
            setTimeout(() => this.checkUpdate(), 5000);
        });
    }

    cleanupOldKeys() {
        // Eliminar claves genéricas antiguas que puedan causar conflicto
        const oldKeys = ['app_version', 'app_last_check'];
        oldKeys.forEach(key => {
            if (localStorage.getItem(key)) {
                localStorage.removeItem(key);
                console.log(`🧹 Eliminada clave antigua: ${key}`);
            }
        });
        
        // Eliminar notificaciones antiguas con patrón 'notified_'
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('notified_')) {
                localStorage.removeItem(key);
            }
        });
    }
}

// Al final de version-manager.js para cpmultineno
window.versionManager = new VersionManager('cpsnoopy');