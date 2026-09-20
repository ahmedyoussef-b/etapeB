'use client';

import { useState, useEffect, useCallback } from 'react';
import { useOfflineSync } from './useOfflineSync';
import { EntityType, OperationType } from '@/lib/sync/sync-types';

export interface OfflineEntityOptions {
  entity: EntityType;
  autoLoad?: boolean;
}

export interface OfflineEntityResult<T> {
  data: T[];
  loading: boolean;
  error: Error | null;
  create: (item: Omit<T, 'id'>) => Promise<T>;
  update: (id: string, item: Partial<T>) => Promise<T>;
  remove: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useOfflineEntity<T extends { id: string }>(options: OfflineEntityOptions): OfflineEntityResult<T> {
  const { entity, autoLoad = true } = options;
  const { getLocalEntities, saveLocalEntity, enqueue, status } = useOfflineSync();

  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(autoLoad);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const items = await getLocalEntities(entity);
      setData(items as T[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load entities'));
    } finally {
      setLoading(false);
    }
  }, [entity, getLocalEntities]);

  useEffect(() => {
    if (autoLoad) {
      load();
    }
  }, [autoLoad, load]);

  const create = useCallback(async (item: Omit<T, 'id'>): Promise<T> => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newItem = { ...item, id } as T;

    await saveLocalEntity(entity, id, newItem);

    if (status.online) {
      await enqueue({
        type: 'CREATE',
        entity,
        entityId: id,
        data: newItem,
      });
    }

    setData((prev) => [...prev, newItem]);
    return newItem;
  }, [entity, saveLocalEntity, enqueue, status.online]);

  const update = useCallback(async (id: string, item: Partial<T>): Promise<T> => {
    const existing = data.find((d) => d.id === id);
    if (!existing) throw new Error('Item not found');

    const updated = { ...existing, ...item };
    await saveLocalEntity(entity, id, updated);

    if (status.online) {
      await enqueue({
        type: 'UPDATE',
        entity,
        entityId: id,
        data: updated,
      });
    }

    setData((prev) => prev.map((d) => (d.id === id ? updated : d)));
    return updated;
  }, [entity, data, saveLocalEntity, enqueue, status.online]);

  const remove = useCallback(async (id: string): Promise<void> => {
    await saveLocalEntity(entity, id, null);

    if (status.online) {
      await enqueue({
        type: 'DELETE',
        entity,
        entityId: id,
        data: { id },
      });
    }

    setData((prev) => prev.filter((d) => d.id !== id));
  }, [entity, saveLocalEntity, enqueue, status.online]);

  return {
    data,
    loading,
    error,
    create,
    update,
    remove,
    refresh: load,
  };
}
