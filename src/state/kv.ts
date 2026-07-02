// Key-value persistence: IndexedDB when available, localStorage as fallback,
// in-memory as last resort (the session still works; saving is just off —
// docs/ARCHITECTURE.md, error posture). No backend, ever.

export interface KV {
  get<T>(store: string, key: string): Promise<T | null>;
  put<T>(store: string, key: string, value: T): Promise<boolean>;
  del(store: string, key: string): Promise<boolean>;
  keys(store: string): Promise<string[]>;
  /** 'idb' | 'local' | 'memory' — surfaced in settings so the user knows. */
  readonly backend: string;
}

const DB_NAME = 'kido';
const DB_VERSION = 1;
export const STORES = ['topics', 'settings'] as const;

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      for (const s of STORES) {
        if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

function idbKV(db: IDBDatabase): KV {
  const tx = <T>(store: string, mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest): Promise<T | null> =>
    new Promise((resolve) => {
      try {
        const t = db.transaction(store, mode);
        const req = op(t.objectStore(store));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  return {
    backend: 'idb',
    get: <T>(store: string, key: string) => tx<T>(store, 'readonly', (s) => s.get(key)),
    put: async (store, key, value) => (await tx(store, 'readwrite', (s) => s.put(value, key))) !== null || true,
    del: async (store, key) => (await tx(store, 'readwrite', (s) => s.delete(key))) !== null || true,
    keys: async (store) => ((await tx<IDBValidKey[]>(store, 'readonly', (s) => s.getAllKeys())) ?? []).map(String),
  };
}

function localKV(): KV {
  const k = (store: string, key: string) => `kido:${store}:${key}`;
  return {
    backend: 'local',
    get: async <T>(store: string, key: string) => {
      try {
        const raw = localStorage.getItem(k(store, key));
        return raw ? (JSON.parse(raw) as T) : null;
      } catch {
        return null;
      }
    },
    put: async (store, key, value) => {
      try {
        localStorage.setItem(k(store, key), JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
    del: async (store, key) => {
      try {
        localStorage.removeItem(k(store, key));
        return true;
      } catch {
        return false;
      }
    },
    keys: async (store) => {
      const prefix = `kido:${store}:`;
      const out: string[] = [];
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith(prefix)) out.push(key.slice(prefix.length));
        }
      } catch {
        /* saving off */
      }
      return out;
    },
  };
}

export function memoryKV(): KV {
  const mem = new Map<string, unknown>();
  const k = (store: string, key: string) => `${store}:${key}`;
  return {
    backend: 'memory',
    get: async <T>(store: string, key: string) => (mem.get(k(store, key)) as T | undefined) ?? null,
    put: async (store, key, value) => (mem.set(k(store, key), value), true),
    del: async (store, key) => (mem.delete(k(store, key)), true),
    keys: async (store) =>
      [...mem.keys()].filter((key) => key.startsWith(`${store}:`)).map((key) => key.slice(store.length + 1)),
  };
}

let instance: KV | null = null;

/** The app's KV store. Resolution order: IndexedDB → localStorage → memory. */
export async function getKV(): Promise<KV> {
  if (instance) return instance;
  const db = await openDb();
  if (db) instance = idbKV(db);
  else if (typeof localStorage !== 'undefined') instance = localKV();
  else instance = memoryKV();
  return instance;
}

/** Test hook. */
export function setKV(kv: KV | null): void {
  instance = kv;
}
