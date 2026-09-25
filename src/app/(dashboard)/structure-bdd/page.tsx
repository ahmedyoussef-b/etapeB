"use client";

import { useState, useCallback } from "react";
import { Database, Rocket, RefreshCw, Server, Globe, Brain, ArrowDownToLine, Copy, Download, Pencil, Trash2, Loader2 } from "lucide-react";
import { StructureTreePanel } from "./components/structure-tree-panel";
import { useSyncStatus } from "./hooks/useSyncStatus";
import { StructureDetailPanel } from "@/components/structure/structure-detail-panel";
import { ImplanteWizard } from "./components/implante-wizard";
import { InjectFromWebDialog } from "@/components/admin/InjectFromWebDialog";
import type { TreeNode } from "@/components/structure/tree-utils";
import { useToastHelpers, useToast } from "@/components/notifications/toast-provider";
import { StructureSource } from "@/lib/database/structure-types";
import { fetchRepositoryInfo, treeAction, fetchFileContent } from "@/lib/api/local-first";
import { WORKING_REPOSITORY_PATH } from "@/lib/config/repository";
import { syncFromWeb } from "@/lib/api/sync-tauri";
import { isTauriEnv } from "@/lib/tauri/env";
import { useAuth } from "@/lib/auth/use-auth";
import { invoke } from "@tauri-apps/api/core";
import { isButtonVisible, type ButtonKey, type VisibilityContext, assertButtonVisibility } from "./lib/button-visibility";

const SYNC_TIMEOUT_MS = 60_000;

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxAttempts = 3,
  delayMs = 1000,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.status >= 500) {
        throw new Error(`Server error ${res.status}`);
      }
      return res;
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        console.warn(`[SyncFiles] Attempt ${attempt} failed, retrying in ${delayMs}ms...`);
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  }
  throw lastError;
}

function dataUrlToBlob(dataUrl: string, fallbackMimeType: string): Blob {
  if (dataUrl.startsWith("data:")) {
    const [header, base64] = dataUrl.split(",");
    const mimeMatch = header.match(/data:([^;]+)/);
    const mimeType = mimeMatch?.[1] || fallbackMimeType;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
  }
  return new Blob([dataUrl], { type: fallbackMimeType });
}

type ViewMode = "split" | "implante";

export default function StructureBDDPage() {
  if (typeof window !== "undefined") {
    console.log("[SDB-INIT] origin:", window.location.origin);
    console.log("[SDB-INIT] isTauri:", !!(window as any).__TAURI__);
  }
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  type ResetTarget = 'local' | 'web';

  const [treeKey, setTreeKey] = useState(0);
  const [source, setSource] = useState<StructureSource>(() => {
    if (typeof window === "undefined") return "web";
    const saved = localStorage.getItem("bdd-source");
    if (saved === "local" || saved === "web" || saved === "vector") {
      console.log("[SDB-STATE] source initiale:", saved, "(localStorage)");
      return saved as StructureSource;
    }
    console.log("[SDB-STATE] source initiale: web (défaut)");
    return "web";
  });
  const isVercel = !!process.env.NEXT_PUBLIC_VERCEL_ENV;
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [activeRepo, setActiveRepo] = useState<string>('repository');
  const [resetting, setResetting] = useState<'local' | 'web' | null>(null);
  const [syncingFiles, setSyncingFiles] = useState(false);
  const [vectorizing, setVectorizing] = useState(false);
  const [isInjectDialogOpen, setIsInjectDialogOpen] = useState(false);
  const toast = useToastHelpers();
  const { push: pushToast, dismiss: dismissToast } = useToast();
  const { role } = useAuth();

  const isAdmin = (role as string)?.toLowerCase() === 'admin';

  const visibilityEnv = ((): VisibilityContext['env'] => {
    if (isTauriEnv()) return 'tauri';
    return 'web';
  })();

  const isLocalEditable = source === "local" && activeRepo !== ".data";

  const visibilityCtx: VisibilityContext = {
    env: visibilityEnv,
    isAdmin,
    isLocalEditable,
  };

  const checkButtonVisibility = (key: ButtonKey, expectedVisible: boolean) => {
    if (process.env.NODE_ENV === 'development') {
      try {
        assertButtonVisibility(key, visibilityCtx, expectedVisible);
      } catch (error) {
        console.error('[structure-bdd][visibility-guard]', error);
      }
    }
  };

  const { data: syncStatus, refetch: refetchStatus } = useSyncStatus();

  const handleSourceChange = useCallback((newSource: StructureSource) => {
    console.log("[SDB-UI] clic changement source:", source, "→", newSource, "| stack:", new Error().stack);
    if ((newSource === "local" || newSource === "vector") && process.env.NEXT_PUBLIC_VERCEL_ENV) {
      console.log("[SDB-STATE] changement source bloqué (Vercel)");
      return;
    }
    console.log("[SDB-STATE] source changée:", source, "→", newSource);
    setSource(newSource);
    setSelectedNode(null);
    if (!process.env.NEXT_PUBLIC_VERCEL_ENV) {
      localStorage.setItem("bdd-source", newSource);
      console.log("[SDB-STATE] localStorage bdd-source =", newSource);
    }
  }, [source]);

  const handleSelect = useCallback((node: TreeNode) => {
    setSelectedNode(node);
  }, []);

  const handleRefresh = useCallback(() => {
    setTreeKey(k => k + 1);
    refetchStatus();
  }, [refetchStatus]);

  const handleOpenImplante = useCallback(() => {
    setViewMode("implante");
    setSelectedNode(null);
  }, []);

  const handleBackToSplit = useCallback(() => {
    setViewMode("split");
  }, []);

  const handleReset = async (target: ResetTarget) => {
    console.log(`[SDB-UI] === RESET ${target.toUpperCase()} ===`);
    console.log('[SDB-UI] source affichée (ignorée):', source);
    console.log('[SDB-UI] cible FORCÉE:', target);

    setResetting('local');
    try {
      let result: any;
      if (isTauriEnv()) {
        if (target === 'local') {
          console.log('[SDB-RUST] appel reset_local_repository');
          result = await invoke('reset_local_repository', {
            repository: activeRepo || 'repository',
          });
        } else {
          console.log('[SDB-RUST] appel reset_web');
          result = await invoke('reset_web');
        }
      } else {
        if (target === 'local') {
          toast.error('Reset local uniquement en Tauri');
          setResetting(null);
          return;
        }
        console.log('[SDB-API] appel /api/admin/reset (navigateur)');
        const res = await fetch('/api/admin/reset', { method: 'POST' });
        result = await res.json();
      }

      console.log('[SDB-UI] reset terminé:', result);

      // ✅ FIX : pas de reload — forcer la cible + remonter le tree
      setSource(target);
      localStorage.setItem('bdd-source', target);
      setTreeKey(prev => prev + 1);
      refetchStatus();

      toast.success(`BDD ${target === 'local' ? 'locale' : 'Web'} réinitialisée`);
    } catch (err) {
      console.error(`[SDB-UI] erreur reset ${target}:`, err);
      toast.error('Erreur lors de la réinitialisation');
    } finally {
      setResetting(null);
    }
  };

  const handleSyncFiles = useCallback(async () => {
    setSyncingFiles(true);
    try {
      let json: any;
      if (isTauriEnv()) {
        const r = await syncFromWeb('files', activeRepo, false);
        json = { success: r.success, result: r };
      } else {
        const res = await fetchWithRetry('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'files', repository: activeRepo, force: false }),
          signal: AbortSignal.timeout(SYNC_TIMEOUT_MS),
        });
        json = await res.json();
      }
      console.log('[SyncFiles] result', json);

      if (json?.success) {
        const r = json.result;
        const summary = `Sync fichiers: ${r.copied} copié(s), ${r.deduplicated} dédupliqué(s), ${r.errors} erreur(s) sur ${r.total} fichier(s)`;
        console.log('[SyncFiles]', summary, r);
        if (r.total === 0) {
          toast.info('Aucun fichier à synchroniser depuis le web.', 'Synchronisation des fichiers');
        } else {
          toast.success(summary, 'Synchronisation des fichiers');
        }
        setTreeKey(k => k + 1);
        refetchStatus();
      } else {
        toast.error(json?.error || 'Erreur lors de la synchronisation');
      }
    } catch (err) {
      if (err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
        toast.error(`Synchronisation expirée après ${SYNC_TIMEOUT_MS / 1000}s. Réessayez.`);
      } else {
        toast.error('Erreur lors de la synchronisation');
      }
      console.error('[SyncFiles] error', err);
    } finally {
      setSyncingFiles(false);
    }
  }, [activeRepo, toast, refetchStatus]);

  const handleVectorize = async () => {
    console.log('[SDB-UI] === VECTORIZE ===');
    setVectorizing(true);
    try {
      let result: any;
      if (isTauriEnv()) {
        result = await invoke('vectorize_now', {
          repository: activeRepo || 'repository',
        });
      } else {
        toast.error('Vectorisation uniquement en Tauri');
        return;
      }

      console.log('[SDB-UI] vectorize terminé:', result);

      if (result?.success) {
        toast.success(`Vectorisation: ${result.vectorizedFiles}/${result.totalFiles} fichiers (${result.totalChunks} chunks)`);
      } else {
        toast.error(result?.error || 'Erreur de vectorisation');
      }
    } catch (err) {
      console.error('[SDB-UI] erreur vectorize:', err);
      toast.error('Erreur de vectorisation');
    } finally {
      setVectorizing(false);
    }
  };

  const handlePurgeVectoriel = async () => {
    const confirmed = window.confirm('Purge de la base vectorielle ?\nCela supprimera tous les embeddings Chroma et le fichier meta.json.');
    if (!confirmed) return;

    setVectorizing(true);
    try {
      let result: any;
      if (isTauriEnv()) {
        result = await invoke('purge_vectoriel');
      } else {
        toast.error('Purge vectorielle uniquement en Tauri');
        return;
      }

      console.log('[SDB-UI] purge vectoriel terminé:', result);

      if (result?.success) {
        toast.success(result.message || 'Base vectorielle purgée');
      } else {
        toast.error(result?.error || 'Erreur lors de la purge vectorielle');
      }
    } catch (err) {
      console.error('[SDB-UI] erreur purge vectoriel:', err);
      toast.error('Erreur lors de la purge vectorielle');
    } finally {
      setVectorizing(false);
    }
  };

  const canMutate = source === "local" && activeRepo !== ".data" || (source === "web" && (role as string)?.toLowerCase() === "admin");

  const handleCopyPath = useCallback(async (node: TreeNode) => {
    const text = source === "local"
      ? `%APPDATA%\\NexaFlow\\${WORKING_REPOSITORY_PATH}\\${node.path}`
      : node.path;
    await navigator.clipboard.writeText(text).then(() => {
      toast.success(`Chemin copié : ${text}`);
    }).catch(() => {
      toast.error('Impossible de copier le chemin');
    });
  }, [source, toast]);

  const handleDownload = useCallback(async (node: TreeNode) => {
    if (node.type !== "file") return;
    try {
      const data = await fetchFileContent(node.path, source, activeRepo || undefined);
      if (!data?.success) {
        toast.error(data?.error || "Impossible de télécharger le fichier");
        return;
      }
      const blob = dataUrlToBlob(data.content, data.mimeType || "application/octet-stream");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = node.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Téléchargement de ${node.name} démarré`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors du téléchargement");
    }
  }, [source, activeRepo, toast]);

  const handleRename = useCallback(async (node: TreeNode) => {
    if (!canMutate) {
      toast.error("Renommage impossible : référence immuable ou droits insuffisants");
      return;
    }
    const newName = window.prompt(`Renommer "${node.name}" en :`, node.name);
    if (!newName || newName.trim() === "" || newName === node.name) return;
    const result = await treeAction("rename", node.path, source, newName.trim(), activeRepo || undefined);
    if (result.success) {
      toast.success(`Renommé : "${node.name}" → "${newName.trim()}"`);
      setTreeKey(k => k + 1);
    } else {
      toast.error(result.error || "Renommage impossible");
    }
  }, [source, activeRepo, canMutate, toast]);

  const handleDelete = useCallback(async (node: TreeNode) => {
    if (!canMutate) {
      toast.error("Suppression impossible : référence immuable ou droits insuffisants");
      return;
    }
    const confirmed = window.confirm(`Supprimer "${node.name}" ?\nCette action est irréversible.`);
    if (!confirmed) return;
    const result = await treeAction("delete", node.path, source, undefined, activeRepo || undefined);
    if (result.success) {
      const id = pushToast({
        variant: "confirm",
        title: "Supprimé",
        message: `"${node.name}" a été supprimé.`,
        duration: 0,
        confirmLabel: "OK",
        cancelLabel: "Annuler",
        onConfirm: () => {
          dismissToast(id);
        },
        onCancel: () => {
          setTreeKey(k => k + 1);
        }
      });
      setTimeout(() => dismissToast(id), 8000);
      setTreeKey(k => k + 1);
    } else {
      toast.error(result.error || "Suppression impossible");
    }
  }, [source, activeRepo, canMutate, toast, pushToast, dismissToast]);

  if (viewMode === "implante") {
    return (
      <div className="p-4 h-full flex flex-col">
        <ImplanteWizard onBack={handleBackToSplit} />
      </div>
    );
  }

  if (process.env.NODE_ENV === 'development') {
    checkButtonVisibility('resetLocal', isTauriEnv() && isAdmin);
    checkButtonVisibility('resetWeb', isAdmin);
    checkButtonVisibility('injectFromWeb', isTauriEnv() && isAdmin);
    checkButtonVisibility('syncFromWeb', isTauriEnv() && isLocalEditable);
    checkButtonVisibility('vectorize', isTauriEnv() && isAdmin);
    checkButtonVisibility('purgeVectoriel', isTauriEnv() && isAdmin);
    checkButtonVisibility('implante', isAdmin);
  }

  return (
    <div className="p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Database className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold">Structure de la BDD</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!isVercel && (
          <button
            type="button"
            onClick={() => handleSourceChange("local")}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
              source === "local"
                ? "bg-blue-50 border-blue-500 text-blue-700 shadow-xs"
                : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
            }`}
          >
            <Server className="w-4 h-4 text-blue-600" />
            Local
            <span className="text-[10px] text-gray-500">.data/</span>
          </button>
          )}
          <button
            type="button"
            onClick={() => handleSourceChange("web")}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
              source === "web"
                ? "bg-blue-50 border-blue-500 text-blue-700 shadow-xs"
                : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
            }`}
          >
            <Globe className="w-4 h-4 text-purple-600" />
            Web
            <span className="text-[10px] text-gray-500">Externe</span>
          </button>
          {!isVercel && (
          <button
            type="button"
            onClick={() => handleSourceChange("vector")}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
              source === "vector"
                ? "bg-green-50 border-green-500 text-green-700 shadow-xs"
                : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
            }`}
          >
            <Brain className="w-4 h-4 text-green-600" />
            Vectorielle
            <span className="text-[10px] text-gray-500">chroma/</span>
          </button>
          )}

          <div className="w-px h-6 bg-gray-300 mx-1" />

          {isTauriEnv() && isLocalEditable && (
            <button
              type="button"
              onClick={handleSyncFiles}
              disabled={syncingFiles}
              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm disabled:opacity-50"
              title="Synchronise les fichiers Web non-injectés vers le repository local"
            >
              {syncingFiles ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Synchroniser depuis Web
            </button>
          )}
          {(role as string) === "admin" && isTauriEnv() && (
            <button
              type="button"
              onClick={() => setIsInjectDialogOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm"
              title="Télécharge les fichiers Web non-injectés vers le repository local"
            >
              <ArrowDownToLine className="w-4 h-4" />
              Injection vers Local
            </button>
          )}

          <div className="w-px h-6 bg-gray-300 mx-1" />

          {(role as string) === "admin" && isTauriEnv() && (
            <button
              type="button"
              onClick={() => handleReset('local')}
              disabled={resetting === 'local'}
              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm disabled:opacity-50"
              title="Réinitialise la BDD locale depuis .data/ (immuable)"
            >
              {resetting === 'local' ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Database className="w-4 h-4" />
              )}
              Reset BDD Locale
            </button>
          )}
          {(role as string) === "admin" && (
            <button
              type="button"
              onClick={() => handleReset('web')}
              disabled={resetting === 'web'}
              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm disabled:opacity-50"
              title="Réinitialise la BDD Web depuis .data/ (immuable)"
            >
              {resetting === 'web' ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Database className="w-4 h-4" />
              )}
              Reset BDD Web
            </button>
          )}

          <div className="w-px h-6 bg-gray-300 mx-1" />

          {(role as string) === "admin" && isTauriEnv() && (
            <>
              <button
                type="button"
                onClick={handleVectorize}
                disabled={vectorizing}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm disabled:opacity-50"
                title="Vectorise manuellement les fichiers du repository local (Chroma)"
              >
                {vectorizing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Brain className="w-4 h-4" />
                )}
                {vectorizing ? 'Vectorisation...' : 'Vectoriser'}
              </button>
              <button
                type="button"
                onClick={handlePurgeVectoriel}
                disabled={vectorizing}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm disabled:opacity-50"
                title="Supprime la BDD vectorielle locale"
              >
                <Trash2 className="w-4 h-4" />
                Purger vectoriel
              </button>
            </>
          )}

          <div className="w-px h-6 bg-gray-300 mx-1" />

          {(role as string) === "admin" && (
            <button
              type="button"
              onClick={handleOpenImplante}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              <Rocket className="w-4 h-4" />
              Implanter
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
        <div className="min-h-0">
          <StructureTreePanel
            key={treeKey}
            source={source}
            onSelectNode={handleSelect}
            selectedPath={selectedNode?.path}
            onRefresh={handleRefresh}
            activeRepo={activeRepo}
            refreshKey={treeKey}
            isAdmin={(role as string) === "admin"}
            onCopyPath={handleCopyPath}
            onDownload={handleDownload}
            onRename={handleRename}
            onDelete={handleDelete}
          />
        </div>
        <div className="min-h-0">
          <StructureDetailPanel
            node={selectedNode}
            source={source}
            available={true}
            repository={activeRepo ?? undefined}
            onCopyPath={handleCopyPath}
            onDownload={handleDownload}
            onRename={handleRename}
            onDelete={handleDelete}
            canMutate={canMutate}
          />
        </div>
      </div>

      <div className="mt-4 text-xs text-gray-400 flex items-center justify-between">
        <span>
          Source: {source === "local" ? "📍 Locale" : source === "vector" ? "🧠 Vectorielle" : "🌐 Web"}
          {source === "local" && activeRepo && (
            <span className="ml-2 text-gray-500">
              ({activeRepo === ".data" ? "référence immuable" : `repository: ${activeRepo}`})
            </span>
          )}
          {syncStatus && (
            <span className={`ml-2 ${syncStatus.aligned ? "text-green-600" : "text-amber-600"}`}>
              {syncStatus.aligned ? "✓ Alignée" : "⚠ Désynchronisée"}
            </span>
          )}
        </span>
        <span>
          {selectedNode ? (
            `Sélectionné: ${selectedNode.name} (${selectedNode.type})`
          ) : (
            "Aucune sélection"
          )}
        </span>
      </div>

      <InjectFromWebDialog
        open={isInjectDialogOpen}
        onOpenChange={setIsInjectDialogOpen}
        onComplete={() => {
          setTreeKey(k => k + 1);
          refetchStatus();
        }}
      />
    </div>
  );
}
