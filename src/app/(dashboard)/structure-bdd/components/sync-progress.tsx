// src/app/(dashboard)/structure-bdd/components/sync-progress.tsx
import { Check, Loader2, X, Clock } from 'lucide-react';
import { SyncStepState } from '../hooks/useSyncProgress';

interface SyncProgressProps {
  steps: SyncStepState[];
  isRunning: boolean;
  stats: Record<string, number> | null;
  error: string | null;
}

function getStepIcon(step: SyncStepState, isRunning: boolean) {
  switch (step.status) {
    case 'done':
      return <Check className="w-4 h-4 text-green-500" />;
    case 'in_progress':
      return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
    case 'error':
      return <X className="w-4 h-4 text-red-500" />;
    default:
      return <Clock className="w-4 h-4 text-gray-300" />;
  }
}

export function SyncProgress({ steps, isRunning, stats, error }: SyncProgressProps) {
  const completed = steps.filter(s => s.status === 'done').length;
  const total = steps.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">
          {isRunning ? 'Synchronisation en cours...' : 'Synchronisation terminée'}
        </span>
        <span className="text-gray-500">{completed}/{total} — {pct}%</span>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${error ? 'bg-red-500' : isRunning ? 'bg-blue-500' : 'bg-green-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="space-y-1.5">
        {steps.map(step => (
          <div key={step.id} className="flex items-center gap-2 text-sm">
            {getStepIcon(step, isRunning)}
            <span className={`flex-1 ${step.status === 'done' ? 'text-gray-700' : step.status === 'in_progress' ? 'text-blue-700 font-medium' : step.status === 'error' ? 'text-red-600' : 'text-gray-400'}`}>
              {step.label}
            </span>
            {step.detail && (
              <span className="text-xs text-gray-400 font-mono">{step.detail}</span>
            )}
          </div>
        ))}
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-2 mt-3 p-2 bg-gray-50 rounded text-xs">
          {Object.entries(stats).map(([key, value]) => (
            <div key={key} className="flex justify-between">
              <span className="text-gray-500 capitalize">{key}</span>
              <span className="font-medium text-gray-700">{value}</span>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="p-2 bg-red-50 rounded text-xs text-red-600">
          Erreur : {error}
        </div>
      )}
    </div>
  );
}