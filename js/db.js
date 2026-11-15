// A tiny key-value store on IndexedDB, used for data that can outgrow localStorage (transactions).
// Everything stays in this browser. Rejects when IndexedDB is missing or blocked; the caller copes.
const NAME = 'money-dashboard', STORE = 'kv';
let opening = null;

function open() {
  if (!globalThis.indexedDB) return Promise.reject(new Error('no IndexedDB'));
  if (!opening) {
    opening = new Promise((resolve, reject) => {
      const req = globalThis.indexedDB.open(NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => { req.result.onversionchange = () => { req.result.close(); opening = null; }; resolve(req.result); };
      req.onerror = () => reject(req.error || new Error('IndexedDB failed'));
      req.onblocked = () => reject(new Error('IndexedDB blocked'));
    }).catch((e) => { opening = null; throw e; });
  }
  return opening;
}

export async function get(key) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function set(key, value) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(tx.error || new Error('IndexedDB write failed'));
  });
}
