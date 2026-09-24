"use client";

import { useState, useCallback } from "react";
import { Database, Rocket, RefreshCw, Server, Globe, Brain, ArrowDownToLine, Copy, Download, Pencil, Trash2 } from "lucide-react";
import { StructureTreePanel } from "./components/structure-tree-panel";
import { useSyncStatus } from "./hooks/useSyncStatus";
import { StructureDetailPanel } from "@/components/structure/structure-detail-panel";
import { ImplanteWizard } from "./components/implante-wizard";
import { ResetDatabaseDialog } from "@/components/structure/reset-database-dialog";
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
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [source, setSource] = useState<StructureSource>(() => {
    // En production Vercel, forcer 'web'
    if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_VERCEL_ENV) {
      return "web";
    }
    // En local, lire depuis localStorage
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("bdd-source");
      if (stored === "local" || stored === "web" || stored === "vector") return stored;
    }
    return "local";
  });
  const isVercel = !!process.env.NEXT_PUBLIC_VERCEL_ENV;
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [activeRepo, setActiveRepo] = useState<string>('repository');
  const [resetting, setResetting] = useState(false);
  const [syncingFiles, setSyncingFiles] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isInjectDialogOpen, setIsInjectDialogOpen] = useState(false);
  const toast = useToastHelpers();
  const { push: pushToast, dismiss: dismissToast } = useToast();
  const { role } = useAuth();

  const { data: syncStatus, refetch: refetchStatus } = useSyncStatus();

  const handleSourceChange = useCallback((newSource: StructureSource) => {
    if ((newSource === "local" || newSource === "vector") && process.env.NEXT_PUBLIC_VERCEL_ENV) {
      return;
    }
    setSource(newSource);
    setSelectedNode(null);
    if (!process.env.NEXT_PUBLIC_VERCEL_ENV) {
      localStorage.setItem("bdd-source", newSource);
    }
  }, []);

  const handleSelect = useCallback((node: TreeNode) => {
    setSelectedNode(node);
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshKey(k => k + 1);
    refetchStatus();
  }, [refetchStatus]);

  const handleOpenImplante = useCallback(() => {
    setViewMode("implante");
    setSelectedNode(null);
  }, []);

  const handleBackToSplit = useCallback(() => {
    setViewMode("split");
  }, []);

  const handleResetFromData = useCallback(async () => {
    setIsResetDialogOpen(true);
  }, []);

  const handleResetConfirm = useCallback(async ({ backup }: { backup: boolean }) => {
    if (source === "vector") {
      toast.error("La source vectorielle ne peut pas être réinitialisée");
      return;
    }

    setResetting(true);
    try {
      if (backup && isTauriEnv()) {
        try {
          await invoke("create_backup", { repository: activeRepo || ".data" });
        } catch {
          toast.warning("Backup échoué, le reset continue");
        }
      }
      const res = await fetch("/api/admin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backup }),
      });
      const json = await res.json();
      if (json?.success) {
        toast.success("Réinitialisation terminée");
        window.location.reload();
      } else {
        toast.error(json?.error || "Erreur lors de la réinitialisation");
      }
    } catch {
      toast.error("Erreur lors de la réinitialisation");
    } finally {
      setResetting(false);
    }
  }, [activeRepo, source, toast]);

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
        setRefreshKey(k => k + 1);
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

  const isLocalEditable = source === "local" && activeRepo !== ".data";

  const canMutate = isLocalEditable || (source === "web" && (role as string) === "admin" && !isTauriEnv());

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
      setRefreshKey(k => k + 1);
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
          setRefreshKey(k => k + 1);
        }
      });
      setTimeout(() => dismissToast(id), 8000);
      setRefreshKey(k => k + 1);
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
          {isLocalEditable && (
            <button
              type="button"
              onClick={handleSyncFiles}
              disabled={syncingFiles}
              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm disabled:opacity-50"
            >
              {syncingFiles ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Synchroniser depuis Web
            </button>
          )}
          {(role as string) === "admin" && source !== "vector" && (
            <button
              type="button"
              onClick={handleResetFromData}
              disabled={resetting}
              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm disabled:opacity-50"
            >
              {resetting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Database className="w-4 h-4" />
              )}
              {source === "web" ? "Reset BDD" : "Réinitialiser depuis .data/"}
            </button>
          )}
          {(role as string) === "admin" && isTauriEnv() && (
            <button
              type="button"
              onClick={() => setIsInjectDialogOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm"
            >
              <ArrowDownToLine className="w-4 h-4" />
              Injecter depuis Web
            </button>
          )}
          <button
            type="button"
            onClick={handleOpenImplante}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Rocket className="w-4 h-4" />
            Implanter
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
        <div className="min-h-0">
          <StructureTreePanel
            key={refreshKey}
            source={source}
            onSelectNode={handleSelect}
            selectedPath={selectedNode?.path}
            onRefresh={handleRefresh}
            activeRepo={activeRepo}
            refreshKey={refreshKey}
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

      <ResetDatabaseDialog
        open={isResetDialogOpen}
        onOpenChange={setIsResetDialogOpen}
        source={source}
        onConfirm={handleResetConfirm}
        isLoading={resetting}
      />
      <InjectFromWebDialog
        open={isInjectDialogOpen}
        onOpenChange={setIsInjectDialogOpen}
      />
    </div>
  );
}
