// src/app/(dashboard)/structure-bdd/components/sync-controls.tsx
import { Button } from '@/components/ui/button';
import { RefreshCw, Scale, Download, Database } from 'lucide-react';

interface SyncControlsProps {
  onSync: () => void;
  onCompare: () => void;
  onExport: () => void;
  isRunning: boolean;
  aligned: boolean;
}

export function SyncControls({ onSync, onCompare, onExport, isRunning, aligned }: SyncControlsProps) {
  return (
    <div className="space-y-2">
      <Button
        onClick={onSync}
        disabled={isRunning}
        className="w-full"
        variant={aligned ? 'outline' : 'default'}
      >
        <RefreshCw className={`w-4 h-4 mr-2 ${isRunning ? 'animate-spin' : ''}`} />
        {isRunning ? 'Synchronisation...' : aligned ? 'Resync' : 'Lancer la synchronisation'}
      </Button>

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={onCompare} variant="outline" size="sm" disabled={isRunning}>
          <Scale className="w-3 h-3 mr-1" />
          Comparer
        </Button>
        <Button onClick={onExport} variant="outline" size="sm" disabled={isRunning}>
          <Download className="w-3 h-3 mr-1" />
          Exporter
        </Button>
      </div>
    </div>
  );
}