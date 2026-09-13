'use client';

import { useState, useEffect } from 'react';
import { Cloud, CheckCircle, AlertCircle, Loader2, Database, FileUp, FolderSync, Lock } from 'lucide-react';
import { useToastHelpers } from '@/components/notifications/toast-provider';
import { PermissionGuard } from '@/components/shared/permission-guard';

type SyncMode = 'all' | 'data' | 'files';

interface SyncStatus {
  lastSync: string | null;
  totalImported: number;
  lastSyncDuration: number;
}

export function SyncControls() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [webAvailable, setWebAvailable] = useState<boolean | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastMode, setLastMode] = useState<SyncMode | null>(null);
  const toast = useToastHelpers();

  useEffect(() => {
    fetchSyncStatus();
  }, []);

  const fetchSyncStatus = async () => {
    try {
      const response = await fetch('/api/sync');
      const data = await response.json();
      if (data.success) {
        setStatus(data.status);
        setWebAvailable(data.webAvailable);
      }
    } catch (err) {
      console.error('Erreur status sync:', err);
    }
  };

  const handleSync = async (mode: SyncMode) => {
    setIsSyncing(true);
    setError(null);
    setResult(null);
    setLastMode(mode);

    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, force: false, dryRun: false })
      });

      const data = await response.json();

      if (!data.success) {
        const msg = data.error || 'Erreur lors de la synchronisation';
        setError(msg);
        toast.error(msg, 'Synchronisation échouée');
      } else {
        setResult(data.result);
        const fileErrors = data.result?.fileResult?.errors || 0;
        const dataFailed = data.result?.dataResult?.failed || 0;
        const copied = data.result?.fileResult?.copied || 0;
        const dedup = data.result?.fileResult?.deduplicated || 0;

        if (fileErrors > 0 || dataFailed > 0) {
          toast.warning(`${fileErrors + dataFailed} élément(s) en échec`, 'Synchronisation partielle');
        } else if (mode === 'files') {
          toast.success(`${copied} copié(s), ${dedup} dédupliqué(s)`, 'Synchronisation fichiers OK');
        } else {
          toast.success('Synchronisation terminée avec succès');
        }
        await fetchSyncStatus();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(msg);
      toast.error(msg, 'Erreur réseau');
    } finally {
      setIsSyncing(false);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'Jamais';
    return new Date(date).toLocaleString();
  };

  const sumValues = (obj: Record<string, unknown> | undefined): number => {
    if (!obj) return 0;
    return Object.values(obj).reduce<number>((acc, v) => acc + (typeof v === 'number' ? v : 0), 0);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <Cloud className="w-5 h-5" />
        Synchronisation Web → Locale
      </h2>

      <div className="flex items-center gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2">
          {webAvailable === null ? (
            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
          ) : webAvailable ? (
            <CheckCircle className="w-5 h-5 text-green-500" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-500" />
          )}
          <span className="text-sm">
            {webAvailable === null ? 'Vérification...' : webAvailable ? 'Web accessible' : 'Web inaccessible'}
          </span>
        </div>
        {status && (
          <div className="text-sm text-gray-500">
            Dernière sync: {formatDate(status.lastSync)}
            {status.lastSyncDuration > 0 && ` (${(status.lastSyncDuration / 1000).toFixed(1)}s)`}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <PermissionGuard permissions="settings:*" fallback={
          <div className="flex flex-col items-center gap-1 p-3 bg-gray-200 text-gray-500 rounded-lg cursor-not-allowed">
            <Lock className="w-5 h-5" />
            <span className="text-sm font-medium">Verrouillé</span>
          </div>
        }>
          <button
            onClick={() => handleSync('all')}
            disabled={isSyncing || !webAvailable}
            className="flex flex-col items-center gap-1 p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <FolderSync className="w-5 h-5" />
            <span className="text-sm font-medium">Tout</span>
            <span className="text-xs opacity-80">Données + Fichiers</span>
          </button>
        </PermissionGuard>

        <PermissionGuard permissions="settings:*" fallback={
          <div className="flex flex-col items-center gap-1 p-3 bg-gray-200 text-gray-500 rounded-lg cursor-not-allowed">
            <Lock className="w-5 h-5" />
            <span className="text-sm font-medium">Verrouillé</span>
          </div>
        }>
          <button
            onClick={() => handleSync('data')}
            disabled={isSyncing || !webAvailable}
            className="flex flex-col items-center gap-1 p-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            <Database className="w-5 h-5" />
            <span className="text-sm font-medium">Données</span>
            <span className="text-xs opacity-80">Blocs, procédures...</span>
          </button>
        </PermissionGuard>

        <PermissionGuard permissions="settings:*" fallback={
          <div className="flex flex-col items-center gap-1 p-3 bg-gray-200 text-gray-500 rounded-lg cursor-not-allowed">
            <Lock className="w-5 h-5" />
            <span className="text-sm font-medium">Verrouillé</span>
          </div>
        }>
          <button
            onClick={() => handleSync('files')}
            disabled={isSyncing || !webAvailable}
            className="flex flex-col items-center gap-1 p-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            <FileUp className="w-5 h-5" />
            <span className="text-sm font-medium">Fichiers</span>
            <span className="text-xs opacity-80">Avec déduplication</span>
          </button>
        </PermissionGuard>
      </div>

      {lastMode && (
        <div className="text-xs text-gray-500 text-center mb-3">
          Dernier mode : <span className="font-medium">
            {lastMode === 'all' ? 'Tout synchroniser' : lastMode === 'data' ? 'Données' : 'Fichiers'}
          </span>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 rounded-lg text-red-600 text-sm">
          ❌ {error}
        </div>
      )}

      {result && result.success && (
        <div className="mt-4 p-3 bg-green-50 rounded-lg">
          <p className="font-medium text-green-800">✅ Synchronisation terminée</p>

          {result.dataResult && (
            <div className="mt-2 text-sm">
              <span className="text-gray-600">📊 Données :</span>
              <span className="ml-2">Importés : {sumValues(result.dataResult.imported)}</span>
              <span className="ml-2 text-green-600">Mis à jour : {sumValues(result.dataResult.updated)}</span>
            </div>
          )}

          {result.fileResult && (
            <div className="mt-2 text-sm">
              <span className="text-gray-600">📁 Fichiers :</span>
              <span className="ml-2 text-blue-600">Copiés : {result.fileResult.copied || 0}</span>
              <span className="ml-2 text-yellow-600">Dédupliqués : {result.fileResult.deduplicated || 0}</span>
              <span className="ml-2 text-red-600">Erreurs : {result.fileResult.errors || 0}</span>
            </div>
          )}

          {result.results && Array.isArray(result.results) && result.results.length > 0 && (
            <div className="mt-2 max-h-40 overflow-y-auto text-xs">
              {result.results.map((r: any, i: number) => (
                <div key={i} className={`p-1 rounded ${r.success ? 'text-gray-600' : 'text-red-600'}`}>
                  {r.success ? '✅' : '❌'} {String(r.sourcePath).split('/').pop()} → {r.action}
                  {r.action === 'deduplicated' && ' (dédupliqué)'}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isSyncing && (
        <div className="mt-4 flex items-center justify-center gap-2 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Synchronisation en cours...</span>
        </div>
      )}
    </div>
  );
}