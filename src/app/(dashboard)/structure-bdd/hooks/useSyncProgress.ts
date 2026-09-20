// src/app/(dashboard)/structure-bdd/hooks/useSyncProgress.ts
import { useState, useCallback, useRef } from 'react';
import { startSync } from '@/lib/api/local-first';
import { isTauriEnv } from '@/lib/tauri/env';

export interface SyncStepState {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'done' | 'error';
  detail?: string;
}

interface SyncProgressState {
  steps: SyncStepState[];
  isRunning: boolean;
  stats: Record<string, number> | null;
  error: string | null;
}

const INITIAL_STEPS: SyncStepState[] = [
  { id: 'init', label: 'Initialisation', status: 'pending' },
  { id: 'blocks', label: 'Synchronisation des blocs', status: 'pending' },
  { id: 'groups', label: 'Synchronisation des groupes', status: 'pending' },
  { id: 'documents', label: 'Synchronisation des documents', status: 'pending' },
  { id: 'mirror', label: 'Mise à jour du mirror repertoire', status: 'pending' },
  { id: 'indexes', label: 'Mise à jour des indexes', status: 'pending' },
  { id: 'registry', label: 'Synchronisation du registry', status: 'pending' },
  { id: 'rh', label: 'Synchronisation des ressources humaines', status: 'pending' },
  { id: 'data', label: 'Synchronisation des données', status: 'pending' },
  { id: 'final', label: 'Finalisation', status: 'pending' },
];

export function useSyncProgress() {
  const [state, setState] = useState<SyncProgressState>({
    steps: INITIAL_STEPS,
    isRunning: false,
    stats: null,
    error: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);

  const start = useCallback(async () => {
    if (isTauriEnv()) return;
    setState(prev => ({ ...prev, isRunning: true, error: null, steps: INITIAL_STEPS }));

    try {
      const json = await startSync();
      setState(prev => ({
        ...prev,
        isRunning: false,
        stats: (json as any)?.stats || null,
        error: (json as any)?.success ? null : ((json as any)?.error || 'Erreur inconnue'),
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isRunning: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      }));
    }
  }, []);

  const reset = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    setState({
      steps: INITIAL_STEPS,
      isRunning: false,
      stats: null,
      error: null,
    });
  }, []);

  if (isTauriEnv()) {
    return {
      steps: INITIAL_STEPS,
      isRunning: false,
      stats: null,
      error: null,
      startSync: async () => {},
      reset: () => {},
    };
  }

  return { ...state, startSync: start, reset };
}
