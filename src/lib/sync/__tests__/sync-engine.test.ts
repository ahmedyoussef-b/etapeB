import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncEngine } from '@/lib/sync/sync-engine';

vi.mock('@/lib/database/indexeddb-adapter', () => {
  const stores: Record<string, Map<string, any>> = {};

  const getStore = (name: string) => {
    if (!stores[name]) stores[name] = new Map();
    return stores[name];
  };

  return {
    IndexedDBAdapter: class MockIndexedDBAdapter {
      async connect() {}
      async disconnect() {}
      async save(storeName: string, item: any) { getStore(storeName).set(item.id, item); }
      async saveMany(storeName: string, items: any[]) { items.forEach(item => getStore(storeName).set(item.id, item)); }
      async findAll(storeName: string) { return Array.from(getStore(storeName).values()); }
      async findById(storeName: string, id: string) { return getStore(storeName).get(id) ?? null; }
      async findByIndex(storeName: string, indexName: string, value: any) {
        return Array.from(getStore(storeName).values()).filter((item: any) => item[indexName] === value);
      }
      async delete(storeName: string, id: string) { getStore(storeName).delete(id); }
      async deleteMany(storeName: string, ids: string[]) { ids.forEach(id => getStore(storeName).delete(id)); }
      async clear(storeName: string) { getStore(storeName).clear(); }
      async count(storeName: string) { return getStore(storeName).size; }
    },
  };
});

describe('SyncEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should enqueue an operation', async () => {
    const { IndexedDBAdapter } = await import('@/lib/database/indexeddb-adapter');
    const adapter = new IndexedDBAdapter();
    await adapter.connect();
    const engine = new SyncEngine(adapter);

    const id = await engine.enqueue({
      type: 'CREATE',
      entity: 'procedures',
      entityId: 'proc-1',
      data: { id: 'proc-1', title: 'Test Procedure' },
    });

    expect(id).toBeDefined();
    const stats = await engine.getStats();
    expect(stats.pending).toBeGreaterThanOrEqual(1);
  });

  it('should save and retrieve local entities', async () => {
    const { IndexedDBAdapter } = await import('@/lib/database/indexeddb-adapter');
    const adapter = new IndexedDBAdapter();
    await adapter.connect();
    const engine = new SyncEngine(adapter);

    await engine.saveLocalEntity('procedures', 'proc-1', { id: 'proc-1', title: 'Test' });

    const entities = await engine.getLocalEntities('procedures');
    expect(entities).toHaveLength(1);
    expect(entities[0].data.title).toBe('Test');
  });

  it('should report online status', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: true },
      writable: true,
      configurable: true,
    });
    const { IndexedDBAdapter } = await import('@/lib/database/indexeddb-adapter');
    const adapter = new IndexedDBAdapter();
    await adapter.connect();
    const engine = new SyncEngine(adapter);

    const status = engine.getStatus();
    expect(status).toHaveProperty('online');
    expect(status).toHaveProperty('syncing');
    expect(typeof status.online).toBe('boolean');
  });

  it('should listen to stats changes', async () => {
    const { IndexedDBAdapter } = await import('@/lib/database/indexeddb-adapter');
    const adapter = new IndexedDBAdapter();
    await adapter.connect();
    const engine = new SyncEngine(adapter);

    const listener = vi.fn();
    const unsubscribe = engine.onStatsChange(listener);

    await engine.enqueue({
      type: 'CREATE',
      entity: 'procedures',
      entityId: 'proc-2',
      data: { id: 'proc-2', title: 'Test 2' },
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(listener).toHaveBeenCalled();

    unsubscribe();
  });
});
