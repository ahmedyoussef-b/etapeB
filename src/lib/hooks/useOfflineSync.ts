import { useState, useEffect, useCallback, useRef } from 'react';
import { SyncEngine } from '@/lib/sync/sync-engine';
import { IndexedDBAdapter } from '@/lib/database/indexeddb-adapter';
import { EntityType, OperationType } from '@/lib/sync/sync-types';

let sharedEngine: SyncEngine | null = null;
let sharedAdapter: IndexedDBAdapter | null = null;

export function getSyncEngine(): SyncEngine {
  if (!sharedEngine) {
    if (!sharedAdapter) {
      sharedAdapter = new IndexedDBAdapter();
    }
    sharedEngine = new SyncEngine(sharedAdapter);
  }
  return sharedEngine;
}

export interface UseOfflineSyncOptions {
  entities?: EntityType[];
  autoSync?: boolean;
  syncInterval?: number;
}

export interface UseOfflineSyncResult {
  status: { online: boolean; syncing: boolean };
  stats: { pending: number; synced: number; conflicts: number; total: number };
  enqueue: (operation: { type: OperationType; entity: EntityType; entityId: string; data: any }) => Promise<string>;
  sync: () => Promise<{ pulled: number; pushed: number; conflicts: number }>;
  getLocalEntities: (entity?: EntityType) => Promise<any[]>;
  saveLocalEntity: (entity: EntityType, id: string, data: any) => Promise<void>;
  lastSync: { pulled: number; pushed: number; conflicts: number } | null;
}

export function useOfflineSync(options: UseOfflineSyncOptions = {}): UseOfflineSyncResult {
  const { autoSync = true, syncInterval = 30000 } = options;
  const engineRef = useRef<SyncEngine | null>(null);
  const initializedRef = useRef(false);

  const [status, setStatus] = useState<{ online: boolean; syncing: boolean }>({ online: navigator.onLine, syncing: false });
  const [stats, setStats] = useState<{ pending: number; synced: number; conflicts: number; total: number }>({ pending: 0, synced: 0, conflicts: 0, total: 0 });
  const [lastSync, setLastSync] = useState<{ pulled: number; pushed: number; conflicts: number } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const engine = getSyncEngine();
    engineRef.current = engine;

    initializedRef.current = true;
    engine.getStats().then(setStats);

    const unsubscribe = engine.onStatsChange(setStats);

    const handleOnline = () => setStatus((s) => ({ ...s, online: true }));
    const handleOffline = () => setStatus((s) => ({ ...s, online: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    let intervalId: ReturnType<typeof setInterval> | null = null;
    if (autoSync && syncInterval > 0) {
      intervalId = setInterval(() => {
        if (navigator.onLine) {
          engine.sync().then((result) => setLastSync(result));
        }
      }, syncInterval);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
      if (intervalId) clearInterval(intervalId);
    };
  }, [autoSync, syncInterval]);

  const enqueue = useCallback(async (operation: { type: OperationType; entity: EntityType; entityId: string; data: any }) => {
    if (!engineRef.current || !initializedRef.current) {
      throw new Error('Sync engine not initialized');
    }
    return engineRef.current.enqueue(operation);
  }, []);

  const sync = useCallback(async () => {
    if (!engineRef.current || !initializedRef.current) {
      return { pulled: 0, pushed: 0, conflicts: 0 };
    }

    setStatus((s) => ({ ...s, syncing: true }));
    const result = await engineRef.current.sync();
    setLastSync(result);
    setStatus((s) => ({ ...s, syncing: false }));

    return result;
  }, []);

  const getLocalEntities = useCallback(async (entity?: EntityType) => {
    if (!engineRef.current || !initializedRef.current) {
      return [];
    }
    return engineRef.current.getLocalEntities(entity);
  }, []);

  const saveLocalEntity = useCallback(async (entity: EntityType, id: string, data: any) => {
    if (!engineRef.current || !initializedRef.current) {
      throw new Error('Sync engine not initialized');
    }
    return engineRef.current.saveLocalEntity(entity, id, data);
  }, []);

  return {
    status,
    stats,
    enqueue,
    sync,
    getLocalEntities,
    saveLocalEntity,
    lastSync,
  };
}
