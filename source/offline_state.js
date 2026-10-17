// Offline "last-seen" store — a tiny, dependency-free IndexedDB key/value store.
//
// We persist the last state each scooter reported so the UI can still show it
// when we are not connected to the scooter. IndexedDB structured-clones values,
// so numbers, strings, booleans, plain objects and Uint8Array all round-trip
// unchanged — no manual JSON encoding needed.
//
// This is deliberately the same minimal SimpleKVStore pattern used by the
// (GPL) pwa-player project, kept here so the PWA pulls in no extra dependency.

class SimpleKVStore {
  constructor(dbName = "escooter-state", storeName = "last_seen", version = 1) {
    this.dbName = dbName;
    this.storeName = storeName;
    this.version = version;
    this.db = null;
  }

  init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };

      request.onsuccess = e => {
        this.db = e.target.result;
        resolve(this);
      };

      request.onerror = e => reject(e.target.error);
    });
  }

  set(key, value) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, "readwrite");
      tx.objectStore(this.storeName).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = e => reject(e.target.error);
    });
  }

  get(key) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, "readonly");
      const request = tx.objectStore(this.storeName).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = e => reject(e.target.error);
    });
  }

  delete(key) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, "readwrite");
      tx.objectStore(this.storeName).delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = e => reject(e.target.error);
    });
  }
}

const _kvStore = new SimpleKVStore("escooter-state", "last_seen");
let _kvReady = null;

function _kv() {
  if (!_kvReady) _kvReady = _kvStore.init();
  return _kvReady;
}

// Public API. If IndexedDB is unavailable, get resolves undefined and set/delete
// resolve false, so callers can simply ignore failures.
async function lastSeen_get(key) {
  try { return await (await _kv()).get(key); } catch (_) { return undefined; }
}

async function lastSeen_set(key, value) {
  try { await (await _kv()).set(key, value); return true; } catch (_) { return false; }
}

async function lastSeen_delete(key) {
  try { await (await _kv()).delete(key); return true; } catch (_) { return false; }
}
