"use client"

import { useState } from "react";
import { LambdaExtractionResponse, Client } from "../types/types";
import { pythonProgram } from "../utils/extractData";

// Define the type for the callback function for clarity
export type OnExtractionComplete = (newClients: Client[], summary: any) => void;

// The arguments for our async extraction function
interface StartExtractionArgs {
    uint8Array: Uint8Array;
    isCsv: boolean;
    onExtractionComplete: OnExtractionComplete;
}

// This is the custom hook. It is NOT async.
// It manages the state and exposes a function to trigger the process.
export const useExtraction = () => {
    const [uploading, setUploading] = useState(false);
    const [uploadStep, setUploadStep] = useState<number>(0); // 0 = ready, 1 = loading compiler, 2 = loading pandas, 3 = processing, 4 = success
    const [response, setResponse] = useState<LambdaExtractionResponse | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [pyodideLogs, setPyodideLogs] = useState<string[]>([]);

    // This is the async function that will be called to start the process.
    // It has access to the state setters from the hook's scope.
    const startExtraction = async ({ uint8Array, isCsv, onExtractionComplete }: StartExtractionArgs) => {
        // Reset state for a new run
        setUploading(true);
        setErrorMsg('');
        setPyodideLogs([]);
        setResponse(null);
        setUploadStep(0);

        const addLog = (msg: string) => {
            console.log(`[Pyodide Pandas Engine] ${msg}`);
            const newLog = `[${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}] ${msg}`;
            // Use functional update to prevent issues with stale state
            setPyodideLogs(prevLogs => [...prevLogs, newLog]);
        };

        try {
            addLog("Detectando motor Pyodide (WASM)...");
            setUploadStep(1); // Step 1: Loading WASM compiler

            if (!(window as any).loadPyodide) {
                addLog("Inyectando script de inicialización de Pyodide CDN...");
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js';
                    script.onload = () => resolve(true);
                    script.onerror = (e) => reject(new Error("No se pudo descargar el script de Pyodide CDN."));
                    document.head.appendChild(script);
                });
            }

            addLog("Instanciando compilador Python en WebAssembly (esto toma ~1-2 segundos)...");
            const pyRuntime = await (window as any).loadPyodide({
                indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/"
            });
            addLog("¡Compilador de Python 3.11 inicializado correctamente!");

            setUploadStep(2); // Step 2: Loading scientific libraries
            addLog("Descargando e importando la librería Pandas...");
            await pyRuntime.loadPackage("pandas");
            addLog("¡Librería científica Pandas cargada con éxito!");

            addLog("Cargando instalador de paquetes de Python (micropip)...");
            await pyRuntime.loadPackage("micropip");
            const micropip = pyRuntime.pyimport("micropip");

            addLog("Descargando e instalando 'openpyxl' (lector de Excel)...");
            await micropip.install("openpyxl");
            addLog("¡Librería 'openpyxl' instalada correctamente!");

            setUploadStep(3); // Step 3: Analysis and Projections
            addLog("Transfiriendo archivo binario como bytes de memoria a Python...");
            pyRuntime.globals.set("excel_bytes", uint8Array);
            pyRuntime.globals.set("is_csv", isCsv);

            addLog("Ejecutando script de Pandas para saneamiento, mapeo y correspondencia difusa...");
            const pyResultJsonStr = await pyRuntime.runPythonAsync(pythonProgram);
            const data: LambdaExtractionResponse = JSON.parse(pyResultJsonStr);
            addLog(`¡Extracción completada! Python Pandas procesó ${data.rowsProcessed} filas.`);
            
            if (data.success) {
                addLog("Enviando registros procesados para guardado persistente...");
                // Using relative path for API calls in Next.js
                const bulkRes = await fetch('/api/clients/bulk-import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ clients: data.clients })
                });

                if (!bulkRes.ok) {
                    const errorData = await bulkRes.json().catch(() => ({ error: 'Error desconocido en el servidor.' }));
                    throw new Error(errorData.error || `Error del servidor: ${bulkRes.statusText}`);
                }

                const bulkData = await bulkRes.json();

                if (bulkData.success) {
                    addLog("¡Sincronización masiva con CRM completada con éxito!");
                    setResponse(data);
                    setUploadStep(4); // Success
                    onExtractionComplete(data.clients, data.summaryStats);
                } else {
                    throw new Error(bulkData.error || "No se pudo realizar el bulk-import en el backend.");
                }
            } else {
                throw new Error("El script de Python falló en procesar los datos.");
            }

        } catch (err: any) {
            console.error(err);
            const errorMessage = err.message || String(err);
            addLog(`[ERROR FATAL] ${errorMessage}`);
            setErrorMsg(`Error procesando con Python/Pandas: ${errorMessage}`);
            setUploadStep(0); // Reset to ready state on error
        } finally {
            setUploading(false); // Ensure uploading is set to false after completion or error
        }
    };

    // Return all the state values and the function to trigger the process
    return {
        uploading,
        uploadStep,
        response,
        errorMsg,
        pyodideLogs,
        startExtraction
    };
};
