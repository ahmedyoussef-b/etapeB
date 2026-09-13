// src/app/(dashboard)/structure-bdd/hooks/useSyncProgress.ts
import { useState, useCallback, useRef } from 'react';

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

  const startSync = useCallback(async () => {
    setState(prev => ({ ...prev, isRunning: true, error: null, steps: INITIAL_STEPS }));

    try {
      const response = await fetch('/api/structure/sync', { method: 'POST' });
      if (!response.ok || !response.body) {
        throw new Error('Impossible de démarrer la synchronisation');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const processEvents = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === 'step') {
                setState(prev => ({
                  ...prev,
                  steps: event.steps,
                }));
              } else if (event.type === 'done') {
                setState(prev => ({
                  ...prev,
                  isRunning: false,
                  stats: event.stats || null,
                  error: event.success ? null : (event.error || 'Erreur inconnue'),
                }));
              }
            } catch {}
          }
        }
      };

      await processEvents();
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

  return { ...state, startSync, reset };
}