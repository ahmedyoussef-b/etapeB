'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToastHelpers } from '@/components/notifications/toast-provider';

export function PurgeWebButton() {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ estimatedCount: number; preservedTables: string[] } | null>(null);
  const toast = useToastHelpers();

  const runDryRun = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/purge-web', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setPreview({ estimatedCount: json.estimatedCount, preservedTables: json.preservedTables });
      toast.info(`${json.estimatedCount} fichier(s) uploadé(s) prêt(s) à purger`, 'Prévisualisation purge Web');
    } catch (err) {
      toast.error('Échec de la prévisualisation', 'Purge BDD Web');
    } finally {
      setLoading(false);
    }
  };

  const runPurge = async () => {
    if (!preview) return;
    const confirmed = await toast.confirm(
      `Confirmer la purge de ${preview.estimatedCount} fichier(s) uploadé(s) ? Cette action est irréversible. Les tables métier (Centrale, Groupes, Procédures) sont préservées.`,
      'Purge BDD Web',
      { confirmLabel: 'Purger', cancelLabel: 'Annuler' }
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await fetch('/api/admin/purge-web', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: false }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success(
        `${json.deleted} fichier(s) purgé(s) en ${json.duration}ms`,
        'Purge BDD Web'
      );
      setPreview(null);
    } catch (err) {
      toast.error('Échec de la purge', 'Purge BDD Web');
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
          Purger {preview.estimatedCount} fichier(s)
        </Button>
      )}
    </div>
  );
}
