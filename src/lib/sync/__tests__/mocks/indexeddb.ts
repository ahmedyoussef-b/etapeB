import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockIDBFactory = () => {
  const stores: Record<string, Map<string, any>> = {};
  const listeners: Record<string, Set<(event: any) => void>> = {};

  const createStore = (name: string) => {
    if (!stores[name]) {
      stores[name] = new Map();
      listeners[name] = new Set();
    }
    return stores[name];
  };

  return {
    open: (dbName: string, version: number) => {
      const request: any = {
        result: {
          transaction: (storeName: string, mode: string) => {
            const store = createStore(storeName);
            return {
              objectStore: (name: string) => ({
                put: (data: any) => {
                  store.set(data.id, data);
                  return { result: data.id, onsuccess: null, onerror: null };
                },
                get: (id: string) => {
                  const data = store.get(id);
                  return { result: data, onsuccess: null, onerror: null };
                },
                delete: (id: string) => {
                  store.delete(id);
                  return { result: undefined, onsuccess: null, onerror: null };
                },
                clear: () => {
                  store.clear();
                  return { result: undefined, onsuccess: null, onerror: null };
                },
                getAll: () => {
                  return { result: Array.from(store.values()), onsuccess: null, onerror: null };
                },
                count: () => {
                  return { result: store.size, onsuccess: null, onerror: null };
                },
                index: (name: string) => ({
                  getAll: (value: any) => {
                    const results = Array.from(store.values()).filter((item: any) => item[name] === value);
                    return { result: results, onsuccess: null, onerror: null };
                  },
                }),
              }),
              oncomplete: null,
              onerror: null,
            };
          },
          onsuccess: null,
          onerror: null,
        },
      };

      return request;
    },
  };
};

(globalThis as any).indexedDB = {
  open: mockIDBFactory().open,
};

(globalThis as any).IDBKeyRange = {};
