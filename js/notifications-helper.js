// notifications-helper.js - Para catálogo público
// FUNCIONES QUE SÍ SE USAN:

globalThis.infoCompleta = null;

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
        },
        infoCompleta: globalThis.infoCompleta
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
const infoDetallada = (userAgent) => {
  const b = {
    esChrome: /Chrome/.test(userAgent) && !/Edg|OPR/.test(userAgent),
    esFirefox: /Firefox/.test(userAgent),
    esSafari: /Safari/.test(userAgent) && !/Chrome/.test(userAgent),
    esEdge: /Edg/.test(userAgent),
    esOpera: /OPR/.test(userAgent),
    version: (userAgent.match(/(Chrome|Firefox|Safari|Edg|OPR)\/([\d.]+)/) || [])[2]
  };
  
  const navegador = Object.entries(b).slice(0,5).find(([_,v]) => v)?.[0]?.replace('es','') || 'Desconocido';
  
  return `${navegador}${b.version ? ` ${b.version}` : ''}`;
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

const infoPantallaDetallada = () => {
  const pantallaInfo = {
    resolucion: {
      ancho: screen.width,
      alto: screen.height,
      profundidadColor: screen.colorDepth,
      densidadPixel: window.devicePixelRatio || 1
    },
    viewport: {
      ancho: window.innerWidth,
      alto: window.innerHeight,
      orientacion: screen.orientation ? screen.orientation.type : 
                   window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
    },
    esMultiPantalla: window.screen.isExtended || false,
    tamañoFisico: {
      esHD: window.innerWidth >= 1280,
      es4K: window.innerWidth >= 3840
    }
  };

  const r = pantallaInfo.resolucion;
  const v = pantallaInfo.viewport;
  const t = pantallaInfo.tamañoFisico;

  // Calcular resolución real considerando densidad de píxeles
  const resolucionReal = `${Math.round(r.ancho * r.densidadPixel)}×${Math.round(r.alto * r.densidadPixel)}`;
  
  // Determinar calidad de pantalla
  const calidad = t.es4K ? '4K' : t.esHD ? 'Full HD' : 'SD';
  
  // Icono de orientación
  const iconoOrientacion = v.orientacion.includes('landscape') ? '↔' : '↕';

  return `📱 Pantalla: ${r.ancho}×${r.alto} (${resolucionReal} real) | Viewport: ${v.ancho}×${v.alto} ${iconoOrientacion} | Densidad: ${r.densidadPixel}x | Color: ${r.profundidadColor} bits | Calidad: ${calidad}${pantallaInfo.esMultiPantalla ? ' | 🖥️ Múltiples' : ''}`;
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
const infoConexionCompleta = async () => {
  /*const obtenerUbicacion = () => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          precision: pos.coords.accuracy
        }),
        () => resolve(null),
        { timeout: 3000 }
      );
    });
  };*/

  const conexionInfo = {
    tipoConexion: navigator.connection ? {
      tipo: navigator.connection.effectiveType,
      velocidadDownlink: navigator.connection.downlink,
      rtt: navigator.connection.rtt,
      saveData: navigator.connection.saveData || false
    } : null,
    estaOnline: navigator.onLine,
    //ubicacion: await obtenerUbicacion()
  };

  const c = conexionInfo.tipoConexion;
  
  if (!conexionInfo.estaOnline) {
    return "🔴 OFFLINE - SIN CONEXIÓN";
  }
  
  let resultado = `🟢 ONLINE | CONEXIÓN: ${c?.tipo?.toUpperCase() || 'DESCONOCIDA'} | VELOCIDAD: ${c?.downlink || 'N/A'} MBPS | LATENCIA: ${c?.rtt || 'N/A'} MS`;
  
  if (c?.saveData) resultado += " | MODO AHORRO DATOS: ACTIVADO";
  
  /*if (conexionInfo.ubicacion) {
    resultado += ` | UBICACIÓN: ${conexionInfo.ubicacion.lat.toFixed(4)}°, ${conexionInfo.ubicacion.lon.toFixed(4)}°`;
  }*/
  
  return resultado;
};

/*  Dispositivo Específico  */

const getInfoDispositivoCompleta = () => {
  const ua = navigator.userAgent;
  
  // Funciones de detección
  const getTipo = () => {
    if (/iPhone/.test(ua)) return 'IPHONE';
    if (/iPad/.test(ua)) return 'IPAD';
    if (/Android.*Mobile/.test(ua)) return 'ANDROID PHONE';
    if (/Android/.test(ua)) return 'ANDROID TABLET';
    if (/Windows Phone/.test(ua)) return 'WINDOWS PHONE';
    if (/Mac/.test(ua)) return 'MAC';
    if (/Win/.test(ua)) return 'WINDOWS PC';
    if (/Linux/.test(ua)) return 'LINUX PC';
    return 'DESCONOCIDO';
  };
  
  const getMarca = () => {
    if (/Samsung/.test(ua)) return 'SAMSUNG';
    if (/iPhone/.test(ua)) return 'APPLE';
    if (/iPad/.test(ua)) return 'APPLE';
    if (/Mac/.test(ua)) return 'APPLE';
    if (/Huawei/.test(ua)) return 'HUAWEI';
    if (/Xiaomi/.test(ua)) return 'XIAOMI';
    if (/Sony/.test(ua)) return 'SONY';
    if (/LG/.test(ua)) return 'LG';
    return 'DESCONOCIDO';
  };
  
  const getSO = () => {
    if (/Android/.test(ua)) return 'ANDROID';
    if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
    if (/Win/.test(ua)) return 'WINDOWS';
    if (/Mac/.test(ua)) return 'MAC OS';
    if (/Linux/.test(ua)) return 'LINUX';
    return navigator.platform.toUpperCase();
  };
  
  const getVersionSO = () => {
    const match = ua.match(/(Android|iPhone OS|Windows NT|Mac OS X|Linux)[\s\/]([\d._]+)/);
    return match ? match[2].replace(/_/g, '.').replace(/_/g, '.') : 'N/A';
  };
  
  const esMovil = /Mobi|Android|iPhone|iPad|iPod/.test(ua);
  const esTablet = /Tablet|iPad/.test(ua);
  const esDesktop = !esMovil && !esTablet;
  
  const dispositivo = getTipo();
  const marca = getMarca();
  const so = getSO();
  const version = getVersionSO();
  const categoria = esMovil ? 'MÓVIL' : esTablet ? 'TABLET' : 'DESKTOP';
  
  return `🖥️ CATEGORÍA: ${categoria} | TIPO: ${dispositivo} | MARCA: ${marca} | S.O.: ${so} ${version !== 'N/A' ? version : ''}`;
};

/*  Multimedia y Sensores   */

const getMultimediaDetallada = async () => {
  try {
    // Obtener cámaras
    let camarasCount = 0;
    if (navigator.mediaDevices) {
      const dispositivos = await navigator.mediaDevices.enumerateDevices();
      camarasCount = dispositivos.filter(d => d.kind === 'videoinput').length;
    }
    
    // Sensores
    const sensoresList = [];
    if ('Accelerometer' in window) sensoresList.push('📈 ACELERÓMETRO');
    if ('Gyroscope' in window) sensoresList.push('🔄 GIROSCÓPIO');
    if ('Magnetometer' in window) sensoresList.push('🧭 MAGNETÓMETRO');
    if ('AmbientLightSensor' in window) sensoresList.push('💡 SENSOR LUZ');
    if ('ProximitySensor' in window) sensoresList.push('📏 PROXIMIDAD');
    
    // Batería
    let bateriaStr = '';
    if ('getBattery' in navigator) {
      const bat = await navigator.getBattery();
      const nivel = Math.round(bat.level * 100);
      const icono = bat.charging ? '⚡' : '🔋';
      bateriaStr = ` | ${icono} BATERÍA: ${nivel}%`;
      
      if (bat.chargingTime !== Infinity && bat.chargingTime > 0) {
        bateriaStr += ` (${Math.round(bat.chargingTime / 60)}MIN PARA CARGAR)`;
      }
    }
    
    return `📷 ${camarasCount > 0 ? `${camarasCount} CÁMARA${camarasCount > 1 ? 'S' : ''}` : 'SIN CÁMARAS'} | 🎤 ${'mediaDevices' in navigator ? 'MIC SÍ' : 'MIC NO'}${sensoresList.length > 0 ? ` | ${sensoresList.join(' ')}` : ' | SIN SENSORES'}${bateriaStr}`;
    
  } catch (error) {
    return `⚠️ ERROR OBTENIENDO INFORMACIÓN MULTIMEDIA`;
  }
};

/************************************************/
/*      Función Completa para Obtener Todo      */
/************************************************/

async function obtenerTodaInfoDispositivo() {
    let infoCompleta;
    try {
        infoCompleta = {
            timestamp: new Date().toISOString(),
            navegador: infoDetallada(userAgent),
            hardware: 'RAM:' + hardwareInfo.memoria.toString() + ' GB',
            pantalla: infoPantallaDetallada(),
            conexion: await infoConexionCompleta(),
            dispositivo: getInfoDispositivoCompleta(),
            multimedia: await getMultimediaDetallada()
        };
    } catch (error) {
        console.error('Error obteniendo info:', error);
        infoCompleta = {
            timestamp: new Date().toISOString(),
            navegador: '-',
            hardware: '-',
            pantalla: '-',
            conexion: '-',
            dispositivo: '-',
            multimedia: '-'
        };
    }
    globalThis.infoCompleta = infoCompleta;
}
