"use client";

import { Server, Globe, CheckCircle2, AlertCircle } from "lucide-react";

export type StructureSource = "local" | "web";

interface SourceSelectorProps {
  currentSource: StructureSource;
  onSourceChange: (source: StructureSource) => void;
  dbAvailable?: boolean | null;
  webAvailable?: boolean | null;
  isAligned?: boolean | null;
}

export function SourceSelector({
  currentSource,
  onSourceChange,
  dbAvailable,
  webAvailable,
  isAligned,
}: SourceSelectorProps) {
  return (
    <div className="bg-white rounded-lg border p-3 shadow-sm flex flex-col gap-2">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        Source de données
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onSourceChange("local")}
          className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-all ${
            currentSource === "local"
              ? "bg-blue-50 border-blue-500 text-blue-700 shadow-xs"
              : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
          }`}
        >
          <Server className="w-4 h-4 text-blue-600" />
          <div className="text-left">
            <div className="font-semibold">Local</div>
            <div className="text-[10px] text-gray-500">.data/</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onSourceChange("web")}
          className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-all ${
            currentSource === "web"
              ? "bg-blue-50 border-blue-500 text-blue-700 shadow-xs"
              : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
          }`}
        >
          <Globe className="w-4 h-4 text-purple-600" />
          <div className="text-left">
            <div className="font-semibold flex items-center gap-1">
              Web
              {webAvailable === false && (
                <AlertCircle className="w-3 h-3 text-amber-500 inline" />
              )}
            </div>
            <div className="text-[10px] text-gray-500">Externe</div>
          </div>
        </button>
      </div>

      <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-100">
        <span>Statut alignement :</span>
        {isAligned === true ? (
          <span className="text-emerald-600 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Alignée
          </span>
        ) : isAligned === false ? (
          <span className="text-amber-600 font-medium flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> Désynchronisée
          </span>
        ) : (
          <span className="text-gray-400">Non vérifié</span>
        )}
      </div>
    </div>
  );
}
