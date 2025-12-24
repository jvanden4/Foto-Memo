import { MapItem } from '../types';

const DB_NAME = 'MapExplorerDB';
const STORE_NAME = 'files';

export interface StoredFile {
  id: string;
  buffer: ArrayBuffer;
  fileType: string; // MIME type
  meta: Omit<MapItem, 'previewUrl'>;
}

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2); 
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      } else {
          // If needed, handle schema upgrades here
      }
    };
  });
};

export const upsertFilesToDB = async (items: StoredFile[]) => {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    let processedCount = 0;

    if (items.length === 0) {
        resolve();
        return;
    }

    items.forEach(newItem => {
        const request = store.get(newItem.id);
        request.onsuccess = () => {
            const existingItem = request.result as StoredFile | undefined;
            
            if (existingItem) {
                // Critical: Preserve user-defined metadata if file already exists
                newItem.meta.category = existingItem.meta.category;
                newItem.meta.customName = existingItem.meta.customName;
            }
            
            // Put the item (updates if exists, adds if not)
            store.put(newItem);
            
            processedCount++;
            if (processedCount === items.length) {
                // All operations queued
            }
        };
        request.onerror = () => {
             console.error("Error reading item during upsert", newItem.id);
             // Try to put anyway? Safe to ignore for now
             processedCount++;
        }
    });

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const updateFileMetadata = async (id: string, updates: Partial<MapItem>) => {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      const data: StoredFile = request.result;
      if (data) {
        // Update metadata
        data.meta = { ...data.meta, ...updates };
        store.put(data);
      }
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const deleteFilesFromDB = async (ids: string[]) => {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    ids.forEach(id => {
      store.delete(id);
    });

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const loadFilesFromDB = async (): Promise<StoredFile[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};