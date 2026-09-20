'use client';

import { AlertCircle, CheckCircle, CloudDownload, FileJson, Loader2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { PermissionGuard } from '@/components/shared/permission-guard';

interface ImportResultItem {
  id: string;
  title: string;
  status: 'success' | 'warning' | 'error';
  message: string;
}

interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  warnings: number;
  results: ImportResultItem[];
}

function buildDemoProcedures() {
  return [
    {
      id: 'web-1',
      title: 'Procédure Web - Production',
      code: 'WEB-PROD-001',
      description: 'Procédure importée depuis la BDD Web',
      category: 'Production',
      priority: 'Haute',
      status: 'published',
      estimatedTimeMinutes: 45,
      requiredRoles: ['chef-de-quart', 'rondier'],
      globalSafetyInstructions: ['Port des EPI obligatoire', 'Vérification des équipements'],
      steps: [
        {
          title: 'Étape 1',
          instructions: 'Instructions de l\'étape 1',
          type: 'consigne',
          isMandatory: true,
        },
        {
          title: 'Étape 2',
          instructions: 'Instructions de l\'étape 2',
          type: 'inspection',
          isMandatory: true,
        },
      ],
    },
    {
      id: 'web-2',
      title: 'Procédure Web - Maintenance',
      code: 'WEB-MAINT-001',
      description: 'Procédure de maintenance importée',
      category: 'Maintenance',
      priority: 'Critique',
      status: 'published',
      estimatedTimeMinutes: 120,
      requiredRoles: ['chef-de-bloc'],
      steps: [
        {
          title: 'Étape 1',
          instructions: 'Instructions de l\'étape 1',
          type: 'consigne',
          isMandatory: true,
        },
      ],
    },
  ];
}

export function WebImportForm() {
  const [apiKey, setApiKey] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchWebData = useCallback(async (url: string, key: string) => {
    if (!url && !key) {
      return buildDemoProcedures();
    }

    if (!url) {
      return buildDemoProcedures();
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: key ? { Authorization: `Bearer ${key}` } : undefined,
    });

    if (!response.ok) {
      throw new Error(`Impossible de récupérer les données depuis ${url}`);
    }

    const payload = await response.json();
    if (Array.isArray(payload)) {
      return payload;
    }
    if (payload && Array.isArray(payload.procedures)) {
      return payload.procedures;
    }

    return [];
  }, []);

  const handleImport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const procedures = await fetchWebData(sourceUrl, apiKey);

      const response = await fetch('/api/admin/import/web', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: sourceUrl || 'demo-web-import',
          apiKey,
          procedures,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erreur lors de l\'import');
      }

      setResult(data.result as ImportResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: 'success' | 'warning' | 'error') => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <PermissionGuard permissions="procedures:*" fallback={
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">Vous n&apos;avez pas les permissions pour importer des procédures.</p>
      </div>
    }>
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-foreground">
          <CloudDownload className="h-5 w-5 text-primary" />
          Import depuis la BDD Web
        </h2>

      <form onSubmit={handleImport} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">URL de la source</label>
          <input
            type="url"
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
            placeholder="https://api.example.com/export"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none ring-0 transition focus:border-primary"
          />
          <p className="mt-1 text-xs text-muted-foreground">Laissez vide pour utiliser les données de démonstration.</p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">Clé API</label>
          <input
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="Entrez votre clé API"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none ring-0 transition focus:border-primary"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Import en cours...
            </>
          ) : (
            <>
              <FileJson className="h-4 w-4" />
              Importer les procédures
            </>
          )}
        </button>
      </form>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-xl border border-border bg-muted/20 p-4">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="font-medium text-foreground">Import terminé</p>
              <p className="text-sm text-muted-foreground">
                {result.imported} importées · {result.failed} échouées · {result.warnings} avertissements
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {result.results.map((item) => (
              <div
                key={`${item.id}-${item.title}`}
                className={`flex items-start gap-2 rounded-lg border p-2 text-sm ${
                  item.status === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : item.status === 'warning'
                      ? 'border-amber-200 bg-amber-50 text-amber-800'
                      : 'border-red-200 bg-red-50 text-red-700'
                }`}
              >
                {getStatusIcon(item.status)}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{item.title}</div>
                  <div className="text-xs opacity-80">{item.message}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    </PermissionGuard>
  );
}
