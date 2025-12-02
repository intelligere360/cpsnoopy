#!/usr/bin/env python3
"""
Script para sincronizar productos desde Google Drive a JSON local.
Ejecutado automáticamente por GitHub Actions.
"""

import json
import os
import sys
import requests
from datetime import datetime, timezone
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import pytz

def log(message, level="INFO"):
    """Log con timestamp"""
    timestamp = datetime.now().isoformat(sep=' ', timespec='seconds')
    print(f"[{timestamp}] {level}: {message}")

def load_google_drive_api():
    """Conectar a Google Drive API usando API Key"""
    api_key = os.environ.get('GOOGLE_API_KEY')
    
    if not api_key:
        log("No se encontró GOOGLE_API_KEY en variables de entorno", "ERROR")
        return None
    
    try:
        # Usar API Key simple (no requiere OAuth para lectura pública)
        service = build('drive', 'v3', developerKey=api_key)
        log("Google Drive API inicializada correctamente")
        return service
    except Exception as e:
        log(f"Error inicializando Google Drive API: {str(e)}", "ERROR")
        return None

def download_file(service, file_id):
    """Descargar archivo de Google Drive"""
    try:
        log(f"Descargando archivo: {file_id[:20]}...")
        
        # Solicitar el archivo
        request = service.files().get_media(fileId=file_id)
        response = request.execute()
        
        # Decodificar si es texto
        if isinstance(response, bytes):
            content = response.decode('utf-8')
        else:
            content = str(response)
            
        log(f"Archivo descargado: {len(content)} bytes")
        return json.loads(content)
        
    except HttpError as e:
        log(f"Error HTTP descargando archivo: {e.resp.status} {e._get_reason()}", "ERROR")
        return None
    except json.JSONDecodeError as e:
        log(f"Error decodificando JSON: {str(e)}", "ERROR")
        return None
    except Exception as e:
        log(f"Error inesperado: {str(e)}", "ERROR")
        return None

def process_product(product):
    """Procesar un producto individual"""
    processed = product.copy()
    
    # Asegurar campos básicos
    if 'id' not in processed:
        processed['id'] = hash(product.get('nombre', '')) % 1000000
    
    if 'categoria' not in processed:
        processed['categoria'] = 'Sin categoría'
    
    if 'descripcion' not in processed:
        processed['descripcion'] = ''
    
    if 'especificaciones' not in processed:
        processed['especificaciones'] = ''
    
    # Procesar imágenes
    if 'imagenes' in processed and isinstance(processed['imagenes'], list):
        valid_images = []
        for i, img in enumerate(processed['imagenes']):
            if isinstance(img, dict) and 'id' in img:
                # Crear objeto de imagen completo
                image_obj = {
                    'id': img['id'],
                    'nombre': img.get('nombre', f'imagen_{i+1}'),
                    'principal': img.get('principal', i == 0),
                    'orden': img.get('orden', i + 1),
                    # URL pública de Google Drive thumbnail
                    'url': f"https://drive.google.com/thumbnail?id={img['id']}&sz=w800"
                }
                valid_images.append(image_obj)
        
        processed['imagenes'] = valid_images
        
        # Determinar imagen principal
        if valid_images:
            main_img = next((img for img in valid_images if img.get('principal')), valid_images[0])
            processed['imagenPrincipal'] = main_img['url']
        else:
            processed['imagenPrincipal'] = './images/placeholder.jpg'
    else:
        processed['imagenes'] = []
        processed['imagenPrincipal'] = './images/placeholder.jpg'
    
    # Asegurar precios
    if 'precioMin' not in processed:
        processed['precioMin'] = 0
    if 'precioMax' not in processed:
        processed['precioMax'] = processed['precioMin']
    
    # Convertir a float si son strings
    try:
        processed['precioMin'] = float(processed['precioMin'])
        processed['precioMax'] = float(processed['precioMax'])
    except (ValueError, TypeError):
        processed['precioMin'] = 0
        processed['precioMax'] = 0
    
    # Asegurar que precioMax no sea menor que precioMin
    if processed['precioMax'] < processed['precioMin']:
        processed['precioMax'] = processed['precioMin']
    
    return processed

def save_products_json(products, filename='data/products.json'):
    """Guardar productos en formato optimizado para la web"""
    caracas_tz = pytz.timezone('America/Caracas')
    now_caracas = datetime.now(caracas_tz)
    
    data = {
        'metadata': {
            'version': '2.0',
            'lastSynced': now_caracas.isoformat(),
            'lastSyncedReadable': now_caracas.strftime('%d/%m/%Y %H:%M:%S %Z'),
            'timezone': 'America/Caracas',
            'totalProducts': len(products),
            'totalImages': sum(len(p.get('imagenes', [])) for p in products),
            'generatedBy': 'GitHub Actions Sync Script'
        },
        'products': products
    }
    
    # Crear directorio si no existe
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    
    # Guardar con formato legible
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    log(f"JSON guardado: {filename} ({len(products)} productos)")
    return True

def save_config_json(service, file_id, filename='data/config.json'):
    """Descargar y guardar configuración"""
    config_data = download_file(service, file_id)
    
    if config_data and isinstance(config_data, list) and len(config_data) > 0:
        config = config_data[0] if isinstance(config_data[0], dict) else {}
        
        # Asegurar campos básicos
        default_config = {
            'mostrar_precios': False,
            'version': '1.0',
            'idioma': 'es',
            'contacto': {
                'telefono': '+584126597297',
                'whatsapp': '584126597297',
                'email': 'ramonsimancas61@gmail.com',
                'vendedor': 'Peter Snoopy: DE TODO UN POCO'
            }
        }
        
        # Combinar con defaults
        merged_config = {**default_config, **config}
        
        # Guardar
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(merged_config, f, ensure_ascii=False, indent=2)
        
        log(f"Configuración guardada: {filename}")
        return True
    
    return False

def main():
    """Función principal"""
    log("🚀 Iniciando sincronización de productos")
    
    # IDs de archivos
    PRODUCTS_JSON_ID = os.environ.get('PRODUCTS_JSON_ID', '16dIrjnuDWYU6HbF8-4UVOnWT-X3HS8b6')
    CONFIG_JSON_ID = os.environ.get('CONFIG_JSON_ID', '1lE5srirGH7SQeAz6SqGj2GINB4r37peG')
    
    # Verificar API Key
    if 'GOOGLE_API_KEY' not in os.environ:
        log("ERROR: GOOGLE_API_KEY no configurada", "ERROR")
        log("Configura el secret en GitHub Repository Settings > Secrets > Actions", "ERROR")
        sys.exit(1)
    
    # Inicializar Google Drive API
    service = load_google_drive_api()
    if not service:
        sys.exit(1)
    
    # 1. Descargar y procesar productos
    log("📥 Descargando productos...")
    products_raw = download_file(service, PRODUCTS_JSON_ID)
    
    if not products_raw or not isinstance(products_raw, list):
        log("No se pudieron descargar los productos", "ERROR")
        sys.exit(1)
    
    # 2. Procesar cada producto
    log(f"🔄 Procesando {len(products_raw)} productos...")
    processed_products = []
    
    for i, product in enumerate(products_raw):
        if isinstance(product, dict):
            processed = process_product(product)
            processed_products.append(processed)
            
            # Log cada 10 productos
            if (i + 1) % 10 == 0 or i == len(products_raw) - 1:
                log(f"  Procesados: {i + 1}/{len(products_raw)}")
    
    # 3. Ordenar productos por ID o nombre
    processed_products.sort(key=lambda x: (
        x.get('categoria', 'ZZZ'),
        x.get('nombre', 'ZZZ')
    ))
    
    # 4. Guardar productos
    success = save_products_json(processed_products)
    
    # 5. Descargar configuración (opcional)
    try:
        save_config_json(service, CONFIG_JSON_ID)
    except Exception as e:
        log(f"No se pudo descargar configuración: {str(e)}", "WARNING")
    
    if success:
        log(f"✅ Sincronización completada: {len(processed_products)} productos")
        
        # Estadísticas
        total_images = sum(len(p.get('imagenes', [])) for p in processed_products)
        categories = set(p.get('categoria', '') for p in processed_products)
        
        print("\n" + "="*50)
        print("📊 ESTADÍSTICAS DE SINCRONIZACIÓN")
        print("="*50)
        print(f"📦 Productos totales: {len(processed_products)}")
        print(f"🖼️  Imágenes totales: {total_images}")
        print(f"🏷️  Categorías: {len(categories)}")
        print(f"💰 Rango de precios: ${min(p.get('precioMin', 0) for p in processed_products)} - ${max(p.get('precioMax', 0) for p in processed_products)}")
        print("="*50)
        
        sys.exit(0)
    else:
        log("❌ Error en la sincronización", "ERROR")
        sys.exit(1)

if __name__ == '__main__':
    main()