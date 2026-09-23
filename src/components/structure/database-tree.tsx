//src/components/structure/database-tree.tsx
'use client';

import { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import { ChevronRight, ChevronDown, ChevronLeft, Search, Folder, File, Database, RefreshCw, Factory, Users, Wrench, Layers, WifiOff, Pencil, Trash2, FolderPlus, X, Check, Copy, ArrowUpDown } from 'lucide-react';
import { FileUploadButton } from '@/components/upload/file-upload-button';
import { dedupeTree, type TreeNode } from '@/components/structure/tree-utils';
import { WORKING_REPOSITORY_NAME, WORKING_REPOSITORY_PATH } from '@/lib/config/repository';
import { fetchStructureTree, treeAction as invokeTreeAction } from '@/lib/api/local-first';
import { isTauriEnv } from '@/lib/tauri/env';
import { StructureSource } from '@/lib/database/structure-types';
import { useToastHelpers } from '@/components/notifications/toast-provider';
import { ContextMenu } from '@/components/ui/context-menu';
import { Tooltip } from '@/components/ui/tooltip';

export type { TreeNode } from '@/components/structure/tree-utils';

interface DatabaseTreeProps {
  source: StructureSource;
  onSelect: (node: TreeNode) => void;
  selectedPath?: string;
  webAvailable?: boolean;
  activeRepo?: string | null;
  isAdmin?: boolean;
}

async function treeAction(action: string, path: string, source: string, name?: string, repository?: string) {
  console.log('[DatabaseTree] treeAction', { action, path, source, name, repository });
  const data = await invokeTreeAction(action, path, source, name, repository);
  console.log('[DatabaseTree] treeAction result', { action, path, source, ok: data?.success ?? false, data });
  return data;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}

function collectDirectoryPaths(nodes: TreeNode[]): string[] {
  const paths: string[] = [];
  const visit = (items: TreeNode[]) => {
    for (const node of items) {
      if (node.type === 'directory') {
        paths.push(node.path);
        if (node.children) {
          visit(node.children);
        }
      }
    }
  };
  visit(nodes);
  return paths;
}

function countNodes(nodes: TreeNode[]): { total: number; directories: number; files: number } {
  let total = 0;
  let directories = 0;
  let files = 0;
  const visit = (items: TreeNode[]) => {
    for (const node of items) {
      total++;
      if (node.type === 'directory') {
        directories++;
        if (node.children) {
          visit(node.children);
        }
      } else {
        files++;
      }
    }
  };
  visit(nodes);
  return { total, directories, files };
}

function VectorBadges({ node, source }: { node: TreeNode; source: StructureSource }) {
  if (source !== 'vector') return null;

  const meta = node.metadata as Record<string, string | number | boolean | undefined> | undefined;
  if (!meta) return null;

  const isDir = node.type === 'directory';
  const vectorized = meta.vectorized === true;
  const chunkCount = typeof meta.chunkCount === 'number' ? meta.chunkCount : 0;
  const fileCount = typeof meta.fileCount === 'number' ? meta.fileCount : 0;
  const vectorizedFileCount = typeof meta.vectorizedFileCount === 'number' ? meta.vectorizedFileCount : 0;

  return (
    <>
      {isDir ? (
        chunkCount > 0 ? (
          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
            {chunkCount} chunks · {vectorizedFileCount}/{fileCount}
          </span>
        ) : (
          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">
            non vectorisé
          </span>
        )
      ) : (
        vectorized && chunkCount > 0 ? (
          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">
            {chunkCount} chunk{chunkCount > 1 ? 's' : ''} ✅
          </span>
        ) : (
          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">
            non vectorisé
          </span>
        )
      )}
    </>
  );
}

function isTreeFullyLoaded(nodes: TreeNode[]): boolean {
  return nodes.every(node => {
    if (node.type === 'file') return true;
    if (!node.children) return false;
    return isTreeFullyLoaded(node.children);
  });
}

export function DatabaseTree({ source, onSelect, selectedPath, webAvailable = true, activeRepo, isAdmin = false }: DatabaseTreeProps) {
  const [nodes, setNodes] = useState<TreeNode[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState<boolean>(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const loadedPathsRef = useRef<Set<string>>(new Set());
  const loadingPathsRef = useRef<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: TreeNode } | null>(null);
  const toast = useToastHelpers();
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isNavigatingRef = useRef(false);
  const [sortField, setSortField] = useState<'name' | 'date' | 'size' | 'type'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState('');

  const isLocalEditable = source === 'local' && activeRepo !== null && activeRepo !== undefined && activeRepo !== '.data' && !activeRepo.endsWith('/.data') && (activeRepo === WORKING_REPOSITORY_NAME || activeRepo.startsWith('repositories/'));
  const mutationsEnabled = isLocalEditable || (source === 'web' && webAvailable && isAdmin && !isTauriEnv());

  useEffect(() => {
    console.log('[DatabaseTree] source changed', { source, webAvailable });
    setHistory([]);
    setHistoryIndex(-1);
  }, [source, webAvailable]);

  const loadStructure = useCallback(async (path: string = '', signal?: AbortSignal) => {
    try {
      console.log('[DatabaseTree] loadStructure', { source, path, activeRepo });
      const data = await fetchStructureTree(source, path || undefined, activeRepo || undefined);
      console.log('[DatabaseTree] loadStructure result', { source, path, success: data?.success, sourceUsed: (data as any)?.sourceUsed, topLevelNodes: (data as any)?.data?.length, firstNodeChildren: (data as any)?.data?.[0]?.children?.length });

      if (!data?.success) {
        if ((data as any)?.available === false) {
          setAvailable(false);
          setError((data as any)?.error || 'BDD non disponible');
        } else {
          setAvailable(true);
          setError((data as any)?.error || 'Erreur de chargement');
        }
        if (!path) setNodes([]);
        return [];
      }

      setAvailable(true);
      const deduped = dedupeTree((data as any).data || []);
      if (!path) {
        setNodes(deduped);
      }
      return deduped;
    } catch (err) {
      const error = err as Error;
      if (error.name === 'AbortError' || error.message === 'cleanup') {
        return [];
      }
      setAvailable(false);
      setError(error.message || String(error));
      if (!path) setNodes([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [source, activeRepo]);

  const updateNodeChildren = useCallback((path: string, children: TreeNode[]) => {
    const updateRecursive = (nodes: TreeNode[]): TreeNode[] => {
      return nodes.map(node => {
        if (node.path === path) {
          return { ...node, children: dedupeTree(children) };
        }
        if (node.children) {
          return { ...node, children: updateRecursive(node.children) };
        }
        return node;
      });
    };
    setNodes(prev => (prev ? dedupeTree(updateRecursive(prev)) : prev));
  }, []);

  const loadChildren = useCallback(async (node: TreeNode) => {
    if (node.type !== 'directory') return;

    try {
      const data = await fetchStructureTree(source, node.path, activeRepo || undefined);

      if (data?.success && data.data) {
        updateNodeChildren(node.path, data.data);
      }
    } catch (err) {
      console.error('Erreur chargement enfants:', err);
    }
  }, [source, activeRepo, updateNodeChildren]);

  const removeNodeFromTree = useCallback((path: string) => {
    console.log('[DatabaseTree] removeNodeFromTree', { path, source });
    const removeRecursive = (nodes: TreeNode[]): TreeNode[] => {
      return nodes
        .filter(node => node.path !== path)
        .map(node => {
          if (node.children) {
            return { ...node, children: removeRecursive(node.children) };
          }
          return node;
        });
    };
    setNodes(prev => {
      const next = prev ? dedupeTree(removeRecursive(prev)) : prev;
      console.log('[DatabaseTree] removeNodeFromTree state updated', { path, source, count: next?.length ?? 0 });
      return next;
    });
    setExpanded(prev => {
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
  }, [source]);

  const reloadTreeSilent = useCallback(async () => {
    try {
      const data = await fetchStructureTree(source, '', activeRepo || undefined);
      if (data?.success && data.data) {
        const rootNodes = data.data;
        if (rootNodes.length > 0) {
          const fullyLoaded = isTreeFullyLoaded(rootNodes) ? rootNodes : dedupeTree(await loadAllChildren(rootNodes));
          const counts = countNodes(fullyLoaded);
          console.log('[DatabaseTree] reloadTreeSilent', counts);
          setNodes(fullyLoaded);
          setExpanded(new Set(collectDirectoryPaths(fullyLoaded)));
        } else {
          setNodes([]);
        }
      }
    } catch (err) {
      console.error('Failed to reload tree after mutation:', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, activeRepo]);

  const renameNodeInTree = useCallback(async (oldPath: string, newPath: string, newName: string) => {
    const renameRecursive = (nodes: TreeNode[]): TreeNode[] => {
      return nodes.map(node => {
        if (node.path === oldPath) {
          return { ...node, name: newName, path: newPath };
        }
        if (node.path.startsWith(oldPath + '/')) {
          const updatedPath = newPath + node.path.slice(oldPath.length);
          return { ...node, path: updatedPath };
        }
        if (node.children) {
          return { ...node, children: renameRecursive(node.children) };
        }
        return node;
      });
    };
    setNodes(prev => (prev ? dedupeTree(renameRecursive(prev)) : prev));
    setExpanded(prev => {
      const next = new Set<string>();
      prev.forEach(p => {
        if (p === oldPath) next.add(newPath);
        else if (p.startsWith(oldPath + '/')) next.add(newPath + p.slice(oldPath.length));
        else next.add(p);
      });
      return next;
    });

    await reloadTreeSilent();
  }, [reloadTreeSilent]);

  const addNodeToTree = useCallback(async (parentPath: string, newNode: TreeNode) => {
    const addRecursive = (nodes: TreeNode[]): TreeNode[] => {
      return nodes.map(node => {
        if (node.path === parentPath) {
          const updatedChildren = [...(node.children || []), newNode];
          updatedChildren.sort((a, b) => {
            if (a.type === 'directory' && b.type === 'file') return -1;
            if (a.type === 'file' && b.type === 'directory') return 1;
            return a.name.localeCompare(b.name);
          });
          return { ...node, children: updatedChildren };
        }
        if (node.children) {
          return { ...node, children: addRecursive(node.children) };
        }
        return node;
      });
    };
    setNodes(prev => (prev ? dedupeTree(addRecursive(prev)) : prev));

    await reloadTreeSilent();
  }, [reloadTreeSilent]);

  const handleExpandParent = useCallback((path: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.add(path);
      return next;
    });
  }, []);

  const handleUploaded = useCallback(() => {
    loadStructure('');
  }, [loadStructure]);

  const handleCopyPath = useCallback((node: TreeNode, type: 'relative' | 'absolute') => {
    const text = type === 'relative'
      ? node.path
      : source === 'local'
        ? `%APPDATA%\\NexaFlow\\${WORKING_REPOSITORY_PATH}\\${node.path}`
        : node.path;

    navigator.clipboard.writeText(text).then(() => {
      toast.success(`Chemin copié : ${text}`);
    }).catch(() => {
      toast.error('Impossible de copier le chemin');
    });
  }, [source, toast]);

  const isAncestorOf = (ancestorPath: string, descendantPath: string): boolean => {
    if (!ancestorPath) return false;
    return descendantPath === ancestorPath || descendantPath.startsWith(ancestorPath + '/');
  };

  const loadAllChildren = async (nodes: TreeNode[], depth = 0, parentPath = ''): Promise<TreeNode[]> => {
    const MAX_DEPTH = 5;
    // Concurrence réduite : chaque appel ouvre une nouvelle PrismaClient en dev (Next.js),
    // multiplier les requêtes en parallèle sature vite PostgreSQL (P2037 TooManyConnections).
    const CONCURRENCY = 2;

    if (depth > MAX_DEPTH) {
      return nodes;
    }

    // On collecte les nœuds directory à étendre :
    // - "missing" : pas encore chargés (1er passage après mount/refresh)
    // - "shallow" : enfants présents mais profondeur incomplète (rare avec buildExactTree,
    //   mais possible si l'API web a timeout avant d'avoir tout récursé)
    // On évite de recharger les nœuds déjà complets au-delà de MAX_DEPTH.
    const directories = nodes.filter(
      n => n.type === 'directory' && !isAncestorOf(n.path, parentPath)
    );

    const results = await mapWithConcurrency(
      directories,
      CONCURRENCY,
      async (node) => {
        const alreadyComplete =
          node.children &&
          node.children.length > 0;

        let children = node.children;

        if (!alreadyComplete) {
          try {
            loadedPathsRef.current.add(node.path);
            children = await loadChildrenForNode(node, depth, parentPath);
          } catch {
            children = children || [];
          }
        }

        // Récursion uniquement si on n'a pas atteint MAX_DEPTH ET qu'on a des enfants.
        // On ne récurse PAS dans un nœud déjà complet : ça déclencherait des requêtes
        // redondantes (loadChildrenForNode) sans rien apporter.
        let nestedChildren = children;
        if (children && children.length > 0 && depth < MAX_DEPTH && !alreadyComplete) {
          nestedChildren = await loadAllChildren(children, depth + 1, node.path);
        }

        return { ...node, children: nestedChildren };
      }
    );

    // Préserver l'ordre original + remplacer les directory par leur version enrichie
    const enrichedMap = new Map(results.map(r => [r.path, r]));
    const enriched = nodes.map(n => enrichedMap.get(n.path) || n);
    const counts = countNodes(enriched);
    console.log('[DatabaseTree] loadAllChildren', { depth, parentPath, counts });
    return enriched;
  };

  const loadChildrenForNode = async (node: TreeNode, depth: number, parentPath = ''): Promise<TreeNode[]> => {
    if (node.type !== 'directory') {
      return [];
    }

    if (depth >= 5) {
      return [];
    }

    if (isAncestorOf(node.path, parentPath)) {
      return [];
    }

    if (loadingPathsRef.current.has(node.path)) {
      return [];
    }

    loadingPathsRef.current.add(node.path);

    try {
      const data = await fetchStructureTree(source, node.path, activeRepo || undefined);
      if (data?.success && data.data && data.data.length > 0) {
        const children = await loadAllChildren(data.data, depth + 1, node.path);
        loadedPathsRef.current.add(node.path);
        return children;
      }
      return [];
    } catch {
      return [];
    } finally {
      loadingPathsRef.current.delete(node.path);
    }
  };

  const toggleExpand = useCallback(async (node: TreeNode) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(node.path)) {
        next.delete(node.path);
      } else {
        next.add(node.path);
      }
      return next;
    });
    // Load children if needed (outside the state updater)
    if (!node.children || node.children.length === 0) {
      await loadChildren(node);
    }
  }, [loadChildren]);

  const handleSelect = useCallback((node: TreeNode) => {
    if (!isNavigatingRef.current) {
      setHistory(prev => {
        const next = prev.slice(0, historyIndex + 1);
        next.push(node.path);
        return next.slice(-50);
      });
      setHistoryIndex(prev => Math.min(prev + 1, 49));
    }
    onSelect(node);
  }, [onSelect, historyIndex]);

  const getNodeLabel = useCallback((node: TreeNode) => node.name, []);

  const sortNodes = useCallback((nodes: TreeNode[]): TreeNode[] => {
    const sorted = [...nodes];
    sorted.sort((a, b) => {
      const dirOrder = sortField === 'type' ? 0 : (a.type === 'directory' ? -1 : 1) - (b.type === 'directory' ? -1 : 1);
      if (dirOrder !== 0) return dirOrder;

      let cmp = 0;
      if (sortField === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else if (sortField === 'size') {
        const sizeA = a.size ?? 0;
        const sizeB = b.size ?? 0;
        cmp = sizeA - sizeB;
      } else if (sortField === 'date') {
        const dateA = a.metadata?.updatedAt || a.metadata?.createdAt || '';
        const dateB = b.metadata?.updatedAt || b.metadata?.createdAt || '';
        cmp = dateA.localeCompare(dateB);
      } else if (sortField === 'type') {
        cmp = a.type.localeCompare(b.type);
      }

      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return sorted.map(node => ({
      ...node,
      children: node.children ? sortNodes(node.children) : node.children
    }));
  }, [sortField, sortDirection]);

  const formatSize = useCallback((bytes?: number): string => {
    if (!bytes || bytes <= 0) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, i);
    return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  }, []);

  const formatDate = useCallback((dateString?: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'à l\'instant';
    if (diffMin < 60) return `il y a ${diffMin} min`;
    if (diffHours < 24) return `il y a ${diffHours} h`;
    if (diffDays === 1) return 'hier';
    if (diffDays < 7) return `il y a ${diffDays} jours`;
    return date.toLocaleDateString();
  }, []);

  const filterTree = useCallback((nodes: TreeNode[], query: string): TreeNode[] => {
    if (!query.trim()) return nodes;

    const lowerQuery = query.toLowerCase();

    const matchNode = (node: TreeNode): TreeNode | null => {
      const nameMatches = node.name.toLowerCase().includes(lowerQuery);
      let childMatches: TreeNode[] = [];

      if (node.children) {
        const matchedChildren = node.children
          .map(child => matchNode(child))
          .filter((child): child is TreeNode => child !== null);
        childMatches = matchedChildren;
      }

      if (nameMatches || childMatches.length > 0) {
        return {
          ...node,
          children: childMatches.length > 0 ? childMatches : node.children,
        };
      }

      return null;
    };

    return nodes.map(node => matchNode(node)).filter((node): node is TreeNode => node !== null);
  }, []);

  const findNodeByPath = useCallback((nodes: TreeNode[], path: string): TreeNode | undefined => {
    for (const node of nodes) {
      if (node.path === path) return node;
      if (node.children) {
        const found = findNodeByPath(node.children, path);
        if (found) return found;
      }
    }
    return undefined;
  }, []);

  const handleBack = useCallback(() => {
    if (historyIndex > 0) {
      isNavigatingRef.current = true;
      const newIndex = historyIndex - 1;
      const path = history[newIndex];
      const node = findNodeByPath(nodes || [], path);
      if (node) {
        setHistoryIndex(newIndex);
        onSelect(node);
      }
      isNavigatingRef.current = false;
    }
  }, [historyIndex, history, nodes, onSelect, findNodeByPath]);

  const handleForward = useCallback(() => {
    if (historyIndex < history.length - 1) {
      isNavigatingRef.current = true;
      const newIndex = historyIndex + 1;
      const path = history[newIndex];
      const node = findNodeByPath(nodes || [], path);
      if (node) {
        setHistoryIndex(newIndex);
        onSelect(node);
      }
      isNavigatingRef.current = false;
    }
  }, [historyIndex, history, nodes, onSelect, findNodeByPath]);

  const getNodeIcon = useCallback((node: TreeNode) => {
    const name = node.name.toLowerCase();
    const path = node.path.toLowerCase();
    const metadata = node.metadata as Record<string, string | number | boolean | undefined> | undefined;

    if (name === 'centrale' || path.includes('centrale')) {
      return <Factory className="w-4 h-4 text-purple-500 flex-shrink-0" />;
    }
    if (name === 'groupes' || path.includes('groupes')) {
      return <Users className="w-4 h-4 text-indigo-500 flex-shrink-0" />;
    }
    if (node.metadata?.type === 'centrale' || node.metadata?.type === 'groupe') {
      return <Layers className="w-4 h-4 text-blue-500 flex-shrink-0" />;
    }
    if (metadata?.equipmentCode || metadata?.code) {
      return <Wrench className="w-4 h-4 text-orange-500 flex-shrink-0" />;
    }
    if (node.type === 'directory') {
      return <Folder className="w-4 h-4 text-blue-500 flex-shrink-0" />;
    }
    return <File className="w-4 h-4 text-gray-500 flex-shrink-0" />;
  }, []);

  const buildTooltipContent = useCallback((node: TreeNode): React.ReactNode => {
    const metadata = node.metadata as Record<string, string | number | boolean | undefined> | undefined;
    const lines: React.ReactNode[] = [];

    lines.push(
      <div key="type" className="font-medium text-gray-900">
        {node.type === 'directory' ? 'Dossier' : 'Fichier'} — {node.name}
      </div>
    );

    if (node.path) {
      lines.push(
        <div key="path" className="text-gray-500 break-all">
          {node.path}
        </div>
      );
    }

    if (metadata) {
      const entries = Object.entries(metadata).filter(([, value]) => value !== undefined && value !== '');
      if (entries.length > 0) {
        lines.push(<div key="sep" className="my-1 h-px bg-gray-200" />);
        entries.forEach(([key, value]) => {
          lines.push(
            <div key={key} className="flex justify-between gap-4">
              <span className="text-gray-500">{key}</span>
              <span className="text-gray-900 font-medium">{String(value)}</span>
            </div>
          );
        });
      }
    }

    return <div className="flex flex-col gap-1">{lines}</div>;
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setAvailable(true);
    setNodes(null);
    loadedPathsRef.current = new Set();
    loadingPathsRef.current = new Set();

    loadStructure('', controller.signal).then(async (rootNodes) => {
      if (rootNodes && rootNodes.length > 0) {
        const fullyLoaded = source === 'web'
          ? rootNodes
          : dedupeTree(await loadAllChildren(rootNodes));
        const counts = countNodes(fullyLoaded);
        console.log('[DatabaseTree] initial load', counts);
        setNodes(fullyLoaded);
        setExpanded(new Set());
      } else {
        setNodes([]);
      }
    }).catch((err) => {
      const error = err as Error;
      if (error.name === 'AbortError' || error.message === 'cleanup') {
        return;
      }
      setError(error.message || String(error));
      setAvailable(false);
      setNodes([]);
    }).finally(() => {
      setLoading(false);
    });

    return () => {
      try {
        controller.abort();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, loadStructure]);

  if (loading || nodes === null) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-2 text-gray-500">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Chargement...</span>
        </div>
      </div>
    );
  }

  if (!available) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <WifiOff className="w-12 h-12 text-red-400 mb-4" />
        <p className="text-gray-600 font-medium">BDD Web inaccessible</p>
        <p className="text-sm text-gray-400 mt-1 max-w-xs">
          {error || 'Vérifiez votre connexion et la configuration WEB_API_URL / WEB_API_KEY'}
        </p>
        <button
          onClick={handleUploaded}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4 inline mr-2" />
          Réessayer
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 rounded-lg text-red-600 text-sm">
        ❌ Erreur: {error}
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <Database className="w-12 h-12 mx-auto text-gray-300 mb-4" />
        <p>Aucune donnée trouvée</p>
        <p className="text-sm">Source: {source === 'local' ? 'Locale' : source === 'vector' ? 'Vectorielle' : 'Web'}</p>
      </div>
    );
  }

  return (
    <div className="font-mono text-sm h-full flex flex-col">
      <div className="flex items-center gap-1 p-2 border-b">
        <button
          type="button"
          onClick={handleBack}
          disabled={historyIndex <= 0}
          className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          title="Précédent"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleForward}
          disabled={historyIndex >= history.length - 1}
          className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          title="Suivant"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <select
          value={sortField}
          onChange={(e) => setSortField(e.target.value as any)}
          className="text-xs border border-gray-200 rounded px-1.5 py-0.5 bg-white text-gray-700"
        >
          <option value="name">Nom</option>
          <option value="type">Type</option>
          <option value="size">Taille</option>
          <option value="date">Date</option>
        </select>
        <button
          type="button"
          onClick={() => setSortDirection(d => d === 'asc' ? 'desc' : 'asc')}
          className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
          title={sortDirection === 'asc' ? 'Croissant' : 'Décroissant'}
        >
          <ArrowUpDown className="w-4 h-4" />
        </button>
        <span className="text-xs text-gray-500 ml-1">Arborescence</span>
        <div className="ml-auto flex items-center gap-1">
          <Search className="w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrer..."
            className="text-xs border border-gray-200 rounded px-1.5 py-0.5 bg-white text-gray-700 w-32 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>
      {searchQuery.trim() && (
        <div className="text-xs text-gray-500 px-2 py-1 border-b bg-gray-50">
          {(() => {
            const sorted = sortNodes(nodes);
            const filtered = filterTree(sorted, searchQuery);
            return `${filtered.length} résultat${filtered.length !== 1 ? 's' : ''}`;
          })()}
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-2 min-h-0">
        {(() => {
          const sorted = sortNodes(nodes);
          const filtered = filterTree(sorted, searchQuery);

          if (filtered.length === 0 && searchQuery.trim()) {
            return (
              <div className="p-4 text-center text-gray-500 text-sm">
                Aucun résultat pour "{searchQuery}"
              </div>
            );
          }

          return filtered.map(node => (
            <TreeNodeItem
              key={node.path}
              node={node}
              depth={0}
              expanded={expanded}
              onToggle={toggleExpand}
              onSelect={handleSelect}
              selectedPath={selectedPath}
              getNodeIcon={getNodeIcon}
              getNodeLabel={getNodeLabel}
              source={source}
              onUploaded={handleUploaded}
              uploadEnabled={
                source === 'web'
                  ? webAvailable && isAdmin
                  : source === 'vector'
                    ? false
                    : true
              }
              mutationsEnabled={mutationsEnabled}
              isAdmin={isAdmin}
              onNodeDeleted={removeNodeFromTree}
              onNodeRenamed={renameNodeInTree}
              onNodeAdded={addNodeToTree}
              onExpandParent={handleExpandParent}
              repository={activeRepo ?? undefined}
              onContextMenu={(node, event) => setContextMenu({ x: event.clientX, y: event.clientY, node })}
              getNodeTooltipContent={buildTooltipContent}
              formatSize={formatSize}
              formatDate={formatDate}
            />
          ));
        })()}
      </div>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={
            source === 'local'
              ? [
                  {
                    label: 'Copier le chemin relatif',
                    onClick: () => handleCopyPath(contextMenu.node, 'relative'),
                    icon: <Copy className="w-3.5 h-3.5" />,
                  },
                  {
                    label: 'Copier le chemin absolu',
                    onClick: () => handleCopyPath(contextMenu.node, 'absolute'),
                    icon: <Copy className="w-3.5 h-3.5" />,
                  },
                ]
              : [
                  {
                    label: 'Copier le chemin',
                    onClick: () => handleCopyPath(contextMenu.node, 'relative'),
                    icon: <Copy className="w-3.5 h-3.5" />,
                  },
                ]
          }
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

interface TreeNodeItemProps {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (node: TreeNode) => void;
  onSelect: (node: TreeNode) => void;
  selectedPath?: string;
  getNodeIcon: (node: TreeNode) => React.ReactNode;
  getNodeLabel: (node: TreeNode) => string;
  source: StructureSource;
  onUploaded?: () => void;
  uploadEnabled: boolean;
  mutationsEnabled: boolean;
  isAdmin?: boolean;
  onNodeDeleted: (path: string) => void;
  onNodeRenamed: (oldPath: string, newPath: string, newName: string) => void;
  onNodeAdded: (parentPath: string, newNode: TreeNode) => void;
  onExpandParent: (path: string) => void;
  repository?: string;
  onContextMenu?: (node: TreeNode, event: React.MouseEvent) => void;
  getNodeTooltipContent?: (node: TreeNode) => React.ReactNode;
  formatSize: (bytes?: number) => string;
  formatDate: (dateString?: string) => string;
}

const TreeNodeItem = memo(function TreeNodeItem({
  node,
  depth,
  expanded,
  onToggle,
  onSelect,
  selectedPath,
  getNodeIcon,
  getNodeLabel,
  source,
  onUploaded,
  uploadEnabled,
  mutationsEnabled,
  isAdmin,
  onNodeDeleted,
  onNodeRenamed,
  onNodeAdded,
  onExpandParent,
  repository,
  onContextMenu,
  getNodeTooltipContent,
  formatSize,
  formatDate
}: TreeNodeItemProps) {
  const isExpanded = expanded.has(node.path);
  const isSelected = selectedPath === node.path;
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(node.name);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const paddingLeft = `${depth * 16 + 8}px`;

  const isVectorSource = source === 'vector';
  const metadata = node.metadata as Record<string, string | number | boolean | undefined> | undefined;
  const isFileNotVectorized = isVectorSource && node.type === 'file' && metadata?.vectorized !== true;

  const handleRename = async () => {
    if (!editName.trim() || editName === node.name) {
      setIsEditing(false);
      return;
    }
    if (!mutationsEnabled) {
      setActionError('Renommage impossible : la BDD locale (.data) est une référence immuable.');
      setIsEditing(false);
      return;
    }
    const oldPath = node.path;
    const parts = oldPath.split('/');
    parts[parts.length - 1] = editName.trim();
    const newPath = parts.join('/');
    const result = await treeAction('rename', node.path, source, editName.trim(), repository);
    if (result.success) {
      onNodeRenamed(oldPath, newPath, editName.trim());
    } else {
      setActionError(result.error || 'Renommage impossible');
    }
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!mutationsEnabled) {
      setActionError('Suppression impossible : la BDD locale (.data) est une référence immuable.');
      return;
    }
    if (!isDeleting) {
      setIsDeleting(true);
      return;
    }
    const result = await treeAction('delete', node.path, source, undefined, repository);
    if (result.success) {
      onNodeDeleted(node.path);
    } else {
      setActionError(result.error || 'Suppression impossible');
    }
    setIsDeleting(false);
  };

  const handleAdd = async () => {
    if (!newName.trim()) {
      setIsAdding(false);
      return;
    }
    if (!mutationsEnabled) {
      setActionError('Création impossible : la BDD locale (.data) est une référence immuable.');
      setIsAdding(false);
      return;
    }
    const result = await treeAction('mkdir', node.path, source, newName.trim(), repository);
    if (result.success) {
      const newNode: TreeNode = {
        name: newName.trim(),
        path: node.path ? `${node.path}/${newName.trim()}` : newName.trim(),
        type: 'directory',
        children: []
      };
      onNodeAdded(node.path, newNode);
      onExpandParent(node.path);
    } else {
      setActionError(result.error || 'Création impossible');
    }
    setIsAdding(false);
    setNewName('');
  };

  const startEditing = () => {
    setEditName(node.name);
    setIsEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const handleRowClick = () => {
    if (isEditing || isAdding) return;
    onSelect(node);
    if (node.type === 'directory') {
      onToggle(node);
    }
  };

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isEditing || isAdding) return;
    if (node.type === 'directory') {
      onToggle(node);
    }
  };

  const stopRowClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const stopRowKey = (e: React.KeyboardEvent) => {
    e.stopPropagation();
  };

  return (
    <div>
      {actionError && (
        <div className="px-2 py-1 text-xs text-red-600" style={{ paddingLeft }}>
          {actionError}
        </div>
      )}
      <div
        className={`group flex items-center gap-1 py-1 px-2 rounded cursor-pointer hover:bg-gray-100 transition-colors
          ${isSelected ? 'bg-blue-50 border border-blue-200' : ''}`}
        style={{ paddingLeft }}
        onClick={handleRowClick}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu?.(node, e);
        }}
        role="treeitem"
        aria-expanded={node.type === 'directory' ? isExpanded : undefined}
        aria-selected={isSelected}
      >
        {node.type === 'directory' && !isEditing && (
          <button
            type="button"
            onClick={handleChevronClick}
            className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-700 focus:outline-none"
            aria-label={isExpanded ? 'Réduire' : 'Développer'}
            tabIndex={-1}
          >
            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        )}
        {node.type === 'file' && !isEditing && <span className="w-4 h-4" />}
        {isEditing ? (
          <span className="w-4 h-4 flex-shrink-0" />
        ) : (
          getNodeIcon(node)
        )}
        {isEditing ? (
          <form
            className="flex items-center gap-1 flex-1 min-w-0"
            onSubmit={(e) => { e.preventDefault(); handleRename(); }}
            onClick={stopRowClick}
          >
            <input
              ref={inputRef}
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="flex-1 min-w-0 px-1 py-0 text-sm border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
              onBlur={handleRename}
              onClick={stopRowClick}
              onKeyDown={stopRowKey}
            />
            <button type="submit" className="p-0.5 text-green-600 hover:text-green-700" onClick={stopRowClick}>
              <Check className="w-3 h-3" />
            </button>
            <button type="button" className="p-0.5 text-gray-400 hover:text-gray-600" onClick={(e) => { stopRowClick(e); setIsEditing(false); }}>
              <X className="w-3 h-3" />
            </button>
          </form>
        ) : (
          <Tooltip content={getNodeTooltipContent?.(node)}>
            <span className={`truncate text-sm flex-1 min-w-0 ${isFileNotVectorized ? 'text-gray-400' : ''}`}>
              {getNodeLabel(node)}
              <VectorBadges node={node} source={source} />
            </span>
          </Tooltip>
        )}
        {node.metadata?.equipmentCount !== undefined && !isEditing && (
          <span className="text-xs text-gray-400 ml-1">
            ({node.metadata.equipmentCount})
          </span>
        )}
        {!isEditing && !isAdding && source !== 'vector' && (source !== 'web' || isAdmin) && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={stopRowClick} onMouseDown={stopRowClick}>
            <button
              type="button"
              disabled={!mutationsEnabled}
              onClick={(e) => { stopRowClick(e); startEditing(); }}
              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              title={mutationsEnabled ? 'Renommer' : 'BDD locale en lecture seule'}
            >
              <Pencil className="w-3 h-3" />
            </button>
            {node.type === 'directory' && (
              <button
                type="button"
                disabled={!mutationsEnabled}
                onClick={(e) => { stopRowClick(e); setNewName(''); setIsAdding(true); }}
                className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                title={mutationsEnabled ? 'Ajouter un dossier' : 'BDD locale en lecture seule'}
              >
                <FolderPlus className="w-3 h-3" />
              </button>
            )}
            <button
              type="button"
              disabled={!mutationsEnabled}
              onClick={(e) => { stopRowClick(e); handleDelete(); }}
              className={`p-1 rounded transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${isDeleting ? 'text-red-600 bg-red-50' : 'text-gray-400 hover:text-red-600 hover:bg-red-50'}`}
              title={!mutationsEnabled ? 'BDD locale en lecture seule' : isDeleting ? 'Cliquer pour confirmer' : 'Supprimer'}
            >
              <Trash2 className="w-3 h-3" />
            </button>
            {node.type === 'directory' && mutationsEnabled && (
              <FileUploadButton
                targetPath={node.path}
                source={source}
                iconSize={14}
                repository={repository}
                onUploadComplete={() => onUploaded?.()}
              />
            )}
          </div>
        )}
        <div className="flex items-center gap-3 text-xs text-gray-400 ml-auto pl-2 shrink-0">
          {node.type === 'directory' && node.children && (
            <span className="w-16 text-right tabular-nums">{node.children.length} éléments</span>
          )}
          {node.type === 'file' && node.size && (
            <span className="w-16 text-right tabular-nums">{formatSize(node.size)}</span>
          )}
          {(node.metadata?.updatedAt || node.metadata?.createdAt) && (
            <span className="w-20 text-right tabular-nums">{formatDate(node.metadata.updatedAt || node.metadata.createdAt)}</span>
          )}
          {isVectorSource && metadata?.vectorized !== undefined && (
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${metadata.vectorized ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {metadata.vectorized ? 'vectorisé' : 'non vectorisé'}
            </span>
          )}
        </div>
      </div>
      {isAdding && (
        <div className="flex items-center gap-1 py-1 px-2" style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }} onClick={stopRowClick} onMouseDown={stopRowClick}>
          <Folder className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <form
            className="flex items-center gap-1 flex-1 min-w-0"
            onSubmit={(e) => { e.preventDefault(); handleAdd(); }}
            onClick={stopRowClick}
          >
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nom du dossier..."
              className="flex-1 min-w-0 px-1 py-0 text-sm border border-green-400 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
              autoFocus
              onBlur={handleAdd}
              onClick={stopRowClick}
              onKeyDown={stopRowKey}
            />
            <button type="submit" className="p-0.5 text-green-600 hover:text-green-700" onClick={stopRowClick}>
              <Check className="w-3 h-3" />
            </button>
            <button type="button" className="p-0.5 text-gray-400 hover:text-gray-600" onClick={(e) => { stopRowClick(e); setIsAdding(false); }}>
              <X className="w-3 h-3" />
            </button>
          </form>
        </div>
      )}
      {node.type === 'directory' && isExpanded && node.children && node.children.length > 0 && (
        <div>
          {node.children.map(child => (
            <TreeNodeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
              selectedPath={selectedPath}
              getNodeIcon={getNodeIcon}
              getNodeLabel={getNodeLabel}
              source={source}
              onUploaded={onUploaded}
              uploadEnabled={uploadEnabled}
              mutationsEnabled={mutationsEnabled}
              isAdmin={isAdmin}
              onNodeDeleted={onNodeDeleted}
              onNodeRenamed={onNodeRenamed}
              onNodeAdded={onNodeAdded}
              onExpandParent={onExpandParent}
              repository={repository}
             onContextMenu={onContextMenu}
             getNodeTooltipContent={getNodeTooltipContent}
             formatSize={formatSize}
             formatDate={formatDate}
           />
          ))}
        </div>
      )}
    </div>
  );
});
