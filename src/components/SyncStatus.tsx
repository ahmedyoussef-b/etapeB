'use client';

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getPendingCount, syncAll } from '@/services/sync-engine';

interface SyncStatusProps {
  userId: string;
}

type SyncState = 'idle' | 'syncing' | 'done' | 'error';

export function SyncStatus({ userId }: SyncStatusProps) {
  const [state, setState] = useState<SyncState>('idle');
  const [pendingCount, setPendingCount] = useState(0);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [message, setMessage] = useState('');

  useEffect(() => {
    refreshCount();
    
    // Polling toutes les 5 minutes
    const interval = setInterval(refreshCount, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [userId]);

  async function refreshCount() {
    try {
      const count = await getPendingCount(userId);
      setPendingCount(count);
    } catch (error) {
      console.error('Erreur pending count:', error);
    }
  }

  async function handleSync() {
    setState('syncing');
    setProgress({ current: 0, total: pendingCount });
    setMessage('Synchronisation...');

    try {
      const basePath = await invoke<string>('get_user_data_path');
      const result = await syncAll(userId, basePath, (current, total) => {
        setProgress({ current, total });
      });

      if (result.errors.length === 0) {
        setState('done');
        setMessage(`${result.downloaded}/${result.total} fichier(s) synchronisé(s)`);
      } else {
        setState('error');
        setMessage(`${result.downloaded}/${result.total} — ${result.errors.length} erreur(s)`);
      }

      await refreshCount();
    } catch (error) {
      setState('error');
      setMessage(`Erreur: ${(error as Error).message}`);
    }
  }

  const badgeColor = 
    state === 'error' ? 'bg-red-500' :
    state === 'syncing' ? 'bg-yellow-500' :
    pendingCount > 0 ? 'bg-orange-500' :
    'bg-green-500';

  return (
    <div className="fixed bottom-4 left-4 bg-white shadow-lg rounded-lg p-4 border z-50">
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-3 h-3 rounded-full ${badgeColor}`} />
        <span className="font-semibold">Synchronisation</span>
      </div>
      
      <div className="text-sm text-gray-600 mb-2">
        {message || (pendingCount > 0 
          ? `${pendingCount} fichier(s) en attente` 
          : 'À jour')}
      </div>

      {state === 'syncing' && progress.total > 0 && (
        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${(progress.current / progress.total) * 100}%` }}
          />
        </div>
      )}

      <button
        onClick={handleSync}
        disabled={state === 'syncing' || pendingCount === 0}
        className="w-full px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {state === 'syncing' ? 'Synchronisation...' : 'Synchroniser maintenant'}
      </button>
    </div>
  );
}
