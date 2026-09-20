// src/app/(dashboard)/structure-bdd/hooks/useSyncStatus.ts
import { useState, useEffect, useCallback } from 'react';
import { fetchSyncStatus } from '@/lib/api/local-first';
import { isTauriEnv } from '@/lib/tauri/env';

interface SyncStatusData {
  success: boolean;
  aligned: boolean;
  localCounts: { blocks: number; equipments: number; groups: number; groupEquipments: number };
  dbCounts: { blocks: number; equipments: number; groups: number; groupEquipments: number };
  missingInDb: { blocks: string[]; equipments: string[]; groups: string[]; groupEquipments: string[] };
  extraInDb: { blocks: string[]; equipments: string[]; groups: string[]; groupEquipments: string[] };
  lastSync: string | null;
}

export function useSyncStatus(pollInterval: number = 30000) {
  const [data, setData] = useState<SyncStatusData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (isTauriEnv()) return;
    setLoading(true);
    setError(null);
    try {
      const json = await fetchSyncStatus();
      if (json?.success) {
        setData(json as SyncStatusData);
      } else {
        setError((json as any)?.error || 'Erreur de récupération du statut');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isTauriEnv()) return;
    fetchStatus();
    const interval = setInterval(fetchStatus, pollInterval);
    return () => clearInterval(interval);
  }, [fetchStatus, pollInterval]);

  if (isTauriEnv()) {
    return {
      data: null,
      loading: false,
      error: null,
      refetch: async () => {},
    };
  }

  return { data, loading, error, refetch: fetchStatus };
}
