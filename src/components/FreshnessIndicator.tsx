'use client';

import { useState, useEffect } from 'react';
import { getPendingCount } from '@/services/sync-engine';
import { computeFreshness, formatLastSync, FreshnessInfo } from '@/services/freshness';

interface FreshnessIndicatorProps {
  userId: string;
  lastSyncAt: string | null;
  onSyncClick?: () => void;
}

export function FreshnessIndicator({ 
  userId, 
  lastSyncAt, 
  onSyncClick 
}: FreshnessIndicatorProps) {
  const [pendingCount, setPendingCount] = useState(0);
  const [info, setInfo] = useState<FreshnessInfo | null>(null);
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60 * 1000); // toutes les minutes
    return () => clearInterval(interval);
  }, [userId, lastSyncAt]);

  async function refresh() {
    try {
      const count = await getPendingCount(userId);
      setPendingCount(count);
      setInfo(computeFreshness(lastSyncAt, count));
    } catch (error) {
      console.error('[freshness] refresh error:', error);
    }
  }

  if (!info) {
    return (
      <div className="px-3 py-1 text-xs bg-gray-100 rounded-full text-gray-700">
        Chargement...
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowPanel(!showPanel)}
        className={`flex items-center gap-2 px-3 py-1 text-xs text-white rounded-full ${info.color} hover:opacity-90 transition`}
      >
        <span>{info.emoji}</span>
        <span>{info.label}</span>
      </button>

      {showPanel && (
        <>
          {/* Overlay pour fermer au clic */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowPanel(false)} 
          />
          
          <div className="absolute right-0 top-full mt-2 w-72 bg-white text-gray-900 shadow-xl rounded-lg border border-gray-200 z-50 p-4">
            <h3 className="font-semibold mb-3 text-gray-900">État des données locales</h3>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Dernière sync</span>
                <span className="font-medium text-gray-900">{formatLastSync(info.lastSyncAt)}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">Mises à jour</span>
                <span className="font-medium text-gray-900">{pendingCount}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">Utilisateur</span>
                <span className="font-mono text-xs text-gray-700">{userId.slice(0, 8)}...</span>
              </div>
            </div>

            {pendingCount > 0 && (
              <button
                onClick={() => {
                  onSyncClick?.();
                  setShowPanel(false);
                }}
                className="mt-4 w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
              >
                Synchroniser maintenant
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
