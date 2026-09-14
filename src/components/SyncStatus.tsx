'use client';

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { syncAll } from '@/services/sync-engine';
import { FreshnessIndicator } from './FreshnessIndicator';

interface SyncStatusProps {
  userId: string;
}

export function SyncStatus({ userId }: SyncStatusProps) {
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadLastSync();
  }, [userId]);

  async function loadLastSync() {
    try {
      const data = await fetch(
        `https://etape-b.vercel.app/api/sync/count?userId=${encodeURIComponent(userId)}`
      ).then(r => r.json());
      setLastSyncAt(data.lastSyncAt);
    } catch (error) {
      console.error('[sync-status] load error:', error);
    }
  }

  async function handleSync() {
    setIsSyncing(true);
    setProgress({ current: 0, total: 0 });
    setMessage('Synchronisation...');

    try {
      const basePath = await invoke<string>('get_user_data_path');
      const result = await syncAll(userId, basePath, (current, total) => {
        setProgress({ current, total });
      });

      await loadLastSync();

      if (result.errors.length === 0) {
        setMessage(`${result.downloaded}/${result.total} synchronisé(s)`);
      } else {
        setMessage(`${result.downloaded}/${result.total} — ${result.errors.length} erreur(s)`);
      }
    } catch (error) {
      setMessage(`Erreur: ${(error as Error).message}`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setMessage(''), 5000);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <FreshnessIndicator
        userId={userId}
        lastSyncAt={lastSyncAt}
        onSyncClick={handleSync}
      />

      {isSyncing && progress.total > 0 && (
        <div className="flex items-center gap-2">
          <div className="w-32 bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-600">
            {progress.current}/{progress.total}
          </span>
        </div>
      )}

      {message && (
        <span className="text-xs text-gray-600">{message}</span>
      )}
    </div>
  );
}
