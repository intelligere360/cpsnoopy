function doPost(e) {
  try {
    console.log('📨 Iniciando doPost...');
    
    let data = {};
    
    // Manejar diferentes tipos de datos
    if (e.postData) {
      console.log('Tipo de contenido:', e.postData.type);
      
      if (e.postData.type === 'application/json') {
        // Para JSON directo
        data = JSON.parse(e.postData.contents);
      } else if (e.postData.type === 'application/x-www-form-urlencoded') {
        // Para FormData
        const params = e.postData.contents.split('&');
        for (const param of params) {
          const [key, value] = param.split('=');
          if (key === 'data') {
            data = JSON.parse(decodeURIComponent(value));
            break;
          }
        }
      }
    }
    
    console.log('Datos recibidos:', data);
    
    // ID de tu Google Sheets
    const fileId = '1ZhD6a1t_1tVJz7fQv9DnMmqUTnSEjXwsyjcvh57OMSk'; // ← Tu ID real
    const sheetName = 'Hoja1';
    
    console.log('Abriendo Google Sheets...');
    
    const spreadsheet = SpreadsheetApp.openById(fileId);
    const sheet = spreadsheet.getSheetByName(sheetName);
    
    const lastRowBefore = sheet.getLastRow();
    console.log('Filas antes:', lastRowBefore || 0);
    
    // Preparar nueva fila
    const newRow = [
      data.product_id || '',
      data.product_name || '',
      data.product_category || '',
      data.precioMin || 0,
      data.precioMax || 0,
      new Date().toLocaleDateString('es-ES'),
      new Date().toLocaleTimeString('es-ES'),
      data.contact_type || '',
      data.user_platform || '',
      data.user_agent || '',
      'consulta'
    ];
    
    console.log('Agregando fila:', newRow);
    
    // Agregar fila
    sheet.appendRow(newRow);
    
    const lastRowAfter = sheet.getLastRow();
    console.log('✅ Fila agregada. Total:', lastRowAfter);
    
    // Siempre retornar éxito ya que no-cors no puede leer la respuesta
    return ContentService.createTextOutput('OK');
    
  } catch (error) {
    console.error('❌ Error en doPost:', error.toString());
    // Aún con error, retornar OK para no-cors
    return ContentService.createTextOutput('OK');
  }
}

function doGet(e) {
  console.log('🔍 doGet llamado');
  return ContentService.createTextOutput(JSON.stringify({
    message: 'Servicio activo',
    status: 'online'
  })).setMimeType(ContentService.MimeType.JSON);
}

// Función para verificar estado - COMPATIBLE CON GOOGLE SHEETS
function verificarEstado() {
  try {
    console.log('🔍 Verificando estado de Google Sheets...');
    
    // ⚠️⚠️⚠️ REEMPLAZA CON EL NUEVO ID DE GOOGLE SHEETS ⚠️⚠️⚠️
    const fileId = '1ZhD6a1t_1tVJz7fQv9DnMmqUTnSEjXwsyjcvh57OMSk'; // ← ID DEL GOOGLE SHEETS
    
    console.log('ID del Google Sheets:', fileId);
    
    const spreadsheet = SpreadsheetApp.openById(fileId);
    const sheet = spreadsheet.getSheetByName('Hoja1');
    
    if (!sheet) {
      throw new Error('No se encontró la hoja "Hoja1"');
    }
    
    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();
    
    console.log(`📊 Filas: ${lastRow}, Columnas: ${lastColumn}`);
    
    // Leer encabezados si hay datos
    if (lastRow > 0) {
      const headers = sheet.getRange(1, 1, 1, Math.max(lastColumn, 1)).getValues()[0];
      console.log('📝 Encabezados:', headers);
    } else {
      console.log('📝 El archivo está vacío (solo encabezados)');
    }
    
    // Leer algunas filas de datos
    if (lastRow > 1) {
      const dataRows = Math.min(lastRow, 3);
      const data = sheet.getRange(1, 1, dataRows, Math.max(lastColumn, 1)).getValues();
      console.log('📋 Datos:');
      for (let i = 0; i < data.length; i++) {
        console.log(`Fila ${i + 1}:`, data[i]);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      fileName: spreadsheet.getName(),
      rows: lastRow,
      columns: lastColumn,
      type: 'Google Sheets'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    console.error('❌ Error en verificarEstado:', error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString(),
      message: 'Usa un Google Sheets (no .xlsx) y verifica el ID'
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Función para probar permisos con Google Sheets
function probarPermisos() {
  try {
    console.log('🔐 Probando permisos con Google Sheets...');
    
    // ⚠️⚠️⚠️ REEMPLAZA CON EL NUEVO ID DE GOOGLE SHEETS ⚠️⚠️⚠️
    const fileId = '1ZhD6a1t_1tVJz7fQv9DnMmqUTnSEjXwsyjcvh57OMSk'; // ← ID DEL GOOGLE SHEETS
    
    const spreadsheet = SpreadsheetApp.openById(fileId);
    
    console.log('✅ Permisos OK con Google Sheets');
    console.log('📄 Nombre:', spreadsheet.getName());
    console.log('🔗 URL:', spreadsheet.getUrl());
    console.log('👤 Propietario:', spreadsheet.getOwner().getEmail());
    
    const sheet = spreadsheet.getSheetByName('Hoja1');
    console.log('📋 Hoja activa:', sheet ? sheet.getName() : 'No encontrada');
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      fileName: spreadsheet.getName(),
      owner: spreadsheet.getOwner().getEmail(),
      type: 'Google Sheets'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    console.error('❌ Error de permisos:', error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString(),
      message: 'Verifica que sea un Google Sheets (no .xlsx) y el ID sea correcto'
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Función de prueba manual
function testManual() {
  console.log('🧪 Prueba manual con Google Sheets...');
  
  const mockEvent = {
    postData: {
      type: 'application/json',
      contents: JSON.stringify({
        product_id: 'manual_test_001',
        product_name: 'Producto Prueba Manual',
        product_category: 'Electrónicos',
        precioMin: 99.99,
        precioMax: 149.99,
        contact_type: 'whatsapp',
        user_platform: 'Test Platform',
        user_agent: 'Test Agent'
      })
    }
  };
  
  const result = doPost(mockEvent);
  console.log('Resultado:', result.getContent());
  return result.getContent();
}