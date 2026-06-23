"use client"

import React, { useState, useEffect, useRef } from 'react';
import {
  Link2, Plus, RefreshCw, Trash2, CheckCircle, AlertCircle,
  Terminal, Loader2, ExternalLink, Database, Sheet, X, Settings, MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Client, GoogleSheetConnection, LambdaExtractionResponse } from "@/app/types/types";
import { codeSteps } from '../utils/codeSteps';
import DataRulesModal from './DataRulesModal';
import ManageTemplatesModal from './ManageTemplatesModal';

interface GoogleSheetsManagerProps {
  onExtractionComplete: (newClients: Client[], summary: any, rawResult?: LambdaExtractionResponse) => void;
}

/**
 * Extrae el ID del spreadsheet desde una URL de Google Sheets.
 * Soporta formatos:
 *   - https://docs.google.com/spreadsheets/d/SHEET_ID/edit#gid=0
 *   - https://docs.google.com/spreadsheets/d/SHEET_ID/edit?usp=sharing
 *   - https://docs.google.com/spreadsheets/d/SHEET_ID
 */
function extractSheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

export default function GoogleSheetsManager({ onExtractionComplete }: GoogleSheetsManagerProps) {
  const [connections, setConnections] = useState<GoogleSheetConnection[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState('');

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null); // null = all, string = specific
  const [syncStep, setSyncStep] = useState(0);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number } | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<{
    success: boolean;
    clientCount: number;
    sourceCount: number;
    rows: number;
  } | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Data rules modal state
  const [showDataRulesModal, setShowDataRulesModal] = useState(false);
  const [showManageTemplatesModal, setShowManageTemplatesModal] = useState(false);

  // Load connections from API on mount
  useEffect(() => {
    const fetchConnections = async () => {
      try {
        const res = await fetch('/api/connections');
        const data = await res.json();
        if (data.connections) {
          const cleaned = data.connections.map((c: GoogleSheetConnection) =>
            c.status === 'syncing' ? { ...c, status: 'connected' as const } : c
          );
          setConnections(cleaned);

          // Update DB if any was stuck in 'syncing'
          cleaned.forEach((c: GoogleSheetConnection, i: number) => {
            if (c.status !== data.connections[i].status) {
              fetch('/api/connections', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: c.id, status: 'connected' })
              });
            }
          });
        }
      } catch (err) {
        console.error("Failed to load connections", err);
      }
    };
    fetchConnections();
  }, []);


  // ── Add connection ──────────────────────────────────────────
  const handleAddConnection = () => {
    setAddError('');

    const trimmedUrl = newUrl.trim();
    if (!trimmedUrl) {
      setAddError('Pega la URL de tu Google Sheet.');
      return;
    }

    const sheetId = extractSheetId(trimmedUrl);
    if (!sheetId) {
      setAddError('URL inválida. Usa el formato: https://docs.google.com/spreadsheets/d/...');
      return;
    }

    // Check for duplicates
    if (connections.some(c => c.sheetId === sheetId)) {
      setAddError('Esta hoja de cálculo ya está conectada.');
      return;
    }

    const name = newName.trim() || `Hoja ${connections.length + 1}`;

    const newConnection: GoogleSheetConnection = {
      id: `gs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      sheetUrl: trimmedUrl,
      sheetId,
      addedAt: new Date().toISOString(),
      lastSyncAt: null,
      status: 'connected',
    };

    const updated = [...connections, newConnection];
    setConnections(updated);

    // Save to DB
    fetch('/api/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConnection)
    }).catch(err => console.error("Failed to add connection to DB", err));

    setNewUrl('');
    setNewName('');
    setShowAddForm(false);
  };

  // ── Remove connection ──────────────────────────────────────
  const handleRemoveConnection = (id: string) => {
    const updated = connections.filter(c => c.id !== id);
    setConnections(updated);

    // Remove from DB
    fetch(`/api/connections?id=${id}`, {
      method: 'DELETE'
    }).catch(err => console.error("Failed to remove connection from DB", err));
  };

  // ── Download XLSX from a single source ──────────────────────
  const downloadSheet = async (connection: GoogleSheetConnection, addLog: (msg: string) => void): Promise<Uint8Array> => {
    addLog(`Descargando todas las hojas de "${connection.name}" desde Google Sheets...`);

    const res = await fetch(`/api/sheets/download?sheetId=${connection.sheetId}`);

    if (!res.ok) {
      let errorMsg = `Error HTTP ${res.status}`;
      try {
        const errorData = await res.json();
        errorMsg = errorData.error || errorMsg;
      } catch { /* ignore */ }
      throw new Error(errorMsg);
    }

    const arrayBuffer = await res.arrayBuffer();
    addLog(`Archivo XLSX descargado (${(arrayBuffer.byteLength / 1024).toFixed(1)} KB, incluye todas las hojas).`);
    return new Uint8Array(arrayBuffer);
  };

  // ── Sync single source ─────────────────────────────────────
  const syncSingleSource = async (
    connection: GoogleSheetConnection,
    addLog: (msg: string) => void,
    setStep: React.Dispatch<React.SetStateAction<number>>
  ): Promise<LambdaExtractionResponse> => {
    const uint8Array = await downloadSheet(connection, addLog);
    // XLSX export → isCsv = false → Python reads ALL sheets with pd.read_excel(sheet_name=None)
    const data = await codeSteps({ addLog, isCsv: false, uint8Arrays: [uint8Array], setUploadStep: setStep });
    return data;
  };

  // ── Sync all sources ───────────────────────────────────────
  const handleSyncAll = async () => {
    if (connections.length === 0) return;

    setIsSyncing(true);
    setSyncingId(null);
    setSyncStep(0);
    setSyncLogs([]);
    setLastSyncResult(null);

    const logsList: string[] = [];
    const addLog = (msg: string) => {
      const entry = `[${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}] ${msg}`;
      logsList.push(entry);
      setSyncLogs([...logsList]);
    };

    setSyncProgress({ current: 0, total: connections.length });

    const uint8Arrays: Uint8Array[] = [];
    let downloadSuccessCount = 0;

    for (let i = 0; i < connections.length; i++) {
      const conn = connections[i];
      setSyncProgress({ current: i + 1, total: connections.length });
      addLog(`━━━ Descargando Fuente ${i + 1}/${connections.length}: ${conn.name} ━━━`);
      updateConnectionStatus(conn.id, 'syncing');

      try {
        const fileBytes = await downloadSheet(conn, addLog);
        uint8Arrays.push(fileBytes);
        downloadSuccessCount++;
      } catch (err: any) {
        const errMsg = err.message || String(err);
        addLog(`✗ Error descargando "${conn.name}": ${errMsg}`);
        updateConnectionAfterSync(conn.id, 'error', undefined, errMsg);
      }
    }

    if (uint8Arrays.length === 0) {
      addLog(`✗ No se pudo descargar ninguna fuente. Cancelando extracción.`);
      setIsSyncing(false);
      return;
    }

    addLog(`\n━━━ Iniciando motor Python con ${uint8Arrays.length} fuentes consolidadas ━━━`);
    try {
      const data = await codeSteps({ addLog, isCsv: false, uint8Arrays, setUploadStep: setSyncStep });

      if (data.success && data.clients) {
        // Update all connections still in 'syncing' state to 'connected'
        setConnections(prev => {
          const updated = prev.map(c =>
            c.status === 'syncing'
              ? { ...c, status: 'connected' as const, lastSyncAt: new Date().toISOString(), errorMsg: undefined }
              : c
          );
          updated.forEach(c => {
            fetch('/api/connections', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: c.id, status: 'connected', lastSyncAt: new Date().toISOString(), errorMsg: null })
            });
          });
          return updated;
        });

        addLog(`\n═══ Sincronización completa ═══`);
        addLog(`Fuentes procesadas juntas: ${downloadSuccessCount}/${connections.length}`);
        addLog(`Clientes únicos extraídos globalmente: ${data.clients.length}`);

        const summaryStats = {
          totalVolumeKg: data.clients.reduce((sum, c) => sum + (c.lastOrderVolumeKg || 0), 0),
          averageCycleDays: data.clients.reduce((sum, c) => sum + c.averagePurchaseIntervalDays, 0) / data.clients.length,
          mostPopularFlavor: data.clients[0]?.preferredFlavor || 'N/A',
        };
        onExtractionComplete(data.clients, summaryStats, data);

        setLastSyncResult({
          success: true,
          clientCount: data.clients.length,
          sourceCount: downloadSuccessCount,
          rows: data.rowsProcessed
        });
      } else {
        throw new Error('La extracción no produjo resultados válidos.');
      }
    } catch (err: any) {
      const errMsg = err.message || String(err);
      addLog(`✗ Error en la extracción Python: ${errMsg}`);
      setConnections(prev => {
        const updated = prev.map(c =>
          c.status === 'syncing'
            ? { ...c, status: 'error' as const, errorMsg: errMsg }
            : c
        );
        updated.forEach(c => {
          fetch('/api/connections', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: c.id, status: 'error', errorMsg: errMsg })
          });
        });
        return updated;
      });
      setLastSyncResult({ success: false, clientCount: 0, sourceCount: 0, rows: 0 });
    }

    setSyncProgress(null);
    setIsSyncing(false);
  };

  // ── Sync single source (button per connection) ─────────────
  const handleSyncOne = async (connectionId: string) => {
    const conn = connections.find(c => c.id === connectionId);
    if (!conn) return;

    setIsSyncing(true);
    setSyncingId(connectionId);
    setSyncStep(0);
    setSyncLogs([]);
    setLastSyncResult(null);

    const logsList: string[] = [];
    const addLog = (msg: string) => {
      const entry = `[${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}] ${msg}`;
      logsList.push(entry);
      setSyncLogs([...logsList]);
    };

    updateConnectionStatus(conn.id, 'syncing');

    try {
      addLog(`━━━ Sincronizando: ${conn.name} ━━━`);
      const data = await syncSingleSource(conn, addLog, setSyncStep);

      if (data.success && data.clients) {
        updateConnectionAfterSync(conn.id, 'connected', data.rowsProcessed, null);
        addLog(`✓ Sincronización completada: ${data.clients.length} clientes, ${data.rowsProcessed} filas.`);

        onExtractionComplete(data.clients, data.summaryStats, data);

        setLastSyncResult({
          success: true,
          clientCount: data.clients.length,
          sourceCount: 1,
          rows: data.rowsProcessed
        });
      } else {
        throw new Error('La extracción no produjo resultados válidos.');
      }
    } catch (err: any) {
      const errMsg = err.message || String(err);
      addLog(`✗ Error: ${errMsg}`);
      updateConnectionAfterSync(conn.id, 'error', undefined, errMsg);
      setLastSyncResult({ success: false, clientCount: 0, sourceCount: 0, rows: 0 });
    }

    setIsSyncing(false);
    setSyncingId(null);
  };

  // ── Helpers ────────────────────────────────────────────────
  const updateConnectionStatus = (id: string, status: GoogleSheetConnection['status']) => {
    setConnections(prev => {
      const updated = prev.map(c => c.id === id ? { ...c, status } : c);
      return updated;
    });
    fetch('/api/connections', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status })
    }).catch(err => console.error("Failed to update status", err));
  };

  const updateConnectionAfterSync = (
    id: string,
    status: GoogleSheetConnection['status'],
    rowCount?: number,
    errorMsg?: string | null
  ) => {
    const lastSyncAt = status === 'connected' ? new Date().toISOString() : undefined;
    setConnections(prev => {
      const updated = prev.map(c =>
        c.id === id
          ? {
            ...c,
            status,
            lastSyncAt: lastSyncAt ?? c.lastSyncAt,
            rowCount: rowCount ?? c.rowCount,
            errorMsg: errorMsg ?? undefined,
          }
          : c
      );
      return updated;
    });
    fetch('/api/connections', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status, rowCount, errorMsg, lastSyncAt })
    }).catch(err => console.error("Failed to update after sync", err));
  };

  const deduplicateClients = (clients: Client[]): Client[] => {
    const map = new Map<string, Client>();
    for (const client of clients) {
      const key = client?.businessName.toLowerCase().trim();
      const existing = map.get(key);
      if (!existing || (client.lastPurchaseDate > existing.lastPurchaseDate)) {
        map.set(key, client);
      }
    }
    return Array.from(map.values());
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <div id="sheets-manager" className="rounded-lg border border-slate-100 shadow-xs bg-white p-6 flex flex-col gap-4">

      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div>
            <h3 className="font-display text-sm font-semibold text-slate-800">
              Fuentes de datos
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Conecta tus Google Sheets para importar pedidos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {connections.length > 0 && (
            <>
              <button
                id="data-rules-btn"
                onClick={() => setShowDataRulesModal(true)}
                disabled={isSyncing}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 text-[11px] font-semibold transition active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Settings className="h-3 w-3" />
                Modificar datos
              </button>
              <button
                id="sync-all-btn"
                onClick={handleSyncAll}
                disabled={isSyncing}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 text-[11px] font-semibold transition active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`h-3 w-3 ${isSyncing && !syncingId ? 'animate-spin' : ''}`} />
                Sincronizar todo
              </button>
            </>
          )}
          <button
            id="add-source-btn"
            onClick={() => {
              setShowAddForm(!showAddForm);
              setAddError('');
            }}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 text-[11px] font-semibold transition active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {showAddForm ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            {showAddForm ? 'Cancelar' : 'Agregar fuente'}
          </button>
        </div>
      </div>

      {/* Add Connection Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-slate-150 bg-slate-50/50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                <Sheet className="h-3.5 w-3.5 text-emerald-500" />
                Nueva conexión a Google Sheets
              </div>

              <div className="space-y-2">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Nombre descriptivo
                  </label>
                  <input
                    id="new-sheet-name"
                    type="text"
                    placeholder="Ej: Pedidos Junio 2026"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 placeholder-slate-350 focus:outline-none focus:border-slate-400 transition"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    URL del Google Sheet
                  </label>
                  <input
                    id="new-sheet-url"
                    type="url"
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    value={newUrl}
                    onChange={(e) => {
                      setNewUrl(e.target.value);
                      setAddError('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddConnection()}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 placeholder-slate-350 font-mono focus:outline-none focus:border-slate-400 transition"
                  />
                </div>
              </div>

              {addError && (
                <div className="flex items-center gap-1.5 text-[11px] text-red-600 font-medium">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  {addError}
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <p className="text-[9px] text-slate-400 italic max-w-[260px]">
                  La hoja debe estar compartida como &quot;Cualquiera con el enlace&quot;. Se leerán todas las pestañas.
                </p>
                <button
                  id="confirm-add-btn"
                  onClick={handleAddConnection}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-[11px] font-semibold transition active:scale-[0.98] cursor-pointer"
                >
                  <Link2 className="h-3 w-3" />
                  Conectar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connections List */}
      {connections.length === 0 && !showAddForm ? (
        <div className="py-10 text-center">
          <div className="mx-auto h-10 w-10 rounded-lg bg-slate-50 flex items-center justify-center text-slate-300 mb-3">
            <Database className="h-5 w-5" />
          </div>
          <p className="text-xs text-slate-400 font-medium">
            Sin fuentes conectadas
          </p>
          <p className="text-[10px] text-slate-350 mt-1 max-w-[240px] mx-auto">
            Agrega un Google Sheet para importar los pedidos de tus clientes B2B.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {connections.map((conn) => (
            <motion.div
              key={conn.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={`group rounded-xl border p-3.5 transition-all ${conn.status === 'error'
                ? 'border-red-150 bg-red-50/30'
                : conn.status === 'syncing'
                  ? 'border-amber-150 bg-amber-50/20'
                  : 'border-slate-100 bg-white hover:border-slate-200'
                }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Status dot */}
                  <div className="shrink-0">
                    {conn.status === 'syncing' ? (
                      <Loader2 className="h-3.5 w-3.5 text-amber-500 animate-spin" />
                    ) : conn.status === 'error' ? (
                      <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                    ) : (
                      <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-800 truncate">
                        {conn.name}
                      </span>
                      <a
                        href={conn.sheetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-slate-350 hover:text-slate-600 transition shrink-0"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {conn.lastSyncAt ? (
                        <span className="text-[9px] text-slate-400">
                          Sincronizado: {new Date(conn.lastSyncAt).toLocaleString([], {
                            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                          })}
                          {conn.rowCount != null && ` · ${conn.rowCount} filas`}
                        </span>
                      ) : (
                        <span className="text-[9px] text-slate-350 italic">
                          Sin sincronizar aún
                        </span>
                      )}
                      {conn.status === 'error' && conn.errorMsg && (
                        <span className="text-[9px] text-red-500 truncate max-w-[180px]" title={conn.errorMsg}>
                          {conn.errorMsg}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    id={`remove-${conn.id}`}
                    onClick={() => handleRemoveConnection(conn.id)}
                    disabled={isSyncing}
                    title="Eliminar conexión"
                    className="rounded-md border border-slate-150 bg-white hover:bg-red-50 p-1.5 text-slate-400 hover:text-red-500 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Sync Progress View */}
      <AnimatePresence>
        {isSyncing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pt-2">

              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-700">
                    {syncStep === 1 && "Instanciando compilador Python en WebAssembly..."}
                    {syncStep === 2 && "Instalando librería científica Pandas..."}
                    {syncStep === 3 && "Ejecutando predicciones con Pandas (DataFrames)..."}
                    {syncStep === 0 && "Descargando datos de Google Sheets..."}
                  </span>
                  {syncProgress && (
                    <span className="text-[10px] font-mono text-slate-400">
                      Fuente {syncProgress.current}/{syncProgress.total}
                    </span>
                  )}
                </div>
                <div className="h-1 w-full rounded-full bg-slate-100 overflow-hidden">
                  <motion.div
                    initial={{ width: '0%' }}
                    animate={{
                      width: syncStep === 0 ? '10%' : syncStep === 1 ? '30%' : syncStep === 2 ? '60%' : '90%'
                    }}
                    transition={{ duration: 0.3 }}
                    className="h-full bg-slate-800 rounded-full"
                  />
                </div>
              </div>

              {/* Compilation steps */}
              <div className="rounded-xl border border-slate-150 p-4 space-y-2 bg-slate-50/50">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Terminal className="h-3 w-3" />
                  Flujo de Compilación Python-Browser
                </div>

                <div className="flex items-center gap-2 text-[11px]">
                  <span className={`h-1.5 w-1.5 rounded-full ${syncStep >= 1 ? 'bg-emerald-500' : 'bg-slate-350'}`}></span>
                  <span className={syncStep >= 1 ? 'text-slate-700 font-medium' : 'text-slate-400'}>
                    {syncStep >= 1 ? 'Compilador Python 3.11 cargado en WASM' : 'Inicializando compilador Python 3.11...'}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[11px]">
                  <span className={`h-1.5 w-1.5 rounded-full ${syncStep >= 2 ? 'bg-emerald-500' : 'bg-slate-350'}`}></span>
                  <span className={syncStep >= 2 ? 'text-slate-700 font-medium' : 'text-slate-400'}>
                    {syncStep >= 2 ? 'Paquete científico Pandas compilado en navegador' : 'Instalando librería Pandas en el navegador...'}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[11px]">
                  <span className={`h-1.5 w-1.5 rounded-full ${syncStep >= 3 ? 'bg-emerald-500' : 'bg-slate-350'}`}></span>
                  <span className={syncStep >= 3 ? 'text-slate-700 font-medium' : 'text-slate-400'}>
                    {syncStep >= 3 ? 'Análisis de DataFrame y cálculos matemáticos' : 'Asignando variables de DataFrame...'}
                  </span>
                </div>
              </div>

              {/* Log console */}
              {syncLogs.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-900 p-4 text-[10px] text-slate-300 font-mono space-y-1 max-h-40 overflow-y-auto">
                  <p className="text-slate-500 border-b border-slate-800 pb-1 mb-1 font-bold">CONSOLA PYTHON OUTPUT (STDOUT):</p>
                  {syncLogs.map((logStr, i) => (
                    <p
                      key={i}
                      className={
                        logStr.includes('✗') || logStr.includes('[ERROR')
                          ? 'text-red-400 font-bold'
                          : logStr.includes('✓') || logStr.includes('success') || logStr.includes('completada')
                            ? 'text-emerald-400 font-bold'
                            : logStr.includes('━━━')
                              ? 'text-amber-300 font-semibold'
                              : 'text-slate-300'
                      }
                    >
                      {logStr}
                    </p>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success result */}
      <AnimatePresence>
        {lastSyncResult && !isSyncing && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {lastSyncResult.success ? (
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-150 text-xs">
                <div className="flex gap-2.5">
                  <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-slate-800 text-xs font-display">
                      Sincronización completada
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Se procesaron <strong>{lastSyncResult.sourceCount}</strong> fuente{lastSyncResult.sourceCount !== 1 ? 's' : ''}, se extrajeron <strong>{lastSyncResult.clientCount}</strong> clientes únicos y <strong>{lastSyncResult.rows}</strong> pedidos. Las predicciones AFT han sido actualizadas en el CRM.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-red-50 p-4 border border-red-100 text-xs">
                <div className="flex gap-2.5">
                  <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-red-800 text-xs font-display">
                      Error de sincronización
                    </h4>
                    <p className="text-[11px] text-red-600 mt-1">
                      No se pudieron procesar los datos. Revisa la consola para más detalles.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Show logs in collapsible */}
            {syncLogs.length > 0 && (
              <details className="cursor-pointer mt-2">
                <summary className="text-[11px] font-semibold text-slate-500 hover:text-slate-800">Ver terminal del proceso completo</summary>
                <div className="mt-2 rounded-xl border border-slate-200 bg-slate-900 p-3 text-[9px] text-slate-400 font-mono space-y-1 max-h-48 overflow-y-auto">
                  {syncLogs.map((logStr, i) => (
                    <p key={i}>{logStr}</p>
                  ))}
                </div>
              </details>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Data Rules Modal */}
      <AnimatePresence>
        {showDataRulesModal && (
          <DataRulesModal onClose={() => setShowDataRulesModal(false)} />
        )}
      </AnimatePresence>

      {/* Manage Templates Modal */}
      <AnimatePresence>
        {showManageTemplatesModal && (
          <ManageTemplatesModal onClose={() => setShowManageTemplatesModal(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
