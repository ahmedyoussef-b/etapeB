'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToastHelpers } from '@/components/notifications/toast-provider';
import { isTauriEnv } from '@/lib/tauri/env';
import { purgeSyncCacheUnified } from '@/lib/api/safe-fetch';

export function SyncPurgeButton() {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ total: number } | null>(null);
  const toast = useToastHelpers();

  const runDryRun = async () => {
    setLoading(true);
    try {
      if (isTauriEnv()) {
        setPreview({ total: 0 });
        toast.info('0 fichier(s) prêt(s) à purger (Cache local propre)', 'Prévisualisation purge');
        return;
      }
      const res = await fetch('/api/admin/sync-purge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setPreview({ total: json.total });
      toast.info(`${json.total} fichier(s) prêt(s) à purger`, 'Prévisualisation purge');
    } catch (err) {
      toast.error('Échec de la prévisualisation', 'Purge cloud');
    } finally {
      setLoading(false);
    }
  };

  const runPurge = async () => {
    if (!preview) return;
    const confirmed = await toast.confirm(
      `Confirmer la purge de ${preview.total} fichier(s) ? Cette action est irréversible.`,
      'Purge cloud',
      { confirmLabel: 'Purger', cancelLabel: 'Annuler' }
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      if (isTauriEnv()) {
        await purgeSyncCacheUnified();
        toast.success('Cache local purgé avec succès', 'Purge locale');
        setPreview(null);
        return;
      }
      const res = await fetch('/api/admin/sync-purge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: false }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success(
        `${json.deleted} fichier(s) purgé(s), ${json.errors} erreur(s)`,
        'Purge cloud'
      );
      setPreview(null);
    } catch (err) {
      toast.error('Échec de la purge', 'Purge cloud');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={runDryRun}
        disabled={loading}
        className="rounded-xl"
      >
        Prévisualiser la purge
      </Button>
      {preview && (
        <Button
          variant="destructive"
          size="sm"
          onClick={runPurge}
          disabled={loading}
          className="rounded-xl"
        >
          Purger {preview.total} fichier(s)
        </Button>
      )}
    </div>
  );
}
