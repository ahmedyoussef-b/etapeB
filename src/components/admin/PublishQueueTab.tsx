"use client";

import { useEffect, useState, useCallback } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, FileText, CheckCircle2, AlertCircle, ArrowLeft, ArrowRight, HardDrive } from "lucide-react";
import { SyncPurgeButton } from "./SyncPurgeButton";
import { isTauriEnv } from "@/lib/tauri/env";
import { getPublishQueueUnified } from "@/lib/api/safe-fetch";

interface PublishItem {
  id: string;
  path: string;
  hash: string;
  size: number;
  version: string;
  publishedAt: string;
  expiresAt: string;
  downloadCount: number;
  transferredTo: string[];
  isExpired: boolean;
}

interface PublishStats {
  totalAll: number;
  totalPending: number;
  totalExpired: number;
}

const formatExpiration = (value: string, isExpired: boolean) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date invalide";

  const absolute = format(date, "dd/MM/yyyy HH:mm");
  if (isExpired) {
    return `Expiré le ${absolute} (${formatDistanceToNow(date, { addSuffix: true, locale: fr })})`;
  }

  const daysRemaining = Math.max(
    0,
    Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
  );
  const remaining = daysRemaining <= 1 ? "moins d’un jour restant" : `${daysRemaining} jours restants`;
  return `${absolute} • ${remaining}`;
};

export function PublishQueueTab({ active = true }: { active?: boolean }) {
  const [items, setItems] = useState<PublishItem[]>([]);
  const [stats, setStats] = useState<PublishStats>({ totalAll: 0, totalPending: 0, totalExpired: 0 });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState<"all" | "pending" | "expired">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (isTauriEnv()) {
        const res = await getPublishQueueUnified(page, 20, filter);
        setItems(res?.items || []);
        setTotalPages(1);
        setStats({ totalAll: res?.total || 0, totalPending: 0, totalExpired: 0 });
        return;
      }

      const res = await fetch(`/api/admin/publish-queue?page=${page}&limit=20&filter=${filter}`);
      if (!res.ok) {
        throw new Error(`Erreur ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      setItems(data.items || []);
      setTotalPages(data.totalPages || 1);
      setStats(data.stats || { totalAll: 0, totalPending: 0, totalExpired: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => {
    if (!active) return;
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [active, fetchData]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Barre de contrôle et filtres */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => { setFilter("all"); setPage(1); }}
            className="rounded-xl"
          >
            Tout ({stats.totalAll})
          </Button>
          <Button
            variant={filter === "pending" ? "default" : "outline"}
            size="sm"
            onClick={() => { setFilter("pending"); setPage(1); }}
            className="rounded-xl"
          >
            En attente ({stats.totalPending})
          </Button>
          <Button
            variant={filter === "expired" ? "default" : "outline"}
            size="sm"
            onClick={() => { setFilter("expired"); setPage(1); }}
            className="rounded-xl"
          >
            Expirés ({stats.totalExpired})
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <SyncPurgeButton />
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            className="rounded-xl flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Réactualiser
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Table des éléments */}
      <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-primary" />
            File de publication
          </CardTitle>
          <CardDescription>
            Supervision des fichiers en attente de synchronisation et de leur état d&apos;expiration
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase border-y border-border/60">
                <tr>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Chemin</th>
                  <th className="px-4 py-3">Hash</th>
                  <th className="px-4 py-3">Taille</th>
                  <th className="px-4 py-3">Version</th>
                  <th className="px-4 py-3">Publié</th>
                  <th className="px-4 py-3">Expiration</th>
                  <th className="px-4 py-3">Téléchargements</th>
                  <th className="px-4 py-3">Transféré à</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                      {loading ? "Chargement des fichiers..." : "Aucun fichier dans cette vue"}
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const expiresDate = new Date(item.expiresAt);
                    const isExp = item.isExpired;
                    return (
                      <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          {isExp ? (
                            <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                              <AlertCircle className="h-3 w-3" />
                              Expiré
                            </Badge>
                          ) : (
                            <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1 w-fit">
                              <CheckCircle2 className="h-3 w-3" />
                              Actif
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs max-w-[240px] truncate" title={item.path}>
                          <div className="flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="truncate">{item.path}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {item.hash}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {formatSize(item.size)}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <Badge variant="outline" className="font-mono text-[11px]">
                            {item.version}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(item.publishedAt), "dd/MM/yyyy HH:mm")}
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          <span className={isExp ? "text-red-500 font-medium" : "text-muted-foreground"}>
                            {formatDistanceToNow(expiresDate, { addSuffix: true, locale: fr })}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-center font-medium">
                          {item.downloadCount}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {item.transferredTo.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {item.transferredTo.map((u, idx) => (
                                <Badge key={idx} variant="secondary" className="text-[10px] py-0 px-1.5 font-mono">
                                  {u}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic text-xs">En attente</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/60 bg-muted/20">
              <span className="text-xs text-muted-foreground">
                Page {page} sur {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                  className="h-8 rounded-lg"
                >
                  <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                  Précédent
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                  className="h-8 rounded-lg"
                >
                  Suivant
                  <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
