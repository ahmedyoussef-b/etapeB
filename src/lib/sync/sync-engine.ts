import { IndexedDBAdapter } from '@/lib/database/indexeddb-adapter';
import { SyncOperation, EntityType, OperationType, SyncQueueStats, ConflictResolution } from './sync-types';
import { isTauriEnv } from '@/lib/tauri/env';

export class SyncEngine {
  private indexedDb: IndexedDBAdapter;
  private isOnline: boolean = navigator.onLine;
  private isSyncing: boolean = false;
  private listeners: Set<(stats: SyncQueueStats) => void> = new Set();

  constructor(indexedDb: IndexedDBAdapter) {
    this.indexedDb = indexedDb;
    if (typeof window !== 'undefined') {
      this.setupOnlineListeners();
      this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : false;
    }
  }

  private setupOnlineListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  getStatus(): { online: boolean; syncing: boolean } {
    return {
      online: this.isOnline,
      syncing: this.isSyncing,
    };
  }

  async enqueue(operation: Omit<SyncOperation, 'id' | 'timestamp' | 'status' | 'retryCount'>): Promise<string> {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const fullOperation: SyncOperation = {
      ...operation,
      id,
      timestamp: Date.now(),
      status: 'PENDING',
      retryCount: 0,
    };

    await this.indexedDb.save('operations', fullOperation);
    this.notifyListeners();

    if (this.isOnline) {
      this.processQueue();
    }

    return id;
  }

  async processQueue(): Promise<{ pushed: number; conflicts: number; errors: number }> {
    if (this.isSyncing || !this.isOnline) {
      return { pushed: 0, conflicts: 0, errors: 0 };
    }

    this.isSyncing = true;
    const pending = await this.indexedDb.findByIndex<SyncOperation>('operations', 'status', 'PENDING');

    let pushed = 0;
    let conflicts = 0;
    let errors = 0;

    for (const operation of pending) {
      try {
        const success = await this.pushOperation(operation);
        if (success) {
          operation.status = 'SYNCED';
          await this.indexedDb.save('operations', operation);
          pushed++;
        } else {
          operation.retryCount++;
          if (operation.retryCount >= 3) {
            operation.status = 'CONFLICT';
            operation.lastError = 'Max retries exceeded';
            await this.indexedDb.save('operations', operation);
            conflicts++;
          }
        }
      } catch (error) {
        errors++;
      }
    }

    this.isSyncing = false;
    this.notifyListeners();

    return { pushed, conflicts, errors };
  }

  private async pushOperation(operation: SyncOperation): Promise<boolean> {
    if (isTauriEnv()) {
      return true;
    }

    try {
      const response = await fetch('/api/sync/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: operation.type,
          entity: operation.entity,
          entityId: operation.entityId,
          data: operation.data,
        }),
      });

      if (!response.ok) {
        if (response.status === 409) {
          const conflictData = await response.json().catch(() => ({}));
          await this.resolveConflict(operation, conflictData);
          return true;
        }
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  private async resolveConflict(operation: SyncOperation, remoteData: any): Promise<void> {
    const finalData = operation.data;

    const updatedOperation: SyncOperation = {
      ...operation,
      data: finalData,
      status: 'SYNCED',
      lastError: `Conflict resolved with LOCAL_WINS`,
    };

    await this.indexedDb.save('operations', updatedOperation);

    await this.indexedDb.save('entities', {
      id: operation.entityId,
      entity: operation.entity,
      data: finalData,
      updatedAt: Date.now(),
      synced: true,
    });
  }

  async pull(): Promise<{ pulled: number; errors: number }> {
    if (isTauriEnv() || !this.isOnline) {
      return { pulled: 0, errors: 0 };
    }

    try {
      const response = await fetch('/api/sync/pull');
      if (!response.ok) {
        return { pulled: 0, errors: 1 };
      }

      const result = await response.json();
      const items = result.data || [];

      for (const item of items) {
        await this.indexedDb.save('entities', {
          id: item.id,
          entity: item.entity,
          data: item.data,
          updatedAt: item.updatedAt || Date.now(),
          synced: true,
        });
      }

      this.notifyListeners();
      return { pulled: items.length, errors: 0 };
    } catch {
      return { pulled: 0, errors: 1 };
    }
  }

  async getStats(): Promise<SyncQueueStats> {
    const pending = await this.indexedDb.findByIndex<SyncOperation>('operations', 'status', 'PENDING');
    const synced = await this.indexedDb.findByIndex<SyncOperation>('operations', 'status', 'SYNCED');
    const conflicts = await this.indexedDb.findByIndex<SyncOperation>('operations', 'status', 'CONFLICT');

    return {
      pending: pending.length,
      synced: synced.length,
      conflicts: conflicts.length,
      total: pending.length + synced.length + conflicts.length,
    };
  }

  async getLocalEntities(entity?: EntityType): Promise<any[]> {
    const items = await this.indexedDb.findAll<any>('entities');
    return entity ? items.filter((item) => item.entity === entity) : items;
  }

  async saveLocalEntity(entity: EntityType, id: string, data: any): Promise<void> {
    await this.indexedDb.save('entities', {
      id,
      entity,
      data,
      updatedAt: Date.now(),
      synced: false,
    });
  }

  onStatsChange(listener: (stats: SyncQueueStats) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.getStats().then((stats) => {
      this.listeners.forEach((listener) => listener(stats));
    });
  }

  async sync(): Promise<{ pulled: number; pushed: number; conflicts: number }> {
    const pullResult = await this.pull();
    const pushResult = await this.processQueue();

    return {
      pulled: pullResult.pulled,
      pushed: pushResult.pushed,
      conflicts: pushResult.conflicts,
    };
  }
}
