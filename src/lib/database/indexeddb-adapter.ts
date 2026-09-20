const DB_NAME = 'nexaflow-offline';
const DB_VERSION = 1;

type StoreName = 'operations' | 'entities' | 'metadata';

const STORES: StoreName[] = ['operations', 'entities', 'metadata'];

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      STORES.forEach((storeName) => {
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, { keyPath: 'id' });
          if (storeName === 'operations') {
            store.createIndex('status', 'status', { unique: false });
            store.createIndex('entity', 'entity', { unique: false });
            store.createIndex('timestamp', 'timestamp', { unique: false });
          }
          if (storeName === 'entities') {
            store.createIndex('entity', 'entity', { unique: false });
            store.createIndex('updatedAt', 'updatedAt', { unique: false });
          }
        }
      });
    };
  });
}

export class IndexedDBAdapter {
  private db: IDBDatabase | null = null;

  async connect(): Promise<void> {
    if (this.db) return;
    this.db = await openDatabase();
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  private async getStore(storeName: StoreName, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
    if (!this.db) await this.connect();
    const transaction = this.db!.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  async save<T extends { id: string }>(storeName: StoreName, data: T): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite');
    await new Promise<void>((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async saveMany<T extends { id: string }>(storeName: StoreName, items: T[]): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite');
    await new Promise<void>((resolve, reject) => {
      const transaction = store.transaction;
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      items.forEach((item) => store.put(item));
    });
  }

  async findAll<T>(storeName: StoreName): Promise<T[]> {
    const store = await this.getStore(storeName);
    return new Promise<T[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
    });
  }

  async findById<T>(storeName: StoreName, id: string): Promise<T | null> {
    const store = await this.getStore(storeName);
    return new Promise<T | null>((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve((request.result as T) ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async findByIndex<T>(storeName: StoreName, indexName: string, value: any): Promise<T[]> {
    const store = await this.getStore(storeName);
    const index = store.index(indexName);
    return new Promise<T[]>((resolve, reject) => {
      const request = index.getAll(value);
      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName: StoreName, id: string): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite');
    await new Promise<void>((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteMany(storeName: StoreName, ids: string[]): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite');
    await new Promise<void>((resolve, reject) => {
      const transaction = store.transaction;
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      ids.forEach((id) => store.delete(id));
    });
  }

  async clear(storeName: StoreName): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite');
    await new Promise<void>((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async count(storeName: StoreName): Promise<number> {
    const store = await this.getStore(storeName);
    return new Promise<number>((resolve, reject) => {
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}
