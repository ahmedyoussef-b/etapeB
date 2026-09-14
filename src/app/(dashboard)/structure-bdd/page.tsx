"use client";

import { useState, useCallback } from "react";
import { Database, Rocket, RefreshCw, Server, Globe } from "lucide-react";
import { StructureTreePanel } from "./components/structure-tree-panel";
import { RepositorySelector } from "./components/repository-selector";
import { useSyncStatus } from "./hooks/useSyncStatus";
import { StructureDetailPanel } from "@/components/structure/structure-detail-panel";
import { ImplanteWizard } from "./components/implante-wizard";
import type { TreeNode } from "@/components/structure/tree-utils";
import { useToastHelpers } from "@/components/notifications/toast-provider";

type ViewMode = "split" | "implante";
type StructureSource = "local" | "web";

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
      if (stored === "local" || stored === "web") return stored;
    }
    return "local";
  });
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [activeRepo, setActiveRepo] = useState<string | null>(null);
const [resetting, setResetting] = useState(false);
    const [syncingFiles, setSyncingFiles] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const toast = useToastHelpers();

  const { data: syncStatus, refetch: refetchStatus } = useSyncStatus();

  const handleSourceChange = useCallback((newSource: StructureSource) => {
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

  const handleRepoChange = useCallback((repo: string) => {
    const normalized = repo === '.data' ? '.data' : (repo.startsWith('repositories/') ? repo : `repositories/${repo}`);
    setActiveRepo(normalized);
    setSelectedNode(null);
  }, []);

  const handleResetFromData = useCallback(async () => {
    // Show a confirmation toast with Confirmer/Annuler buttons instead of window.confirm
    const confirmed = await toast.confirm(
      "Cette action est irréversible. Toutes les modifications non synchronisées seront perdues et la structure sera réinitialisée depuis le répertoire .data/.",
      "Réinitialiser depuis .data/ ?",
      { confirmLabel: 'Réinitialiser', cancelLabel: 'Annuler' }
    );

    if (!confirmed) {
      return;
    }

    setResetting(true);
    try {
      const res = await fetch("/api/repository", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resetFromData", targetRepo: activeRepo || ".data" }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Réinitialisation depuis .data/ terminée");
        window.location.reload();
      } else {
        toast.error(json.error || "Erreur lors de la réinitialisation");
      }
    } catch {
      toast.error("Erreur lors de la réinitialisation");
    } finally {
      setResetting(false);
    }
  }, [activeRepo, toast]);

  const handleSyncFiles = useCallback(async () => {
    setSyncingFiles(true);
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'files', repository: activeRepo, force: false }),
      });
      const json = await res.json();
      if (json.success) {
        const r = json.result;
        toast.success(
          `Sync terminé: ${r.copied} copié(s), ${r.deduplicated} dédupliqué(s), ${r.purged} purgé(s) sur ${r.total}`,
          'Synchronisation des fichiers'
        );
        window.location.reload();
      } else {
        toast.error(json.error || 'Erreur lors de la synchronisation');
      }
    } catch {
      toast.error('Erreur lors de la synchronisation');
    } finally {
      setSyncingFiles(false);
    }
  }, [activeRepo, toast]);

  const isLocalEditable = source === "local" && activeRepo !== ".data";

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
          {isLocalEditable && (
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
              Réinitialiser depuis .data/
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

      {source === "local" && (
        <div className="mb-4">
          <RepositorySelector onRepoChange={handleRepoChange} />
        </div>
      )}

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
          />
        </div>
        <div className="min-h-0">
          <StructureDetailPanel
            node={selectedNode}
            source={source}
            available={true}
            repository={activeRepo ?? undefined}
          />
        </div>
      </div>

      <div className="mt-4 text-xs text-gray-400 flex items-center justify-between">
        <span>
          Source: {source === "local" ? "📍 Locale" : "🌐 Web"}
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
    </div>
  );
}
