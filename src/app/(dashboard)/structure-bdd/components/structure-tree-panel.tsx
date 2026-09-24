// src/app/(dashboard)/structure-bdd/components/structure-tree-panel.tsx
"use client";

import { useState } from "react";
import { DatabaseTree, TreeNode } from "@/components/structure/database-tree";
import { FolderTree, Search, Server, Globe, Brain, RefreshCw } from "lucide-react";
import { StructureSource } from "@/lib/database/structure-types";
import { useToast } from "@/components/notifications/toast-provider";

interface StructureTreePanelProps {
  source: StructureSource;
  onSelectNode: (node: TreeNode) => void;
  selectedPath?: string;
  onRefresh?: () => void;
  activeRepo?: string | null;
  refreshKey?: number;
  isAdmin?: boolean;
  onCopyPath?: (node: TreeNode) => void;
  onDownload?: (node: TreeNode) => void;
  onRename?: (node: TreeNode) => void;
  onDelete?: (node: TreeNode) => void;
}

export function StructureTreePanel({
  source,
  onSelectNode,
  selectedPath,
  onRefresh,
  activeRepo,
  refreshKey,
  isAdmin,
  onCopyPath,
  onDownload,
  onRename,
  onDelete,
}: StructureTreePanelProps) {
  const [filterText, setFilterText] = useState("");
  const { toasts } = useToast();
  const hasPendingConfirm = toasts.some(t => t.variant === "confirm");

  const getSourceIcon = () => {
    switch (source) {
      case "local":
        return <Server className="w-3.5 h-3.5 text-blue-500" />;
      case "web":
        return <Globe className="w-3.5 h-3.5 text-purple-500" />;
      case "vector":
        return <Brain className="w-3.5 h-3.5 text-green-500" />;
      default:
        return null;
    }
  };

  const getSourceLabel = () => {
    switch (source) {
      case "local":
        return "Local (.data/)";
      case "web":
        return "Web Externe";
      case "vector":
        return "Vectorielle (chroma/)";
      default:
        return "";
    }
  };

  return (
    <div className="bg-white rounded-lg border flex flex-col h-full overflow-hidden shadow-xs">
      <div className="p-3 border-b bg-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderTree className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-semibold text-gray-800">
            Arborescence
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 flex items-center gap-1 bg-white border border-gray-200 px-2 py-0.5 rounded-md">
            {getSourceIcon()}
            {getSourceLabel()}
          </span>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={hasPendingConfirm}
              className={`p-1 hover:bg-gray-200 rounded text-gray-500 transition-colors ${hasPendingConfirm ? "opacity-50 cursor-not-allowed" : ""}`}
              title={hasPendingConfirm ? "Attendez la confirmation ou annulation de la suppression" : "Rafraîchir l'arborescence"}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="p-2 border-b bg-white">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filtrer l'arborescence..."
            className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all"
          />
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <DatabaseTree
          source={source}
          onSelect={onSelectNode}
          selectedPath={selectedPath}
          webAvailable={source === "local" ? true : true}
          activeRepo={activeRepo}
          isAdmin={isAdmin}
          onCopyPath={onCopyPath}
          onDownload={onDownload}
          onRename={onRename}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}
