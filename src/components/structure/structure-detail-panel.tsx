'use client';

import { useEffect, useState } from 'react';
import { File, Folder, Database, HardDrive, Tag, Server, WifiOff, Loader2, AlertCircle, Download, Image as ImageIcon, FileText } from 'lucide-react';
import { TreeNode } from './database-tree';
import { fetchFileContent } from '@/lib/api/local-first';

interface StructureDetailPanelProps {
  node: TreeNode | null;
  source: 'local' | 'web' | 'db';
  available?: boolean;
  repository?: string;
}

interface FileContent {
  kind: 'text' | 'image' | 'pdf' | 'binary';
  content: string;
  size: number;
  mimeType: string;
}

const TEXT_PREVIEW_LIMIT = 50 * 1024;

export function StructureDetailPanel({ node, source, available = true, repository }: StructureDetailPanelProps) {
  const [content, setContent] = useState<FileContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!node || node.type !== 'file' || (source === 'web' || source === 'db') && !available) {
      setContent(null);
      setError(null);
      return;
    }

    let cancelled = false;
    const timeoutId = setTimeout(() => {
      const fetchContent = async () => {
        setLoading(true);
        setError(null);
        try {
          const data = await fetchFileContent(node.path, source, repository);
          if (cancelled) return;
          if ((data as any)?.success) {
            setContent({ kind: (data as any).kind, content: (data as any).content, size: (data as any).size, mimeType: (data as any).mimeType });
            if ((data as any).sourceUsed === 'local' && source === 'web') {
              setError('Affichage local de secours (BDD web incomplète)');
            }
          } else {
            setError((data as any)?.error || 'Erreur de lecture');
          }
        } catch (err) {
          if (!cancelled) setError(err instanceof Error ? err.message : 'Erreur inconnue');
        } finally {
          if (!cancelled) setLoading(false);
        }
      };
      fetchContent();
    }, 150);

    return () => { cancelled = true; clearTimeout(timeoutId); };
  }, [node, source, available, repository]);

  if (!node) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
        <Database className="w-16 h-16 mb-4 text-gray-300" />
        <p className="text-center">
          Sélectionnez un élément dans l'arborescence
          <br />
          <span className="text-sm">pour voir ses détails</span>
        </p>
      </div>
    );
  }

  const isDirectory = node.type === 'directory';
  const isDbUnavailable = source === 'db' && !available;
  const isWebUnavailable = source === 'web' && !available;
  const showContent = node.type === 'file' && !isWebUnavailable && !isDbUnavailable;

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isDirectory ? (
            <Folder className="w-5 h-5 text-blue-500" />
          ) : (
            <File className="w-5 h-5 text-gray-500" />
          )}
          <h3 className="font-medium text-lg truncate">{node.name}</h3>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {source === 'local' ? (
            <>
              <Server className="w-4 h-4 text-blue-500" />
              <span className="text-gray-600">Locale</span>
            </>
          ) : source === 'db' ? (
            <>
              {isDbUnavailable ? (
                <>
                  <WifiOff className="w-4 h-4 text-red-500" />
                  <span className="text-red-600">Hors ligne</span>
                </>
              ) : (
                <>
                  <Database className="w-4 h-4 text-green-500" />
                  <span className="text-green-600">BDD</span>
                </>
              )}
            </>
          ) : (
            <>
              {isWebUnavailable ? (
                <>
                  <WifiOff className="w-4 h-4 text-red-500" />
                  <span className="text-red-600">Hors ligne</span>
                </>
              ) : (
                <>
                  <Database className="w-4 h-4 text-green-500" />
                  <span className="text-green-600">Web</span>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Tag className="w-4 h-4" />
            Informations
          </h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-gray-500">Type</div>
            <div className="font-medium">
              {isDirectory ? '📁 Répertoire' : '📄 Fichier'}
            </div>
            {node.size && (
              <>
                <div className="text-gray-500">Taille</div>
                <div className="font-medium">{(node.size / 1024).toFixed(2)} KB</div>
              </>
            )}
            <div className="text-gray-500">Chemin</div>
            <div className="font-mono text-xs truncate" title={node.path}>{node.path}</div>
            <div className="text-gray-500">Source</div>
            <div className="font-medium">
              {source === 'local' ? '📍 Local' : source === 'db' ? '🗄️ BDD' : isWebUnavailable ? '🌐 Web (hors ligne)' : '🌐 Web'}
            </div>
          </div>
        </div>

        {node.metadata && typeof node.metadata === 'object' && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Métadonnées
            </h4>
            <div className="bg-gray-50 rounded-lg p-3 text-xs font-mono overflow-x-auto">
              <pre className="whitespace-pre-wrap break-all">
                {JSON.stringify(
                  Object.fromEntries(
                    Object.entries(node.metadata).filter(
                      ([key]) => key !== 'dataUrl' && key !== 'thumbnailDataUrl'
                    )
                  ),
                  null,
                  2
                )}
              </pre>
            </div>
          </div>
        )}

        {isDirectory && node.children && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <HardDrive className="w-4 h-4" />
              Contenu
            </h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-gray-500">Éléments</div>
              <div className="font-medium">{node.children.length}</div>
              <div className="text-gray-500">Dossiers</div>
              <div className="font-medium">
                {node.children.filter(c => c.type === 'directory').length}
              </div>
              <div className="text-gray-500">Fichiers</div>
              <div className="font-medium">
                {node.children.filter(c => c.type === 'file').length}
              </div>
            </div>
          </div>
        )}

        {showContent && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
              {content?.kind === 'image' ? <ImageIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
              Aperçu du contenu
            </h4>

            {loading && (
              <div className="flex items-center gap-2 text-sm text-gray-500 p-3 bg-gray-50 rounded-lg">
                <Loader2 className="w-4 h-4 animate-spin" />
                Chargement du contenu…
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 p-3 bg-red-50 rounded-lg">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

{content && content.kind === 'image' && (
          <div className="bg-gray-50 rounded-lg p-2 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={content.content} alt={node.name} className="max-w-full max-h-96 object-contain rounded" />
          </div>
        )}

        {content && content.kind === 'pdf' && (
          <div className="bg-gray-50 rounded-lg p-2">
            <iframe
              src={content.content}
              title={node.name}
              className="w-full h-[600px] rounded border border-gray-200"
            />
          </div>
        )}

        {content && content.kind === 'text' && (
          <div className="bg-gray-50 rounded-lg p-3 text-xs font-mono overflow-auto max-h-96">
            <pre className="whitespace-pre-wrap break-all">
              {content.content.length > TEXT_PREVIEW_LIMIT
                ? content.content.slice(0, TEXT_PREVIEW_LIMIT) + `\n\n… (${(content.size / 1024).toFixed(1)} KB au total)`
                : content.content}
            </pre>
          </div>
        )}

        {content && content.kind === 'binary' && (
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <p className="text-gray-600 mb-2">
              Fichier binaire ({content.mimeType}, {(content.size / 1024).toFixed(1)} KB)
            </p>
            <a
              href={`data:${content.mimeType};base64,${content.content}`}
              download={node.name}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              <Download className="w-3.5 h-3.5" />
              Télécharger
            </a>
          </div>
        )}
          </div>
        )}
      </div>
    </div>
  );
}