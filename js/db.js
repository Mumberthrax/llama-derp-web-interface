// js/db.js
const DB_NAME = 'chatbot-app';
const DB_VERSION = 1;
const STORE_NAMES = ['conversations', 'characters', 'settings'];

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = req.result;
            STORE_NAMES.forEach(name => {
                if (!db.objectStoreNames.contains(name)) {
                    db.createObjectStore(name, { keyPath: 'id', autoIncrement: name === 'settings' ? false : true });
                }
            });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// Generic put/get/delete/clear for any store
export async function dbPut(store, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).put(value);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function dbGet(store, id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readonly');
        const req = tx.objectStore(store).get(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function dbGetAll(store) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readonly');
        const req = tx.objectStore(store).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function dbDelete(store, id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function dbClear(store) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}
