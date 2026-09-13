// src/app/(dashboard)/structure-bdd/hooks/useSyncStatus.ts
import { useState, useEffect, useCallback } from 'react';

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
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/structure/sync-status');
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        setError(json.error || 'Erreur de récupération du statut');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, pollInterval);
    return () => clearInterval(interval);
  }, [fetchStatus, pollInterval]);

  return { data, loading, error, refetch: fetchStatus };
}