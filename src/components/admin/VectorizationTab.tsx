"use client";

import { useEffect, useState, useCallback } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  isTauriEnv,
  checkVectorizationConsistency,
  getVectorizationStats,
  triggerLocalVectorization,
  VectorizationConsistencyReport,
  VectorizationStats,
} from "@/services/local-rag";
import {
  Cpu,
  RefreshCw,
  HardDrive,
  FileCheck2,
  Boxes,
  Clock,
  Sparkles,
  MonitorCheck,
  AlertTriangle,
  Layers,
} from "lucide-react";

export function VectorizationTab({ active = true }: { active?: boolean }) {
  const [isTauri, setIsTauri] = useState(false);
  const [stats, setStats] = useState<VectorizationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [vectorizing, setVectorizing] = useState(false);
  const [consistencyResult, setConsistencyResult] = useState<{
    status: "ok" | "discrepancy" | "checking";
    message: string;
  } | null>(null);
  const [consistencyReport, setConsistencyReport] = useState<VectorizationConsistencyReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      if (isTauriEnv()) {
        setIsTauri(true);
        const data = await getVectorizationStats();
        setStats(data);
      } else {
        setIsTauri(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la récupération des stats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [active, fetchStats]);

  const handleTriggerVectorization = async () => {
    try {
      setVectorizing(true);
      setError(null);
      const newStats = await triggerLocalVectorization();
      setStats(newStats);
      setConsistencyResult({
        status: "ok",
        message: `Vectorisation terminée avec succès (${newStats.vectorizedFiles} fichiers indexés, ${newStats.totalChunks} chunks).`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la vectorisation");
    } finally {
      setVectorizing(false);
    }
  };

  const handleCheckConsistency = async () => {
    try {
      setConsistencyResult({
        status: "checking",
        message: "Vérification de la cohérence entre le référentiel et meta.json...",
      });
      const report = await checkVectorizationConsistency();
      setConsistencyReport(report);
      setStats({
        totalFiles: report.totalFiles,
        vectorizedFiles: report.vectorizedFiles,
        totalChunks: stats?.totalChunks || 0,
        lastUpdate: stats?.lastUpdate || new Date().toISOString(),
      });

      if (report.isConsistent) {
        setConsistencyResult({
          status: "ok",
          message: `Cohérence parfaite : ${report.consistentFiles.length}/${report.totalFiles} fichiers correspondent à meta.json.`,
        });
        return;
      }

      const details = [
        report.missingFiles.length ? `${report.missingFiles.length} à vectoriser` : "",
        report.modifiedFiles.length ? `${report.modifiedFiles.length} modifié(s)` : "",
        report.orphanedFiles.length ? `${report.orphanedFiles.length} orphelin(s)` : "",
      ].filter(Boolean).join(" • ");

      setConsistencyResult({
        status: "discrepancy",
        message: `Écart détecté : ${details}. Une ré-indexation est recommandée.`,
      });
    } catch (err) {
      setConsistencyResult({
        status: "discrepancy",
        message: `Erreur lors de la vérification: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  };

  if (!isTauri && !loading) {
    return (
      <Card className="rounded-2xl border-border/60 p-8 text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
          <MonitorCheck className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">Supervision du Moteur Vectoriel Local (ONNX)</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Le moteur vectoriel local embarqué (ONNX all-MiniLM-L6-v2) s&apos;exécute directement dans l&apos;application bureau native.
          </p>
        </div>
        <Badge variant="outline" className="text-xs bg-muted/40 font-mono">
          Disponible uniquement dans l&apos;application bureau (Tauri)
        </Badge>
      </Card>
    );
  }

  const totalFiles = stats?.totalFiles || 0;
  const vectorizedFiles = stats?.vectorizedFiles || 0;
  const totalChunks = stats?.totalChunks || 0;
  const percentage = totalFiles > 0 ? Math.min(100, Math.round((vectorizedFiles / totalFiles) * 100)) : 0;
  const lastUpdateDate = stats?.lastUpdate ? new Date(stats.lastUpdate) : null;

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary" />
            Moteur Vectoriel Local & Embeddings ONNX
          </h3>
          <p className="text-xs text-muted-foreground">
            Indexation sémantique 100% offline (modèle all-MiniLM-L6-v2, 384 dimensions)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCheckConsistency}
            disabled={vectorizing || loading}
            className="rounded-xl flex items-center gap-1.5"
          >
            <FileCheck2 className="h-4 w-4" />
            Vérifier la cohérence
          </Button>

          <Button
            size="sm"
            onClick={handleTriggerVectorization}
            disabled={vectorizing || loading}
            className="rounded-xl flex items-center gap-1.5 shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 ${vectorizing ? "animate-spin" : ""}`} />
            {vectorizing ? "Vectorisation..." : "Re-vectoriser"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-sm">
          {error}
        </div>
      )}

      {consistencyResult && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-2 border ${
            consistencyResult.status === "ok"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600"
              : consistencyResult.status === "discrepancy"
              ? "bg-amber-500/10 border-amber-500/20 text-amber-600"
              : "bg-blue-500/10 border-blue-500/20 text-blue-600"
          }`}
        >
          {consistencyResult.status === "ok" ? (
            <FileCheck2 className="h-4 w-4 flex-shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          )}
          <span>{consistencyResult.message}</span>
        </div>
      )}

      {consistencyReport && (
        <Card className="rounded-2xl border-border/60 shadow-sm p-4 space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-foreground">Rapport de cohérence</h4>
            <p className="text-xs text-muted-foreground mt-1">Comparaison hash par hash entre le référentiel et meta.json</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3">
              <p className="text-[11px] text-muted-foreground">Correspondants</p>
              <p className="text-lg font-semibold text-emerald-600">{consistencyReport.consistentFiles.length}</p>
            </div>
            <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3">
              <p className="text-[11px] text-muted-foreground">À vectoriser</p>
              <p className="text-lg font-semibold text-blue-600">{consistencyReport.missingFiles.length}</p>
            </div>
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3">
              <p className="text-[11px] text-muted-foreground">Modifiés</p>
              <p className="text-lg font-semibold text-amber-600">{consistencyReport.modifiedFiles.length}</p>
            </div>
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3">
              <p className="text-[11px] text-muted-foreground">Orphelins</p>
              <p className="text-lg font-semibold text-red-600">{consistencyReport.orphanedFiles.length}</p>
            </div>
          </div>
          {[
            { label: "Fichiers à vectoriser", paths: consistencyReport.missingFiles, tone: "text-blue-600" },
            { label: "Fichiers modifiés", paths: consistencyReport.modifiedFiles, tone: "text-amber-600" },
            { label: "Entrées orphelines", paths: consistencyReport.orphanedFiles, tone: "text-red-600" },
          ].map((group) => (
            group.paths.length > 0 && (
              <div key={group.label} className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">{group.label} ({group.paths.length})</p>
                <div className={`font-mono text-[11px] break-all ${group.tone}`}>
                  {group.paths.slice(0, 5).join(" • ")}
                  {group.paths.length > 5 && ` • et ${group.paths.length - 5} autre(s)`}
                </div>
              </div>
            )
          ))}
        </Card>
      )}

      {/* Cartes de statistiques */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-border/60 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">Fichiers référentiel</p>
              <h4 className="text-2xl font-bold mt-1 text-foreground">{totalFiles}</h4>
              <p className="text-xs text-muted-foreground mt-0.5">%APPDATA%/repository</p>
            </div>
            <div className="p-2.5 bg-blue-500/10 text-blue-500 rounded-xl">
              <HardDrive className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-border/60 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">Fichiers vectorisés</p>
              <h4 className="text-2xl font-bold mt-1 text-foreground">{vectorizedFiles}</h4>
              <p className="text-xs text-muted-foreground mt-0.5">Suivi dans meta.json</p>
            </div>
            <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl">
              <FileCheck2 className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-border/60 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">Chunks vectoriels</p>
              <h4 className="text-2xl font-bold mt-1 text-foreground">{totalChunks}</h4>
              <p className="text-xs text-muted-foreground mt-0.5">Vecteurs 384 dimensions</p>
            </div>
            <div className="p-2.5 bg-purple-500/10 text-purple-500 rounded-xl">
              <Boxes className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-border/60 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">Dernière mise à jour</p>
              <h4 className="text-base font-bold mt-1 text-foreground truncate">
                {lastUpdateDate ? formatDistanceToNow(lastUpdateDate, { addSuffix: true, locale: fr }) : "N/A"}
              </h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {lastUpdateDate ? format(lastUpdateDate, "dd/MM HH:mm:ss") : "-"}
              </p>
            </div>
            <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-xl">
              <Clock className="h-5 w-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Barre de progression & Statut d'indexation */}
      <Card className="rounded-2xl border-border/60 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Taux de couverture de la base vectorielle locale
            </h4>
            <p className="text-xs text-muted-foreground">
              {vectorizedFiles} sur {totalFiles} fichiers indexés ({percentage}%)
            </p>
          </div>
          <Badge
            variant={percentage === 100 ? "default" : "secondary"}
            className={percentage === 100 ? "bg-emerald-600 hover:bg-emerald-700" : ""}
          >
            {percentage === 100 ? "Indexation intégrale" : `${percentage}%`}
          </Badge>
        </div>

        {/* Barre de progression */}
        <div className="w-full bg-muted/60 rounded-full h-3 overflow-hidden border border-border/40">
          <div
            className="bg-primary h-full transition-all duration-500 rounded-full"
            style={{ width: `${percentage}%` }}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs text-muted-foreground border-t border-border/40">
          <div>
            <span className="block font-medium text-foreground">Modèle d&apos;embeddings :</span>
            <span className="font-mono text-[11px]">all-MiniLM-L6-v2 (ONNX)</span>
          </div>
          <div>
            <span className="block font-medium text-foreground">Dimension vectorielle :</span>
            <span className="font-mono text-[11px]">384 dimensions</span>
          </div>
          <div>
            <span className="block font-medium text-foreground">Moteur d&apos;inférence :</span>
            <span className="font-mono text-[11px]">Rust natif / fastembed (ort-sys)</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
