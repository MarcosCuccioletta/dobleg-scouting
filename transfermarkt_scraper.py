# =============================================================================
# TRANSFERMARKT SCRAPER - Google Colab
# =============================================================================
# Instrucciones:
# 1. Abrí Google Colab: https://colab.research.google.com
# 2. Creá un notebook nuevo
# 3. Copiá cada celda (separadas por # --- CELDA X ---) en celdas separadas
# 4. Ejecutá en orden
# =============================================================================

# --- CELDA 1: Instalar dependencias ---
# !pip install requests beautifulsoup4 pandas lxml

# --- CELDA 2: Imports y configuración ---
import requests
from bs4 import BeautifulSoup
import pandas as pd
import time
import re
from urllib.parse import quote
import random

# Headers para simular navegador real
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
}

# Mapeo de ligas
LIGA_MAP = {
    'colombia': 'CO1',
    'liga betplay dimayor': 'CO1',
    'categoría primera a': 'CO1',
    '2° de colombia': 'CO2',
    'torneo betplay': 'CO2',
    'primera b colombia': 'CO2',
    'argentina': 'AR1N',
    'liga profesional': 'AR1N',
    'primera división argentina': 'AR1N',
    '2° de argentina': 'AR2',
    'primera nacional': 'AR2',
    'uruguay': 'UY1',
    'primera división uruguay': 'UY1',
    'paraguay': 'PAR1',
    'primera división paraguay': 'PAR1',
    'chile': 'CL1',
    'primera división chile': 'CL1',
}

def normalizar_liga(liga_texto):
    """Normaliza el nombre de la liga para buscar en el mapeo"""
    if pd.isna(liga_texto):
        return None
    liga_lower = liga_texto.lower().strip()
    for key, value in LIGA_MAP.items():
        if key in liga_lower or liga_lower in key:
            return value
    return None

# --- CELDA 3: Funciones de scraping ---

def buscar_jugador(nombre, liga_id=None):
    """Busca un jugador en Transfermarkt y retorna la URL de su perfil"""
    try:
        # Limpiar nombre
        nombre_limpio = nombre.strip()
        nombre_encoded = quote(nombre_limpio)

        search_url = f"https://www.transfermarkt.com/schnellsuche/ergebnis/schnellsuche?query={nombre_encoded}"

        response = requests.get(search_url, headers=HEADERS, timeout=15)

        if response.status_code != 200:
            return None

        soup = BeautifulSoup(response.content, 'lxml')

        # Buscar en la tabla de resultados de jugadores
        player_table = soup.find('table', class_='items')

        if not player_table:
            return None

        rows = player_table.find_all('tr', class_=['odd', 'even'])

        for row in rows:
            # Obtener link del jugador
            link_tag = row.find('a', class_='spielprofil_tooltip')
            if link_tag and link_tag.get('href'):
                player_url = "https://www.transfermarkt.com" + link_tag['href']
                return player_url

        return None

    except Exception as e:
        print(f"Error buscando {nombre}: {e}")
        return None

def obtener_datos_jugador(url):
    """Extrae datos del perfil de un jugador"""
    datos = {
        'transfermarkt_url': url,
        'valor_mercado': None,
        'agente': None,
        'fin_contrato': None,
        'imagen_url': None
    }

    try:
        response = requests.get(url, headers=HEADERS, timeout=15)

        if response.status_code != 200:
            return datos

        soup = BeautifulSoup(response.content, 'lxml')

        # 1. Valor de mercado
        market_value = soup.find('a', class_='data-header__market-value-wrapper')
        if market_value:
            datos['valor_mercado'] = market_value.get_text(strip=True)

        # 2. Imagen del jugador
        img_tag = soup.find('img', class_='data-header__profile-image')
        if img_tag and img_tag.get('src'):
            datos['imagen_url'] = img_tag['src']

        # 3. Buscar info en la tabla de datos
        info_table = soup.find('div', class_='info-table')
        if info_table:
            spans = info_table.find_all('span')
            for i, span in enumerate(spans):
                text = span.get_text(strip=True).lower()

                # Agente
                if 'agent' in text or 'agente' in text:
                    if i + 1 < len(spans):
                        datos['agente'] = spans[i + 1].get_text(strip=True)

                # Fin de contrato
                if 'contract' in text or 'contrato' in text:
                    if i + 1 < len(spans):
                        datos['fin_contrato'] = spans[i + 1].get_text(strip=True)

        # Alternativa: buscar en data-header
        if not datos['fin_contrato']:
            contract_span = soup.find('span', string=re.compile(r'Contract expires:', re.I))
            if contract_span:
                parent = contract_span.find_parent()
                if parent:
                    datos['fin_contrato'] = parent.get_text(strip=True).replace('Contract expires:', '').strip()

        return datos

    except Exception as e:
        print(f"Error obteniendo datos de {url}: {e}")
        return datos

# --- CELDA 4: Cargar tu CSV de jugadores ---

# Subí tu archivo CSV o usá la URL directamente
CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSneBjGlw2I3SyXV-uw1V8Cs_O4lbiQw39melKEZJNhunpshakPrn7AZQBN2L8N9Yw_HA-EeVOt3qvf/pub?gid=2002620668&single=true&output=csv"

print("Cargando CSV de jugadores...")
df_jugadores = pd.read_csv(CSV_URL)
print(f"Total de jugadores: {len(df_jugadores)}")
print(f"Columnas: {list(df_jugadores.columns[:5])}...")  # Primeras 5 columnas
print(df_jugadores.head())

# --- CELDA 5: Procesar jugadores (EJECUTAR ESTO) ---

# Configuración
DESDE_FILA = 0      # Empezar desde esta fila (0 = primera)
HASTA_FILA = 50     # Procesar hasta esta fila (cambiar a len(df_jugadores) para todos)
PAUSA_MIN = 2       # Segundos mínimos entre requests
PAUSA_MAX = 5       # Segundos máximos entre requests

# Columnas de resultado
resultados = []

print(f"Procesando jugadores {DESDE_FILA} a {HASTA_FILA}...")
print("-" * 50)

for idx in range(DESDE_FILA, min(HASTA_FILA, len(df_jugadores))):
    row = df_jugadores.iloc[idx]
    nombre = row['Jugador']  # Ajustar si tu columna tiene otro nombre
    liga = row.get('Liga', '')
    equipo = row.get('Equipo', '')

    print(f"[{idx+1}/{HASTA_FILA}] Buscando: {nombre} ({equipo})...", end=" ")

    # Buscar jugador
    liga_id = normalizar_liga(liga)
    url = buscar_jugador(nombre, liga_id)

    if url:
        print(f"Encontrado!")
        datos = obtener_datos_jugador(url)
        datos['jugador_original'] = nombre
        datos['equipo_original'] = equipo
        datos['liga_original'] = liga
        resultados.append(datos)
        print(f"   -> Valor: {datos['valor_mercado']}, Contrato: {datos['fin_contrato']}")
    else:
        print("No encontrado")
        resultados.append({
            'jugador_original': nombre,
            'equipo_original': equipo,
            'liga_original': liga,
            'transfermarkt_url': None,
            'valor_mercado': None,
            'agente': None,
            'fin_contrato': None,
            'imagen_url': None
        })

    # Pausa aleatoria para no ser bloqueado
    time.sleep(random.uniform(PAUSA_MIN, PAUSA_MAX))

print("-" * 50)
print(f"Completado! {len(resultados)} jugadores procesados")

# --- CELDA 6: Guardar resultados ---

df_resultados = pd.DataFrame(resultados)

# Reordenar columnas
columnas_orden = ['jugador_original', 'equipo_original', 'liga_original',
                  'valor_mercado', 'transfermarkt_url', 'agente',
                  'fin_contrato', 'imagen_url']
df_resultados = df_resultados[columnas_orden]

# Guardar CSV
nombre_archivo = 'jugadores_transfermarkt.csv'
df_resultados.to_csv(nombre_archivo, index=False, encoding='utf-8-sig')

print(f"Archivo guardado: {nombre_archivo}")
print(df_resultados.head(10))

# Descargar el archivo (en Colab)
from google.colab import files
files.download(nombre_archivo)

# --- CELDA 7 (OPCIONAL): Estadísticas ---

print("\n=== ESTADÍSTICAS ===")
encontrados = df_resultados['transfermarkt_url'].notna().sum()
no_encontrados = df_resultados['transfermarkt_url'].isna().sum()
print(f"Jugadores encontrados: {encontrados} ({encontrados/len(df_resultados)*100:.1f}%)")
print(f"No encontrados: {no_encontrados} ({no_encontrados/len(df_resultados)*100:.1f}%)")

# Jugadores no encontrados (para revisar manualmente)
print("\nJugadores NO encontrados:")
print(df_resultados[df_resultados['transfermarkt_url'].isna()][['jugador_original', 'equipo_original']])
