// src/app/(dashboard)/structure-bdd/components/repository-selector.tsx
import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, Check, RefreshCw, Copy, HardDrive, FolderSearch } from 'lucide-react';

interface RepositoryConfig {
  success: boolean;
  activeRepository: string;
  repositories: string[];
  repositoriesDir: string;
  lastChanged: string;
}

interface RepositorySelectorProps {
  onRepoChange?: (repo: string) => void;
}

export function RepositorySelector({ onRepoChange }: RepositorySelectorProps) {
  const [config, setConfig] = useState<RepositoryConfig | null>(null);
  const [open, setOpen] = useState(false);
  const [customPath, setCustomPath] = useState('');
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/repository');
      const json = await res.json();
      if (json.success) {
        setConfig(json);
        if (onRepoChange) {
          onRepoChange(json.activeRepository || '.data');
        }
      }
    } catch (err) {
      console.error('Failed to fetch repository config:', err);
    }
  }, [onRepoChange]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSelectFromPC = useCallback(async () => {
    const path = customPath.trim();
    if (!path) {
      setError('Veuillez saisir le chemin du repertoire');
      return;
    }

    setCopying(true);
    setError(null);
    try {
      const res = await fetch('/api/repository', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'select', sourcePath: path })
      });
      const json = await res.json();
      if (json.success) {
        setConfig(prev => prev ? {
          ...prev,
          activeRepository: json.activeRepository,
          repositories: json.repositories
        } : null);
        setCustomPath('');
        if (onRepoChange) onRepoChange(json.activeRepository);
        window.location.reload();
      } else {
        setError(json.error || 'Erreur inconnue');
      }
    } catch (err) {
      setError('Erreur de copie: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setCopying(false);
    }
  }, [customPath, onRepoChange]);

  const handleSwitch = useCallback(async (repo: string) => {
    try {
      const res = await fetch('/api/repository', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setActive', sourcePath: repo })
      });
      const json = await res.json();
      if (json.success) {
        setConfig(prev => prev ? { ...prev, activeRepository: json.activeRepository } : null);
        if (onRepoChange) onRepoChange(json.activeRepository);
        window.location.reload();
      } else {
        console.error('Failed to switch repository:', json.error);
      }
    } catch (err) {
      console.error('Failed to switch repository:', err);
    }
    setOpen(false);
  }, [onRepoChange]);

  if (!config) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 p-3 bg-white border border-gray-200 rounded-lg">
        <RefreshCw className="w-4 h-4 animate-spin" />
        Chargement...
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="p-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-semibold text-gray-700">Répertoire de travail</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {config.activeRepository === '.data' ? (
            <>Mode référence immuable : <code className="text-red-600">.data/</code> est protégé en écriture.</>
          ) : (
            <>Workspace modifiable : <code className="text-blue-600">{config.activeRepository}</code>. Vous pouvez ajouter/modifier/supprimer des fichiers.</>
          )}
        </p>
      </div>

      <div className="p-3 border-b border-gray-100">
        <div className="flex gap-2">
          <input
            type="text"
            value={customPath}
            onChange={(e) => { setCustomPath(e.target.value); setError(null); }}
            placeholder="C:\mon-repertoire ou /home/user/repertoire"
            className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
            onKeyDown={(e) => { if (e.key === 'Enter') handleSelectFromPC(); }}
          />
          <button
            onClick={handleSelectFromPC}
            disabled={copying || !customPath.trim()}
            className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            {copying ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
            {copying ? 'Copie...' : 'Copier'}
          </button>
        </div>
        {error && (
          <p className="text-xs text-red-600 mt-1.5">{error}</p>
        )}
      </div>

      <div>
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <FolderSearch className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-700">
              Répertoires disponibles ({config.repositories.length})
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500 font-mono truncate max-w-[100px]">
              {config.activeRepository}
            </span>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {open && (
          <div className="border-t border-gray-100 max-h-60 overflow-y-auto">
            {config.repositories.length === 0 ? (
              <div className="p-3 text-xs text-gray-400 text-center">
                Aucun repertoire copie
              </div>
            ) : (
              config.repositories.map(repo => (
                <button
                  key={repo}
                  onClick={() => handleSwitch(repo)}
                  className={`w-full flex items-center justify-between p-2.5 text-sm transition-colors ${
                    repo === config.activeRepository
                      ? 'bg-blue-50 text-blue-700'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <span className="font-mono text-xs truncate">{repo}</span>
                  {repo === config.activeRepository && (
                    <Check className="w-4 h-4 text-blue-500" />
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}