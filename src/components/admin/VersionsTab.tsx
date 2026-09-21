"use client";

import { useEffect, useState, useCallback } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GitCommit, RefreshCw, Layers, Calendar, User, FileText } from "lucide-react";
import { isTauriEnv } from "@/lib/tauri/env";
import { getSystemVersionsUnified } from "@/lib/api/safe-fetch";

interface VersionItem {
  id: string;
  version: string;
  publishedAt: string;
  publishedBy: string;
  changelog: string | null;
  fileCount: number;
}

export function VersionsTab({ active = true }: { active?: boolean }) {
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (isTauriEnv()) {
        const versionsData = await getSystemVersionsUnified();
        setVersions(
          (versionsData || []).map((v: any, idx: number) => ({
            id: `v-${idx}`,
            version: v.version || "v1.0",
            publishedAt: v.updatedAt || new Date().toISOString(),
            publishedBy: v.name || "Système local",
            changelog: `Composant: ${v.name} (${v.status})`,
            fileCount: 0,
          }))
        );
        return;
      }

      const res = await fetch("/api/admin/system-versions");
      if (!res.ok) {
        throw new Error(`Erreur ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      setVersions(data.versions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [active, fetchData]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-semibold text-foreground">Historique des Versions Système</h3>
          <p className="text-xs text-muted-foreground">Traçabilité des versions publiées, des changelogs et des volumes de fichiers</p>
        </div>
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

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-sm">
          {error}
        </div>
      )}

      {versions.length === 0 ? (
        <Card className="rounded-2xl border-border/60 p-8 text-center text-muted-foreground">
          {loading ? "Chargement des versions..." : "Aucune version système enregistrée pour l'instant"}
        </Card>
      ) : (
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/60">
          {versions.map((v, index) => {
            const pubDate = new Date(v.publishedAt);
            const isLatest = index === 0;

            return (
              <div key={v.id} className="relative group">
                {/* Point timeline */}
                <div
                  className={`absolute -left-6 top-1.5 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    isLatest
                      ? "bg-primary border-primary text-primary-foreground"
                      : "bg-background border-border group-hover:border-primary"
                  }`}
                >
                  <GitCommit className="h-3 w-3" />
                </div>

                <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden hover:border-primary/40 transition-colors">
                  <CardHeader className="p-4 pb-2 bg-muted/20 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Badge variant={isLatest ? "default" : "outline"} className="font-mono text-xs px-2.5 py-0.5">
                          {v.version}
                        </Badge>
                      {isLatest && (
                        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                          Dernière version
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{formatDistanceToNow(pubDate, { addSuffix: true, locale: fr })}</span>
                      <span className="opacity-60">({format(pubDate, "dd/MM/yyyy HH:mm")})</span>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 pt-3 space-y-3">
                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-primary" />
                        <span>Publié par : <strong className="text-foreground font-medium">{v.publishedBy}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5 text-primary" />
                        <span>Fichiers inclus : <strong className="text-foreground font-medium">{v.fileCount}</strong></span>
                      </div>
                    </div>

                    {v.changelog && (
                      <div className="p-3 bg-muted/30 rounded-xl border border-border/40 text-xs space-y-1">
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground uppercase">
                          <FileText className="h-3 w-3" />
                          Notes de version
                        </div>
                        <p className="text-foreground/90 whitespace-pre-wrap">{v.changelog}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
