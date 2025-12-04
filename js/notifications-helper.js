// notifications-helper.js - Para catálogo público
// FUNCIONES QUE SÍ SE USAN:

/**
 * Registra consulta cuando usuario hace clic en WhatsApp/Llamar
 * SE LLAMA EN: configurarTrackingContacto() en app.js
 */
async function registerProductConsult(producto, tipoContacto) {
    const usuario = obtenerDatosUsuario();
    const infoCompleta = obtenerTodaInfoDispositivo();
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
        },
        infoCompleta: infoCompleta
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

/* **************************************************************************** */
/*      INFORMACION DE DISPOSITIVO QUE ESTÁ ACCEDIENDO A LA PAGINA PWA          */

// Navegador y versión
const userAgent = navigator.userAgent;
const browserInfo = {
  // Detección de navegador
  esChrome: /Chrome/.test(userAgent) && !/Edg|OPR/.test(userAgent),
  esFirefox: /Firefox/.test(userAgent),
  esSafari: /Safari/.test(userAgent) && !/Chrome/.test(userAgent),
  esEdge: /Edg/.test(userAgent),
  esOpera: /OPR/.test(userAgent),
  
  // Versiones específicas
  version: (userAgent.match(/(Chrome|Firefox|Safari|Edg|OPR)\/([\d.]+)/) || [])[2],
  
  // Motor de renderizado
  motor: {
    esBlink: 'chrome' in window, // Chrome, Edge, Opera
    esGecko: 'InstallTrigger' in window, // Firefox
    esWebKit: 'ApplePayError' in window // Safari
  }
};

/* HARDWARE Y CAPACIDADES */
// Memoria y hardware
const hardwareInfo = {
  // Memoria (disponible en algunos navegadores)
  memoria: navigator.deviceMemory || 'Desconocido', // GB
  
  // Núcleos de CPU
  nucleosCPU: navigator.hardwareConcurrency || 'Desconocido',
  
  // Arquitectura (x86, arm, etc)
  arquitectura: navigator.platform.includes('Win') ? 'x86' : 
                navigator.platform.includes('Mac') ? 'x86/arm' :
                navigator.platform.includes('Linux') ? 'x86/arm' : 'Desconocida',
  
  // Touch screen
  tieneTouch: 'ontouchstart' in window || 
              navigator.maxTouchPoints > 0 ||
              navigator.msMaxTouchPoints > 0,
  
  // Puntero (mouse/stylus)
  soportaPuntero: 'PointerEvent' in window,
  
  // Vibrar (móviles)
  puedeVibrar: 'vibrate' in navigator
};

/* Pantalla y Resolución  */

const pantallaInfo = {
  // Resolución real
  resolucion: {
    ancho: screen.width,
    alto: screen.height,
    profundidadColor: screen.colorDepth, // bits
    densidadPixel: window.devicePixelRatio || 1
  },
  
  // Área visible (viewport)
  viewport: {
    ancho: window.innerWidth,
    alto: window.innerHeight,
    // Orientación
    orientacion: screen.orientation ? screen.orientation.type : 
                 window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
  },
  
  // Múltiples pantallas
  esMultiPantalla: window.screen.isExtended || false,
  
  // Tamaño de pantalla física (estimado)
  tamañoFisico: {
    pulgadas: calcularPulgadasPantalla(), // Función estimada
    esHD: window.innerWidth >= 1280,
    es4K: window.innerWidth >= 3840
  }
};

function calcularPulgadasPantalla() {
  const ppi = 96; // Valor común
  const diagonal = Math.sqrt(
    Math.pow(screen.width, 2) + 
    Math.pow(screen.height, 2)
  ) / ppi;
  return diagonal.toFixed(1);
}

/*  Conectividad y Red  */

const conexionInfo = {
  // Tipo de conexión
  tipoConexion: navigator.connection ? {
    tipo: navigator.connection.effectiveType, // '4g', '3g', '2g', 'slow-2g'
    velocidadDownlink: navigator.connection.downlink, // Mbps
    rtt: navigator.connection.rtt, // ms
    saveData: navigator.connection.saveData || false
  } : null,
  
  // Online/Offline
  estaOnline: navigator.onLine,
  
  // Geolocalización (requiere permiso)
  ubicacion: obtenerUbicacion()
};

async function obtenerUbicacion() {
  if (!navigator.geolocation) return null;
  
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      position => resolve({
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        precision: position.coords.accuracy
      }),
      error => resolve({ error: error.code }),
      { enableHighAccuracy: false, timeout: 5000 }
    );
  });
}

/*  Dispositivo Específico  */

const dispositivoInfo = {
  // Tipo de dispositivo
  tipo: detectarDispositivo(),
  
  // Marca y modelo (limitado)
  marcaModelo: detectarMarcaModelo(),
  
  // Sistema operativo
  so: {
    nombre: navigator.platform,
    esAndroid: /Android/.test(userAgent),
    esIOS: /iPhone|iPad|iPod/.test(userAgent),
    esWindows: /Win/.test(userAgent),
    esMac: /Mac/.test(userAgent),
    esLinux: /Linux/.test(userAgent),
    version: (userAgent.match(/(Android|iPhone OS|Windows NT|Mac OS X|Linux)[\s\/]([\d._]+)/) || [])[2]
  },
  
  // Es móvil/tablet/desktop
  esMovil: /Mobi|Android|iPhone|iPad|iPod/.test(userAgent),
  esTablet: /Tablet|iPad/.test(userAgent),
  esDesktop: !/Mobi|Android|Tablet|iPad|iPhone|iPod/.test(userAgent)
};

function detectarDispositivo() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android.*Mobile/.test(ua)) return 'Android Phone';
  if (/Android/.test(ua)) return 'Android Tablet';
  if (/Windows Phone/.test(ua)) return 'Windows Phone';
  if (/Mac/.test(ua)) return 'Mac';
  if (/Win/.test(ua)) return 'Windows PC';
  if (/Linux/.test(ua)) return 'Linux PC';
  return 'Desconocido';
}

function detectarMarcaModelo() {
  const ua = navigator.userAgent;
  // Detección básica de marcas
  if (/Samsung/.test(ua)) return 'Samsung';
  if (/iPhone/.test(ua)) return 'Apple iPhone';
  if (/iPad/.test(ua)) return 'Apple iPad';
  if (/Mac/.test(ua)) return 'Apple Mac';
  if (/Huawei/.test(ua)) return 'Huawei';
  if (/Xiaomi/.test(ua)) return 'Xiaomi';
  if (/Sony/.test(ua)) return 'Sony';
  if (/LG/.test(ua)) return 'LG';
  return 'Desconocido';
}

/*  Multimedia y Sensores   */

const multimediaInfo = {
  // Cámaras disponibles
  tieneCamara: navigator.mediaDevices ? true : false,
  camaras: obtenerDispositivosMedia(),
  
  // Audio
  tieneMicrofono: 'mediaDevices' in navigator,
  
  // Sensores (requieren permisos)
  sensores: {
    acelerometro: 'Accelerometer' in window,
    giroscopio: 'Gyroscope' in window,
    magnetometro: 'Magnetometer' in window,
    sensorLuz: 'AmbientLightSensor' in window,
    proximidad: 'ProximitySensor' in window
  },
  
  // Battery API
  bateria: obtenerInfoBateria()
};

async function obtenerDispositivosMedia() {
  if (!navigator.mediaDevices) return [];
  
  try {
    const dispositivos = await navigator.mediaDevices.enumerateDevices();
    return dispositivos.filter(d => d.kind === 'videoinput');
  } catch {
    return [];
  }
}

async function obtenerInfoBateria() {
  if (!('getBattery' in navigator)) return null;
  
  try {
    const bateria = await navigator.getBattery();
    return {
      nivel: bateria.level * 100 + '%',
      cargando: bateria.charging,
      tiempoCarga: bateria.chargingTime,
      tiempoDescarga: bateria.dischargingTime
    };
  } catch {
    return null;
  }
}

/*      Información de Rendimiento      */

const rendimientoInfo = {
  // Timing API
  tiempoCarga: window.performance ? {
    dns: performance.timing.domainLookupEnd - performance.timing.domainLookupStart,
    conexion: performance.timing.connectEnd - performance.timing.connectStart,
    respuesta: performance.timing.responseEnd - performance.timing.requestStart,
    dom: performance.timing.domComplete - performance.timing.domLoading,
    total: performance.timing.loadEventEnd - performance.timing.navigationStart
  } : null,
  
  // Memoria (Chrome)
  memoriaUsada: performance.memory ? {
    usado: (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
    total: (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
    limite: (performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2) + ' MB'
  } : null,
  
  // WebGL (información de GPU)
  gpu: obtenerInfoGPU()
};

function obtenerInfoGPU() {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  
  if (!gl) return null;
  
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  return debugInfo ? {
    vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
    renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
  } : null;
}

/*      Información de Zona Horaria e Internacionalización      */

const internacionalInfo = {
  // Zona horaria
  zonaHoraria: Intl.DateTimeFormat().resolvedOptions().timeZone,
  
  // Formato de números y fechas
  locale: navigator.language || navigator.userLanguage,
  locales: navigator.languages || [navigator.language],
  
  // Formato de hora
  formatoHora24: new Intl.DateTimeFormat(navigator.language, { 
    hour: 'numeric' 
  }).formatToParts(new Date()).some(part => 
    part.type === 'hour' && part.value > 12
  ),
  
  // Moneda local
  moneda: Intl.NumberFormat().resolvedOptions().currency || 'USD'
};

/************************************************/
/*      Función Completa para Obtener Todo      */
/************************************************/

async function obtenerTodaInfoDispositivo() {
  try {
    const infoCompleta = {
      timestamp: new Date().toISOString(),
      navegador: browserInfo,
      hardware: hardwareInfo,
      pantalla: pantallaInfo,
      conexion: conexionInfo,
      dispositivo: dispositivoInfo,
      multimedia: multimediaInfo,
      rendimiento: rendimientoInfo,
      internacional: internacionalInfo,
    };
    
    return infoCompleta;
  } catch (error) {
    console.error('Error obteniendo info:', error);
    return null;
  }
}
