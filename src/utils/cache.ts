const DB_NAME = 'flibusta-cache';
const STORE_NAME = 'books';
const VERSION = 1;

export interface CachedBook {
    id: string;
    text: string;
    cover: string;
    timestamp: number;
    pdfData?: ArrayBuffer;
}

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, VERSION); // Note: Version bumps handled dynamically if needed, or we just rely on loosely typed store

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
}

export async function cacheBook(id: string, text: string, cover: string, pdfData?: ArrayBuffer): Promise<void> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put({
                id,
                text,
                cover,
                timestamp: Date.now(),
                pdfData
            });

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    } catch (error) {
        console.error('Failed to cache book:', error);
    }
}

export async function getCachedBook(id: string): Promise<CachedBook | undefined> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(id);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    } catch (error) {
        console.error('Failed to get cached book:', error);
        return undefined;
    }
}

export async function clearCache(): Promise<void> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    } catch (error) {
        console.error('Failed to clear cache:', error);
    }
}

export async function isBookCached(id: string): Promise<boolean> {
    try {
        const cached = await getCachedBook(id);
        return !!cached;
    } catch {
        return false;
    }
}
