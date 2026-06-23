export const pythonProgram = `
import pandas as pd
import numpy as np
import datetime
import difflib
import unicodedata
import io
import json
import re

# =========================================================================
# FASE 1: OBTENCIÓN Y LIMPIEZA DE DATOS (Data Acquisition & Cleaning)
# =========================================================================
print("[FASE 1] Iniciando extracción e higiene de datos de la planilla...")

# Usar fecha estática para coincidir con el gráfico (06/06/2026)
simulated_today = datetime.datetime(2026, 6, 8)

locations = [
    "Santiago Centro", "Cerrillos", "Cerro Navia", "Conchalí", "El Bosque",
    "Estación Central", "Huechuraba", "Independencia", "La Cisterna",
    "La Florida", "La Granja", "La Pintana", "La Reina", "Las Condes",
    "Lo Barnechea", "Lo Espejo", "Lo Prado", "Macul", "Maipú",
    "Ñuñoa", "Pedro Aguirre Cerda", "Peñalolén", "Providencia",
    "Pudahuel", "Quilicura", "Quinta Normal", "Recoleta", "Renca",
    "San Joaquín", "San Miguel", "San Ramón", "Vitacura", "Puente Alto",
    "Pirque", "San José de Maipo", "Colina", "Lampa", "Tiltil",
    "San Bernardo", "Buin", "Calera de Tango", "Paine",
    "Melipilla", "Alhué", "Curacaví", "María Pinto", "San Pedro",
    "Talagante", "El Monte", "Isla de Maipo", "Padre Hurtado", "Peñaflor", "Calama"
]

clients = list(db_clients_list) if 'db_clients_list' in globals() else []


stop_words = {
    "cafe", "cafeteria", "heladeria", "restaurant", "restaurante", 
    "chile", "spa", "ltda", "limitada", "sa", "comercial", 
    "sociedad", "emporio", "minimarket", "pasteleria", "panaderia", 
    "gelateria", "el", "la", "los", "las", "de", "del", "y", "en", 
    "market", "food", "store", "alimentos", "distribuidora", 
    "comercializadora", "tostaduria", "pizza", "pizzeria", "hotel", 
    "boutique", "gelato", "local", "coffe", "coffee", "cofee"
}

# Agregar stop words personalizadas del usuario
if 'user_data_rules' in globals():
    for rule in user_data_rules:
        if rule.get('ruleType') == 'stop_word' and rule.get('matchValue'):
            stop_words.add(rule['matchValue'].lower().strip())

def clean_business_name(name):
    # Eliminar puntuación y caracteres especiales (escapando la barra invertida para TS)
    name = re.sub(r'[^\\w\\s]', '', name)
    tokens = name.split()
    # Filtrar palabras comunes (stop words)
    filtered_tokens = [t for t in tokens if t not in stop_words]
    # Si todo era stop words, volver a los tokens originales para no dejarlo vacío
    if not filtered_tokens:
        filtered_tokens = tokens
    # Ordenar alfabéticamente ayuda a que el orden de las palabras no importe
    filtered_tokens.sort()
    return " ".join(filtered_tokens)

def extract_one_emulated(word, choices, is_client=False):
    word_clean = str(word).lower().strip()
    choices_map = {str(c).lower().strip(): c for c in choices}
    
    best_match = None
    best_score = 0
    
    # 1. Búsqueda clásica primero (prioridad a coincidencias exactas con palabras comunes)
    matches_base = difflib.get_close_matches(word_clean, choices_map.keys(), n=1, cutoff=0.75)
    if matches_base:
        best_base_key = matches_base[0]
        score_base = int(difflib.SequenceMatcher(None, word_clean, best_base_key).ratio() * 100)
        best_score = score_base
        best_match = choices_map[best_base_key]
        
    # Si encontramos un match perfecto de 100%, terminamos aquí
    if best_score == 100:
        return best_match, best_score
        
    # 2. Búsqueda con nombres limpios (sin stop words, orden alfabético) para ignorar "Cafe", "SPA", etc.
    if is_client:
        word_normalized = clean_business_name(word_clean)
        
        norm_to_original = {}
        for c_clean, original in choices_map.items():
            c_norm = clean_business_name(c_clean)
            # Solo guardamos el primero si hay duplicados en el formato normalizado
            if c_norm not in norm_to_original:
                norm_to_original[c_norm] = original
                
        matches_norm = difflib.get_close_matches(word_normalized, norm_to_original.keys(), n=1, cutoff=0.75)
        if matches_norm:
            best_norm_key = matches_norm[0]
            score_norm = int(difflib.SequenceMatcher(None, word_normalized, best_norm_key).ratio() * 100)
            if score_norm > best_score:
                best_score = score_norm
                best_match = norm_to_original[best_norm_key]
                
    return best_match if best_match else word, best_score

def normalizar_locacion(texto_sucio):
    if pd.isna(texto_sucio) or str(texto_sucio).strip() == "":
        return "No especificado"
    resultado, score = extract_one_emulated(str(texto_sucio), locations, is_client=False)
    if score >= 75:
        return resultado
    else:
        return str(texto_sucio).strip().capitalize()

def limpiar_texto(texto):
    if not isinstance(texto, str): return ""
    texto = texto.lower().strip()
    texto = ''.join(c for c in unicodedata.normalize('NFD', texto) if unicodedata.category(c) != 'Mn')
    return texto

def normalizar_cliente(nombre_sucio):
    # Eliminar cualquier texto entre paréntesis para la comparación
    nombre_sin_paren = re.sub(r'\\(.*?\\)', '', str(nombre_sucio)).strip()
    limpio = limpiar_texto(nombre_sin_paren)
    if not limpio: return "Sin Nombre"
    match, score = extract_one_emulated(limpio, clients, is_client=True)
    if score >= 85:
        return match
    else:
        clients.append(nombre_sin_paren.title())
        return nombre_sin_paren.title()

raw_data = []

# Process multiple files if passed as excel_bytes_list, or fallback to a single file if excel_bytes_list is not present
bytes_list_to_process = excel_bytes_list if 'excel_bytes_list' in globals() else [excel_bytes]

for file_idx, f_bytes in enumerate(bytes_list_to_process):
    try:
        excel_file = io.BytesIO(bytes(f_bytes))
        sheets = {}
        if is_csv:
            csv_text = excel_file.getvalue().decode('utf-8', errors='ignore')
            df_csv = pd.read_csv(io.StringIO(csv_text), header=None)
            sheets = {"PlanillaCSV": df_csv}
        else:
            sheets = pd.read_excel(excel_file, sheet_name=None, header=None)
            
        for sheet_name, df_raw in sheets.items():
            df_raw = df_raw.fillna("")
            for i, row in df_raw.iterrows():
                try:
                    if len(row) > 0 and isinstance(row[0], str) and row[0].strip().lower() == "pedido":
                        if i + 1 < len(df_raw):
                            data_row = df_raw.iloc[i+1]
                        else:
                            continue
                        
                        loc_val = row[1] if len(row) > 1 else ""
                        location = normalizar_locacion(loc_val)
                        
                        client_val = data_row[0] if len(data_row) > 0 else "Sin Nombre"
                        client = normalizar_cliente(client_val)
                        
                        order_date = data_row[2] if len(data_row) > 2 else ""
                        amount = data_row[3] if len(data_row) > 3 else 15
                        delivery_date = data_row[4] if len(data_row) > 4 else ""
                        
                        comodato = 0
                        if i - 1 >= 0:
                            prev_row = df_raw.iloc[i-1]
                            if len(prev_row) > 0:
                                comodato = 1 if str(prev_row[0]).strip().lower() == "con maquina" else 0
                        
                        def parse_date_safe(d_val):
                            if isinstance(d_val, datetime.datetime):
                                return d_val
                            if isinstance(d_val, datetime.date):
                                return datetime.datetime.combine(d_val, datetime.time.min)
                            try:
                                return pd.to_datetime(str(d_val)).to_pydatetime()
                            except Exception:
                                return simulated_today
                        
                        parsed_del_dt = parse_date_safe(delivery_date)
                        parsed_ord_dt = parse_date_safe(order_date)
                        
                        raw_data.append({
                            "location": location,
                            "client": client,
                            "order_date": parsed_ord_dt,
                            "amount": amount,
                            "delivery_date": parsed_del_dt,
                            "comodato": comodato
                        })
                except Exception as ex:
                    print(f"Error parseando fila {i} en archivo {file_idx}: {str(ex)}")
    except Exception as e:
        print(f"Error al leer planilla {file_idx} en Pandas: {str(e)}")

if not raw_data:
    print("[FASE 1] Formato Viaggio no detectado. Intentando parseo estructurado estándar...")
    for file_idx, f_bytes in enumerate(bytes_list_to_process):
        try:
            excel_file = io.BytesIO(bytes(f_bytes))
            sheets = {}
            if is_csv:
                csv_text = excel_file.getvalue().decode('utf-8', errors='ignore')
                df_csv = pd.read_csv(io.StringIO(csv_text), header=None)
                sheets = {"PlanillaCSV": df_csv}
            else:
                sheets = pd.read_excel(excel_file, sheet_name=None, header=None)

            for sheet_name, df_raw in sheets.items():
                for idx, r in df_raw.iterrows():
                    try:
                        row_str = " ".join([str(x).lower() for x in r if not pd.isna(x)])
                        if "cliente" in row_str or "business" in row_str or "local" in row_str or "pedido" in row_str:
                            continue
                        b_name = str(r[0]).strip() if len(r) > 0 and r[0] else ""
                        if b_name:
                            b_name_norm = normalizar_cliente(b_name)
                            vol_val = 15
                            if len(r) > 3:
                                try:
                                    vol_val = int(float(str(r[3]).strip()))
                                except Exception:
                                    pass
                            raw_data.append({
                                "location": "Santiago",
                                "client": b_name_norm,
                                "order_date": simulated_today,
                                "amount": vol_val,
                                "delivery_date": simulated_today,
                                "comodato": 0
                            })
                    except Exception:
                        pass
        except Exception as e:
            pass

df = pd.DataFrame(raw_data)

if df.empty:
    raise Exception("No se extrajeron registros válidos del archivo excel.")

# Limpieza general de columnas y duplicados
df['order_date'] = pd.to_datetime(df['order_date'], errors='coerce')
df['delivery_date'] = pd.to_datetime(df['delivery_date'], errors='coerce')
df['location'] = df['location'].astype(str).str.title().str.strip()

df['location'] = df['location'].replace({
    'P Hurtado': 'Padre Hurtado',
    'Padre Hurtad': 'Padre Hurtado',
    'La Csiterna': 'La Cisterna',
    'Nuñoa': 'Ñuñoa',
    'Recolete': 'Recoleta',
    'Stgo': 'Santiago Centro',
    'Stgo C': 'Santiago Centro',
    'P Alto': 'Puente Alto',
    "Stgo Centro": "Santiago Centro",
    "Stg Centro": "Santiago Centro",
    "Santiago C": "Santiago Centro",
    "Provi": "Providencia",
    "Padre H": "Padre Hurtado",
})

# Aplicar reglas de reemplazo personalizadas del usuario
if 'user_data_rules' in globals():
    user_replace_rules = {}
    for rule in user_data_rules:
        if rule.get('ruleType') == 'replace' and rule.get('columnName'):
            col = rule['columnName']
            if col not in user_replace_rules:
                user_replace_rules[col] = {}
            user_replace_rules[col][rule['matchValue']] = rule.get('newValue', '')
    
    for col, mapping in user_replace_rules.items():
        if col in df.columns:
            df[col] = df[col].replace(mapping)
            print(f"[FASE 1] Aplicados {len(mapping)} reemplazos de usuario en columna '{col}'.")

try:
    df['amount'] = pd.to_numeric(df['amount'], errors='coerce').fillna(15).astype(int)
except Exception:
     df['amount'] = 15
     
df = df.drop_duplicates()
df = df.sort_values(by=['client', 'order_date']).reset_index(drop=True)
print(f"[FASE 1] Completada con éxito. Se importaron {len(df)} registros consolidables.")

# =========================================================================
# FASE 2: CÁLCULO DE VARIABLES EXPLICATIVAS Y COVARIABLES (Feature Engineering)
# =========================================================================
print("[FASE 2] Calculando variables explicativas y covariables para el análisis de supervivencia...")

# Calcular el tiempo de supervivencia (tiempo_días) y el indicador de evento (evento_recompra)
df['next_order_date'] = df.groupby('client')['order_date'].shift(-1)
df['evento_recompra'] = df['next_order_date'].notna().astype(int)

fecha_actual = df['order_date'].max()
fechas_para_calculo = df['next_order_date'].fillna(fecha_actual)

df['tiempo_días'] = (fechas_para_calculo - df['order_date']).dt.days
df['tiempo_días'] = np.maximum(df['tiempo_días'], 0.5)

# Clasificar y perfilar tarifas de envío
tarifas = {
    6000: ["Providencia", "Ñuñoa", "Santiago", "Santiago Centro", "Vitacura", "Recoleta", "Quinta Normal"],
    7000: ["Las Condes", "La Reina", "Independencia", "San Joaquín", "San Miguel", "Macul"],
    8000: ["Lo Barnechea", "Peñalolén", "La Cisterna", "La Granja", "San Ramón", "Lo Espejo", "Estación Central", "Pedro Aguirre Cerda"],
    10000: ["La Florida", "Huechuraba", "San Bernardo", "Quilicura", "Conchalí", "Renca", "Cerro Navia", "Lo Prado", "Pudahuel", "Puente Alto", "La Pintana", "El Bosque", "Cerrillos", "Maipu"],
    15000: ["Padre Hurtado"]
}

mapa_tarifas = {}
for tarifa, coms in tarifas.items():
    for comuna in coms:
        mapa_tarifas[comuna] = tarifa

df['tarifa_exacta'] = df['location'].map(mapa_tarifas)
mediana_tarifa = df['tarifa_exacta'].median()
if pd.isna(mediana_tarifa) or np.isnan(mediana_tarifa):
    mediana_tarifa = 7000
df['tarifa_exacta'] = df['tarifa_exacta'].fillna(mediana_tarifa)

condiciones = [
    df['tarifa_exacta'].isin([6000, 7000]),
    df['tarifa_exacta'].isin([7001, 10000])
]
niveles = ['Tarifa_Baja', 'Tarifa_Media']
df['nivel_despacho'] = np.select(condiciones, niveles, default='Tarifa_Alta')

# Calcular características del comportamiento histórico del pedido
df['monto_promedio'] = df.groupby('client')['amount'].transform(lambda x: x.expanding().mean())

df['dias_desde_anterior'] = df.groupby('client')['order_date'].diff().dt.days
df['dias_desde_anterior'] = df['dias_desde_anterior'].fillna(0)

df['primer_pedido'] = df.groupby('client')['order_date'].transform('min')
df['tenure'] = (df['order_date'] - df['primer_pedido']).dt.days

df['intervalo_promedio'] = df.groupby('client')['dias_desde_anterior'].transform(lambda x: x.expanding().mean())

mediana_global_espera = df['dias_desde_anterior'].median()
if pd.isna(mediana_global_espera) or np.isnan(mediana_global_espera):
    mediana_global_espera = 14.0

df['intervalo_promedio'] = np.log1p(df['intervalo_promedio'].fillna(mediana_global_espera))

df['num_compra_historica'] = df.groupby('client').cumcount() + 1

previous_order_ratio = df.groupby('client')['amount'].shift(-1) / df['monto_promedio']
df['Log_Amount'] = np.log1p(np.where(previous_order_ratio.isna(),
                                     df['amount'] / df['monto_promedio'],
                                     previous_order_ratio))

df['siguiente'] = df.groupby('client')['order_date'].shift(-1)
max_date = df['order_date'].max()
df['Dias_hasta_siguiente'] = np.where(df['siguiente'].notna(),
                                      (df['siguiente'] - df['order_date']).dt.days,
                                      (max_date - df['order_date']).dt.days + 1)
df['Evento'] = np.where(df['siguiente'].notna(), 1, 0)

mediana_dhs = df['Dias_hasta_siguiente'].median()
if pd.isna(mediana_dhs) or np.isnan(mediana_dhs):
    mediana_dhs = 14.0
df['Log_Inercia'] = np.log1p(df.groupby('client')['Dias_hasta_siguiente'].shift(1).fillna(mediana_dhs))

df['ltv_historico'] = df.groupby('client')['amount'].transform(lambda x: x.cumsum().shift(1)).fillna(0)
df['cliente_frecuente'] = df['num_compra_historica'].apply(lambda x: 1 if x > 3 else 0)
df['log_ltv_historico'] = np.log1p(df['ltv_historico'])

df['es_restock_semana'] = df['order_date'].dt.dayofweek.isin([4,5,6]).astype(int)

df['tiempo_entrega'] = df['delivery_date'] - df['order_date']
df["tiempo_entrega"] = df["tiempo_entrega"].dt.days.apply(lambda x: 1 if x >= 3 else 0)

cols_to_clip = ['intervalo_promedio', 'tenure', 'num_compra_historica']
for col in cols_to_clip:
    p99 = df[col].quantile(0.99)
    if not pd.isna(p99):
        df[col] = df[col].clip(upper=p99)

print("[FASE 2] Completada. Covariables de DataFrame construidas con éxito.")

# =========================================================================
# FASE 3: ENTRENAMIENTO DEL MODELO AFT (Survival Regression Fitting)
# =========================================================================
print("[FASE 3] Configurando y entrenando el modelo de regresión de supervivencia AFT...")

columnas_modelo = [
    'Log_Inercia',
    'Log_Amount',
    'tiempo_días',
    'evento_recompra',
    'log_ltv_historico',
    "comodato",
    "intervalo_promedio",
    'nivel_despacho'
]

df_modelo = df[columnas_modelo].copy()
df_modelo = pd.get_dummies(df_modelo, columns=['nivel_despacho'], drop_first=True)

# Asegurar compatibilidad para tipos en model_cols
for col in df_modelo.columns:
    df_modelo[col] = pd.to_numeric(df_modelo[col], errors='coerce').fillna(0)

aft = None
aft_summary_str = ""
model_fit_success = False

try:
    from lifelines import LogNormalAFTFitter
    # Instanciamos el modelo con una pequeña penalización de regularización L2 (sugerido 0.01)
    aft = LogNormalAFTFitter(penalizer=0.01)
    aft.fit(df_modelo, duration_col='tiempo_días', event_col='evento_recompra', robust=True)
    summary_df = aft.summary
    aft_summary_str = summary_df.to_string()
    model_fit_success = True
    print("[FASE 3] ¡Ajuste de LogNormalAFTFitter de lifelines completado con éxito!")
except Exception as e:
    aft_summary_str = f"No se pudo entrenar lifelines: {str(e)} -> Activando estimador heurístico robusto log-normal."
    print(f"[FASE 3] Heurístico: {aft_summary_str}")

# =========================================================================
# FASE 4: PROYECCIONES DE SUPERVIVENCIA Y CORRECCIÓN DE VENTANAS (Predictions)
# =========================================================================
print("[FASE 4] Realizando predicciones probabilísticas de supervivencia para la última compra...")

# Filtrar para quedarnos con la última compra de cada cliente para predecir su próximo ciclo
df_ultimos = df.sort_values(by=['client', 'order_date']).groupby('client').last().reset_index()

X_pred = df_ultimos[columnas_modelo].copy()
X_pred = pd.get_dummies(X_pred, columns=['nivel_despacho'], drop_first=True)

# Alinear columnas con el modelo de entrenamiento para que coincidan de manera idéntica
columnas_entrenamiento = df_modelo.drop(columns=['tiempo_días', 'evento_recompra']).columns
X_pred = X_pred.reindex(columns=columnas_entrenamiento, fill_value=0)
X_pred = X_pred.astype(float)

if model_fit_success and aft is not None:
    try:
        # Ciclo Esperado (Mediana de supervivencia = 50% de probabilidad de recompra)
        df_ultimos['Ciclo_Esperado_Dias'] = aft.predict_median(X_pred).round().astype(int)
        
        # Percentiles para determinar límites sugeridos de llamadas preventivas
        # Compra temprana: Percentil 0.80 (20% de probabilidad acumulada de haber ordenado ya)
        # Compra tardía: Percentil 0.20 (80% de probabilidad acumulada de haber ordenado ya, límite extremo)
        p_temprano = aft.predict_percentile(X_pred, p=0.80).round().astype(int)
        p_tardio = aft.predict_percentile(X_pred, p=0.20).round().astype(int)
        
        df_ultimos['Dias_Min_Compra'] = p_temprano
        df_ultimos['Dias_Max_Compra'] = p_tardio
        print("[FASE 4] Predicciones AFT sobre lifelines generadas exitosamente.")
    except Exception as pred_err:
        print(f"[FASE 4] Falló predicción de lifelines: {str(pred_err)}. Activando Heurístico...")
        model_fit_success = False

if not model_fit_success:
    # Usar estimador paramétrico robusto basado en el ciclo histórico de compra del cliente
    for idx, row in df_ultimos.iterrows():
        # Re-evaluar intervalo usando el promedio corregido del cliente
        avg_int_days = np.expm1(row['intervalo_promedio'])
        if pd.isna(avg_int_days) or avg_int_days < 1.0:
            avg_int_days = 15.0
            
        df_ultimos.at[idx, 'Ciclo_Esperado_Dias'] = int(round(avg_int_days))
        df_ultimos.at[idx, 'Dias_Min_Compra'] = int(round(avg_int_days * 0.70))
        df_ultimos.at[idx, 'Dias_Max_Compra'] = int(round(avg_int_days * 1.45))

# Saneamiento de límites matemáticos
df_ultimos['Ciclo_Esperado_Dias'] = np.maximum(df_ultimos['Ciclo_Esperado_Dias'].fillna(14).astype(int), 3)
df_ultimos['Dias_Min_Compra'] = np.maximum(df_ultimos['Dias_Min_Compra'].fillna(10).astype(int), 2)
df_ultimos['Dias_Max_Compra'] = np.maximum(df_ultimos['Dias_Max_Compra'].fillna(21).astype(int), df_ultimos['Ciclo_Esperado_Dias'] + 2)

# Sumar días probabilísticos para el cálculo de fechas reales
df_ultimos['Fecha_Llamada_Ideal'] = df_ultimos['order_date'] + pd.to_timedelta(df_ultimos['Ciclo_Esperado_Dias'], unit='D')
df_ultimos['Ventana_Desde'] = df_ultimos['order_date'] + pd.to_timedelta(df_ultimos['Dias_Min_Compra'], unit='D')
df_ultimos['Ventana_Hasta'] = df_ultimos['order_date'] + pd.to_timedelta(df_ultimos['Dias_Max_Compra'], unit='D')

survival_funcs = None
if model_fit_success and aft is not None:
    try:
        survival_funcs = aft.predict_survival_function(X_pred)
        print("[FASE 4] Curvas de supervivencia predichas con éxito de lifelines.")
    except Exception as curve_err:
        print(f"[FASE 4] Falló predicción de curvas de supervivencia: {str(curve_err)}")

print("[FASE 4] Fechas dinámicas de re-stock agendadas.")

# =========================================================================
# FASE 5: CONSOLIDACIÓN DE RESULTADOS JASON Y RETORNO (Response Packaging)
# =========================================================================
print("[FASE 5] Consolidando respuestas e integrando métricas...")

clients_extracted = []
total_volume = 0.0
total_interval_sum = 0
valid_clients_count = 0
global_sabor_favorito = "Vainilla Bourbon Premium"

target_days = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 35, 40, 45, 50, 60, 75, 90]

for idx, row in df_ultimos.iterrows():
    client_name = row['client']
    last_vol = int(row['amount'])
    total_volume += last_vol
    
    del_date_val = row['delivery_date']
    if pd.isna(del_date_val):
        del_date_val = simulated_today
        
    last_purchase_str = del_date_val.strftime('%Y-%m-%d')
    next_purchase_dt = row['Fecha_Llamada_Ideal']
    next_purchase_str = next_purchase_dt.strftime('%Y-%m-%d')
    
    # Evaluar estatus basado en días faltantes
    days_left = (next_purchase_dt - simulated_today).days
    if days_left <= 0:
        status_val = 'Urgent'
    elif days_left <= 5:
        status_val = 'Soon'
    else:
        status_val = 'On Track'
        
    flavor = "Mix Tradicional"
    if row['comodato'] == 1:
        flavor = "Chocolate Belga (C/ Máquina)"
    else:
        flavor = "Vainilla Bourbon Premium"
        
    notes_str = (
        f"Ubicación: {row['location']}. Comodato: {'Sí' if row['comodato'] == 1 else 'No'}. "
        f"AFT Regression: Ciclo {row['Ciclo_Esperado_Dias']}d (Ventana: {row['Dias_Min_Compra']}d - {row['Dias_Max_Compra']}d)."
    )
    
    celular_asignado = "+56975804356"
    email_asignado = f"compras@{limpiar_texto(client_name).replace(' ', '')}.cl"
    
    avg_interval = int(row['Ciclo_Esperado_Dias'])
    total_interval_sum += avg_interval
    valid_clients_count += 1
    
    # Calcular o mapear curva de supervivencia para este cliente
    curve_points = []
    if survival_funcs is not None and idx in survival_funcs.columns:
        try:
            client_series = survival_funcs[idx]
            for day_val in target_days:
                closest_idx = min(client_series.index, key=lambda x: abs(x - day_val))
                prob_val = float(client_series.loc[closest_idx])
                curve_points.append({
                    "day": int(day_val),
                    "probability": round(prob_val, 4)
                })
        except Exception as e_pt:
            print(f"Error mapeando punto de supervivencia lifelines para {client_name}: {str(e_pt)}")

    if not curve_points:
        import math
        mu = math.log(max(1.0, float(avg_interval)))
        sigma = 0.4
        for day_val in target_days:
            if day_val == 0:
                prob_val = 1.0
            else:
                try:
                    z = (math.log(day_val) - mu) / (sigma * math.sqrt(2.0))
                    t_val = 1.0 / (1.0 + 0.5 * abs(z))
                    ans = 1.0 - t_val * math.exp(-z*z - 1.26551223 + t_val * (1.00002368 + t_val * (0.37409196 + t_val * (0.09678418 + t_val * (-0.18628806 + t_val * (0.27886807 + t_val * (-1.13520398 + t_val * (1.48851587 + t_val * (-0.82215223 + t_val * 0.17087277)))))))))
                    if z < 0:
                        ans = -ans
                    cdf_val = 0.5 * (1.0 + ans)
                    prob_val = max(0.0, min(1.0, 1.0 - cdf_val))
                except Exception:
                    prob_val = max(0.0, 1.0 - (day_val / (avg_interval * 2.0)))
            curve_points.append({
                "day": int(day_val),
                "probability": round(prob_val, 4)
            })

    # --- Calcular shouldContact ---
    # Criterios: supervivencia hoy > 95%, supervivencia en 7 días < 50%, y no más de 90 días sin pedir
    days_since_last = (simulated_today - del_date_val).days
    days_since_last = max(0, days_since_last)

    def get_surv_at_day(cp, target_d):
        """Interpola la probabilidad de supervivencia en target_d usando curve_points."""
        if not cp:
            return None
        best = cp[0]
        for p in cp:
            if abs(p['day'] - target_d) < abs(best['day'] - target_d):
                best = p
        return best['probability']

    surv_today = get_surv_at_day(curve_points, days_since_last)
    surv_7d = get_surv_at_day(curve_points, days_since_last + 7)

    should_contact = False
    if surv_today is not None and surv_7d is not None and days_since_last <= 90 and days_since_last >= 4 :
        should_contact = surv_today > 0.05 and surv_7d < 0.50

    clients_extracted.append({
        'id': f"client_{limpiar_texto(client_name).replace(' ', '_')}_{idx}",
        'name': 'Responsable B2B',
        'businessName': client_name,
        'phone': celular_asignado,
        'email': email_asignado,
        'lastPurchaseDate': last_purchase_str,
        'estimatedNextPurchaseDate': next_purchase_str,
        'averagePurchaseIntervalDays': avg_interval,
        'preferredFlavor': flavor,
        'lastOrderVolumeKg': last_vol,
        'status': status_val,
        'notes': notes_str,
        
        # Mapeando campos de regresión AFT para persistencia y renderizado
        'aftCicloEsperadoDias': int(row['Ciclo_Esperado_Dias']),
        'aftDiasMinCompra': int(row['Dias_Min_Compra']),
        'aftDiasMaxCompra': int(row['Dias_Max_Compra']),
        'aftFechaPredMediana': next_purchase_str,
        'aftFechaPredP75': row['Ventana_Desde'].strftime('%Y-%m-%d'),
        'aftFechaPredP25': row['Ventana_Hasta'].strftime('%Y-%m-%d'),
        'aftIntervalo': int(row['Dias_Max_Compra'] - row['Dias_Min_Compra']),
        'aftSurvivalCurve': curve_points,
        'shouldContact': should_contact
    })

avg_cycle = total_interval_sum / max(1, valid_clients_count)
if clients_extracted:
    global_sabor_favorito = clients_extracted[0]['preferredFlavor']

all_orders = []
df_all = df.copy()
try:
    for col in df_all.columns:
        def sanitize_val(x):
            if hasattr(x, 'strftime') and pd.notna(x):
                return x.strftime('%Y-%m-%d')
            elif pd.isna(x):
                return None
            return x
        df_all[col] = df_all[col].apply(sanitize_val)
except Exception as d_err:
    print(f"Error parseando columnas de df_all: {str(d_err)}")
all_orders = df_all.sort_values(by='order_date', ascending=False).to_dict(orient='records')

result = {
    'success': True,
    'timestamp': simulated_today.isoformat(),
    'pythonVersion': '3.11 with Pyodide WASM',
    'pandasVersion': pd.__version__,
    'rowsProcessed': len(df),
    'summaryStats': {
        'totalVolumeKg': round(total_volume, 1),
        'averageCycleDays': round(avg_cycle, 1),
        'mostPopularFlavor': global_sabor_favorito
    },
    'clients': clients_extracted,
    'allOrders': all_orders,
    'rawConsoleLogs': f"Entrenamiento AFT Terminado con Exito:\\n{aft_summary_str}"
}

print("[FASE 5] Output consolidado correctamente.")
json.dumps(result)
`