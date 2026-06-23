/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// B2B Cliente de Heladería
export interface Client {
  id: string;
  name: string;          // Nombre del contacto
  businessName: string;  // Nombre de la heladería/cliente B2B
  phone: string;         // Número de WhatsApp (+569...)
  email: string;
  lastPurchaseDate: string; // YYYY-MM-DD
  estimatedNextPurchaseDate: string; // YYYY-MM-DD (Calculado por Lambda Python)
  averagePurchaseIntervalDays: number; // Intervalo promedio de compra
  preferredFlavor: string;  // Sabor favorito / más comprado
  lastOrderVolumeKg: number; // Kilos del último pedido
  status: 'Urgent' | 'Soon' | 'On Track' | 'Inactive'; // Estado basado en urgencia de contacto
  notes?: string;
  aftSurvivalCurve?: { day: number; probability: number }[]; // Curva de probabilidad de compra (inversa de supervivencia) calculada por AFT
  aftCicloEsperadoDias?: number;   // Mediana del ciclo de compra estimado por AFT
  aftDiasMinCompra?: number;       // Percentil P80 (ventana temprana de compra)
  aftDiasMaxCompra?: number;       // Percentil P20 (ventana tardía de compra)
  aftFechaPredMediana?: string;    // Fecha predicha mediana (ISO string)
  aftFechaPredP75?: string;        // Inicio de ventana de compra
  aftFechaPredP25?: string;        // Fin de ventana de compra
  aftIntervalo?: number;           // Ancho de la ventana de compra en días
  shouldContact?: boolean;         // Flag calculado en Python: supervivencia hoy > 95%, en 7 días < 50%, <= 90 días sin pedir
}

// Registro de mensajes de WhatsApp enviados
export interface WhatsAppLog {
  id: string;
  clientId: string;
  clientName: string;
  businessName: string;
  phone: string;
  templateId: string;
  templateName: string;
  sentAt: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  messageBody: string;
  variablesUsed: string[];
  notes?: string;
}

// Plantilla de WhatsApp Predefinida
export interface WhatsAppTemplate {
  id: string;
  name: string;
  category: 'utility' | 'marketing' | 'alert';
  body: string;
  placeholderCount: number;
  placeholdersDescription: string[];
  languageCode?: string;
}

// Estructura de respuesta del servicio Lambda Python (Pandas extractor)
export interface LambdaExtractionResponse {
  success: boolean;
  timestamp: string;
  pythonVersion: string;
  pandasVersion: string;
  rowsProcessed: number;
  summaryStats: {
    totalVolumeKg: number;
    averageCycleDays: number;
    mostPopularFlavor: string;
  };
  clients: Client[];
  allOrders?: Array<{
    location: string;
    client: string;
    order_date: string;
    amount: number;
    delivery_date: string;
    comodato: number;
  }>;
  rawConsoleLogs: string; // Simulación del log de stdout de Python
}

// Estado de autenticación de usuario único
export interface AuthState {
  isAuthenticated: boolean;
  username: string;
  token: string | null;
  error?: string;
}

// Conexión a Google Sheet como fuente de datos
export interface GoogleSheetConnection {
  id: string;
  name: string;              // Nombre descriptivo dado por el usuario
  sheetUrl: string;          // URL completa del Google Sheet
  sheetId: string;           // ID extraído de la URL
  addedAt: string;           // ISO timestamp
  lastSyncAt: string | null; // Última sincronización exitosa
  status: 'connected' | 'error' | 'syncing';
  rowCount?: number;         // Filas procesadas en última sincronización
  errorMsg?: string;         // Mensaje de error si falló
}


export interface WhatsAppTemplate {
  id: string;
  name: string;
  category: 'utility' | 'marketing' | 'alert';
  body: string;
  placeholderCount: number;
  placeholdersDescription: string[];
  languageCode?: string;
}