'use client';

import { useOfflineSync } from '@/lib/hooks/useOfflineSync';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { WifiOff, RefreshCw, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

export function SyncStatus() {
  const { status, stats, sync, lastSync } = useOfflineSync({ autoSync: true, syncInterval: 30000 });

  const getStatusBadge = () => {
    if (!status.online) {
      return (
        <Badge variant="destructive" className="gap-1.5">
          <WifiOff className="h-3.5 w-3.5" />
          Hors ligne
        </Badge>
      );
    }
    if (status.syncing) {
      return (
        <Badge variant="secondary" className="gap-1.5">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Synchronisation...
        </Badge>
      );
    }
    if (stats.conflicts > 0) {
      return (
        <Badge variant="outline" className="gap-1.5 border-orange-500 text-orange-600">
          <AlertTriangle className="h-3.5 w-3.5" />
          {stats.conflicts} conflit{stats.conflicts > 1 ? 's' : ''}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1.5 border-green-500 text-green-600">
        <CheckCircle2 className="h-3.5 w-3.5" />
        En ligne
      </Badge>
    );
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {getStatusBadge()}
          <div className="text-sm text-muted-foreground">
            {stats.pending > 0 && (
              <span>{stats.pending} opération{stats.pending > 1 ? 's' : ''} en attente</span>
            )}
            {stats.pending === 0 && !status.online && (
              <span>Les modifications seront synchronisées plus tard</span>
            )}
            {stats.pending === 0 && status.online && !status.syncing && (
              <span>Données à jour</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {lastSync && (
            <span className="text-xs text-muted-foreground">
              Dernière sync: {lastSync.pushed > 0 ? `${lastSync.pushed} envoyé(s)` : 'OK'}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={sync}
            disabled={!status.online || status.syncing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${status.syncing ? 'animate-spin' : ''}`} />
            Synchroniser
          </Button>
        </div>
      </div>

      {stats.conflicts > 0 && (
        <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
          <AlertTriangle className="mr-2 inline h-4 w-4" />
          {stats.conflicts} conflit{stats.conflicts > 1 ? 's' : ''} détecté{stats.conflicts > 1 ? 's' : ''} lors de la synchronisation.
          Résolu{stats.conflicts > 1 ? 's' : ''} automatiquement avec la stratégie locale.
        </div>
      )}
    </Card>
  );
}
