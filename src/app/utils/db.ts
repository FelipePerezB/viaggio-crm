import { Client } from '../types/types';

const DB_NAME = 'viaggio-db';
const DB_VERSION = 2; // Bump version para guardar orders
const STORE_NAME = 'clients';
const ORDERS_STORE_NAME = 'orders';

export const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(ORDERS_STORE_NAME)) {
        db.createObjectStore(ORDERS_STORE_NAME, { autoIncrement: true });
      }
    };
  });
};

export const saveClientsToDB = async (clients: Client[]) => {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    // Limpiar clientes existentes antes de insertar la nueva iteración
    const clearRequest = store.clear();
    clearRequest.onerror = () => reject(clearRequest.error);
    
    clearRequest.onsuccess = () => {
      clients.forEach(client => {
        if (client.id) {
          store.put(client);
        }
      });
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const loadClientsFromDB = async (): Promise<Client[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
};

export const saveOrdersToDB = async (orders: any[]) => {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(ORDERS_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(ORDERS_STORE_NAME);
    const clearRequest = store.clear();
    clearRequest.onerror = () => reject(clearRequest.error);
    clearRequest.onsuccess = () => {
      orders.forEach(order => store.put(order));
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const loadOrdersFromDB = async (): Promise<any[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ORDERS_STORE_NAME, 'readonly');
    const store = transaction.objectStore(ORDERS_STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
};
