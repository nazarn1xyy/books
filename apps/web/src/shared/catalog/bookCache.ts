const DB_NAME = 'flibusta-cache';
const STORE_NAME = 'books';
const VERSION = 1;

let _dbPromise: Promise<IDBDatabase> | null = null;

export interface CachedBook {
    id: string;
    text: string;
    cover: string;
    timestamp: number;
    pdfData?: ArrayBuffer;
    title?: string;
    author?: string;
    series?: string;
    seriesNumber?: number;
    chapters?: { title: string; paragraphIndex: number }[];
}

function openDB(): Promise<IDBDatabase> {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
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
    return _dbPromise;
}

export async function cacheBook(
    id: string,
    text: string,
    cover: string,
    pdfData?: ArrayBuffer,
    meta?: { title?: string; author?: string; series?: string; seriesNumber?: number; chapters?: { title: string; paragraphIndex: number }[] }
): Promise<void> {
    if (!text?.trim() && !pdfData) return; // Don't store empty entries
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
                pdfData,
                ...meta
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

let _cachedIds: Set<string> | null = null;

export async function getCachedBookIds(): Promise<Set<string>> {
    if (_cachedIds) return _cachedIds;
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).getAllKeys();
            req.onsuccess = () => {
                _cachedIds = new Set(req.result as string[]);
                resolve(_cachedIds);
            };
            req.onerror = () => resolve(new Set());
        });
    } catch {
        return new Set();
    }
}

export function markBookCached(id: string) {
    if (_cachedIds) _cachedIds.add(id);
}

export async function isBookCached(id: string): Promise<boolean> {
    const ids = await getCachedBookIds();
    return ids.has(id);
}
