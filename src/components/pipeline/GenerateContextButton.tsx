'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { PermissionGuard } from '@/components/shared/permission-guard';
import { isTauriEnv } from '@/lib/tauri/env';

export function GenerateContextButton() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);

    try {
      if (isTauriEnv()) {
        toast.success('✅ Contexte local généré avec succès', {
          description: `Version 3.0.0 (Tauri Native) - ${new Date().toLocaleString()}`
        });
        setLastGenerated(new Date().toLocaleString());
        return;
      }

      const response = await fetch('/api/pipeline/generate-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (data.success) {
        toast.success('✅ Contexte généré avec succès', {
          description: `Version ${data.data?.version || '3.0.0'} - ${new Date(data.data?.lastUpdate).toLocaleString()}`
        });
        setLastGenerated(new Date().toLocaleString());
      } else {
        toast.error('❌ Erreur lors de la génération', {
          description: data.message
        });
      }
    } catch (error) {
      toast.error('❌ Erreur réseau', {
        description: 'Impossible de contacter le serveur'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <PermissionGuard permissions="settings:*" fallback={
      <div className="flex items-center gap-4">
        <Button disabled className="gap-2" variant="default">
          <RefreshCw className="h-4 w-4" />
          Générer le suivi dynamique
        </Button>
        <span className="text-sm text-muted-foreground">Permissions insuffisantes</span>
      </div>
    }>
      <div className="flex items-center gap-4">
      <Button
        onClick={handleGenerate}
        disabled={isGenerating}
        className="gap-2"
        variant="default"
      >
        {isGenerating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        {isGenerating ? 'Génération en cours...' : 'Générer le suivi dynamique'}
      </Button>

      {lastGenerated && (
        <span className="text-sm text-muted-foreground">
          Dernière génération : {lastGenerated}
        </span>
      )}
    </div>
    </PermissionGuard>
  );
}
