'use client';

import { useEffect, useState } from 'react';
import { Activity, Clock, HardDrive } from 'lucide-react';
import { isTauriEnv } from '@/lib/tauri/env';

type WebStats = {
  populated: boolean;
  uploadCount: number;
  placeholderCount: number;
  totalCount: number;
  oldest: string | null;
  newest: string | null;
};

function formatDate(value: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR');
}

export function WebStatusTab() {
  const isTauri = isTauriEnv();
  const [stats, setStats] = useState<WebStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isTauri) return;

    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/admin/web-stats');
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        if (!cancelled) setStats(json);
      } catch {
        // silent in tab
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [isTauri]);

  if (isTauri) return null;

  if (loading) {
    return <div className="text-sm text-muted-foreground">Chargement des statistiques Web...</div>;
  }

  if (!stats) {
    return <div className="text-sm text-muted-foreground">Statistiques Web indisponibles.</div>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="rounded-xl border border-border/60 bg-background p-4">
        <div className="text-xs text-muted-foreground mb-1">Fichiers uploadés</div>
        <div className="text-2xl font-semibold">{stats.uploadCount}</div>
        <div className="text-xs text-muted-foreground mt-1">
          Total documents: {stats.totalCount}
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-background p-4">
        <div className="text-xs text-muted-foreground mb-1">Dernier upload</div>
        <div className="text-sm font-medium">{formatDate(stats.newest)}</div>
        <div className="text-xs text-muted-foreground mt-1">
          Plus ancien: {formatDate(stats.oldest)}
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-background p-4">
        <div className="text-xs text-muted-foreground mb-1">Assiette de transition</div>
        <div className="flex items-center gap-2 text-sm font-medium">
          <Activity className="h-4 w-4" />
          {stats.populated ? 'Peuplée' : 'Vide'}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          Placeholders: {stats.placeholderCount}
        </div>
      </div>
    </div>
  );
}
