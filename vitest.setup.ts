const stores: Record<string, Map<string, any>> = {};

const createStore = (name: string) => {
  if (!stores[name]) {
    stores[name] = new Map();
  }
  return stores[name];
};

const createIDBRequest = (data: any) => {
  const request: any = {
    result: data,
    onsuccess: null as any,
    onerror: null as any,
    ready: false,
  };

  setTimeout(() => {
    request.ready = true;
    if (request.onsuccess) {
      request.onsuccess({ target: request });
    }
  }, 0);

  return request;
};

const createIDBTransaction = (storeName: string) => {
  const store = createStore(storeName);
  return {
    objectStore: (name: string) => ({
      put: (data: any) => {
        store.set(data.id, data);
        return createIDBRequest(data.id);
      },
      get: (id: string) => {
        const data = store.get(id);
        return createIDBRequest(data);
      },
      delete: (id: string) => {
        store.delete(id);
        return createIDBRequest(undefined);
      },
      clear: () => {
        store.clear();
        return createIDBRequest(undefined);
      },
      getAll: () => {
        return createIDBRequest(Array.from(store.values()));
      },
      count: () => {
        return createIDBRequest(store.size);
      },
      index: (name: string) => ({
        getAll: (value: any) => {
          const results = Array.from(store.values()).filter((item: any) => item[name] === value);
          return createIDBRequest(results);
        },
      }),
    }),
    oncomplete: null as any,
    onerror: null as any,
  };
};

(globalThis as any).indexedDB = {
  open: (dbName: string, version: number) => {
    const request: any = {
      result: {
        transaction: (storeName: string, mode: string) => {
          return createIDBTransaction(storeName);
        },
        onsuccess: null,
        onerror: null,
      },
    };

    return request;
  },
};

(globalThis as any).IDBKeyRange = {};
