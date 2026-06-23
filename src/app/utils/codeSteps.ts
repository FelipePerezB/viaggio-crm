import { LambdaExtractionResponse } from "../types/types";
import { pythonProgram } from "./extractData";

export const codeSteps = async ({ addLog, setUploadStep, uint8Arrays, isCsv }: { addLog: (msg: string) => void, setUploadStep: React.Dispatch<React.SetStateAction<number>>, uint8Arrays: Uint8Array[], isCsv: boolean }) => {
    addLog("Detectando motor Pyodide (WASM)...");
    setUploadStep(1); // Paso 1: Iniciando compilador WASM

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

    setUploadStep(2); // Paso 2: Descargando librerías científicas
    addLog("Descargando e importando la librería Pandas...");
    await pyRuntime.loadPackage("pandas");
    addLog("¡Librería Pandas cargada con éxito!");

    addLog("Cargando instalador de paquetes de Python (micropip)...");
    await pyRuntime.loadPackage("micropip");
    const micropip = pyRuntime.pyimport("micropip");

    addLog("Descargando e instalando 'openpyxl' (lectura Excel de Excel de Windows y Mac)...");
    await micropip.install("openpyxl");
    addLog("¡Librería 'openpyxl' instalada correctamente!");

    setUploadStep(3); // Paso 3: Análisis y Proyecciones con Pandas
    addLog("Transfiriendo archivos binarios de excel como bytes de memoria a Python...");
    pyRuntime.globals.set("excel_bytes_list", pyRuntime.toPy(uint8Arrays));
    pyRuntime.globals.set("is_csv", isCsv);

    addLog("Consultando clientes en la base de datos...");
    try {
        const clientsRes = await fetch('/api/clients');
        const clientsData = await clientsRes.json();
        if (clientsData.success && clientsData.clients) {
            const dbClientsList = clientsData.clients.map((c: any) => c.name);
            pyRuntime.globals.set("db_clients_list", pyRuntime.toPy(dbClientsList));
            addLog(`Se inyectaron ${dbClientsList.length} clientes desde la base de datos.`);
        }
    } catch (e) {
        addLog("No se pudo obtener la lista de clientes de la base de datos, usando lista vacía.");
    }

    addLog("Cargando reglas de transformación de datos del usuario...");
    try {
        const rulesRes = await fetch('/api/data-rules');
        const rulesData = await rulesRes.json();
        if (rulesData.success && rulesData.rules) {
            pyRuntime.globals.set("user_data_rules", pyRuntime.toPy(rulesData.rules));
            addLog(`Se inyectaron ${rulesData.rules.length} reglas de transformación.`);
        }
    } catch (e) {
        addLog("No se pudieron cargar reglas de transformación, usando valores por defecto.");
    }


    addLog("Extrayendo datos...");
    const pyResultJsonStr = await pyRuntime.runPythonAsync(pythonProgram);


    console.log(pyResultJsonStr)
    addLog("Calculando variables explicativas...");

    const data: LambdaExtractionResponse = JSON.parse(pyResultJsonStr);
    addLog(`¡Extracción completada con éxito! Python Pandas procesó ${data.rowsProcessed} filas consolidadas.`);

    return data
}