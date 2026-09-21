"use client";

import { useEffect, useState, useCallback } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, RefreshCw, Activity, ArrowDownCircle, CheckCircle2, Clock, ShieldCheck } from "lucide-react";
import { isTauriEnv } from "@/lib/tauri/env";
import { getSyncStatsUnified } from "@/lib/api/safe-fetch";

interface UserSyncInfo {
  userId: string;
  lastSyncAt: string | null;
  lastSyncVersion: string | null;
  pendingCount: number;
  syncedFilesCount: number;
}

interface GlobalStats {
  totalUsers: number;
  totalPublishedFiles: number;
  totalSyncedFiles: number;
  totalPendingFiles: number;
  totalExpiredFiles: number;
  activeUsers24h: number;
  activeUsers7d: number;
}

interface RecentActivityItem {
  userId: string;
  lastSyncAt: string;
  filesCount: number;
}

export function UsersTab({ active = true }: { active?: boolean }) {
  const [users, setUsers] = useState<UserSyncInfo[]>([]);
  const [globalStats, setGlobalStats] = useState<GlobalStats>({
    totalUsers: 0,
    totalPublishedFiles: 0,
    totalSyncedFiles: 0,
    totalPendingFiles: 0,
    totalExpiredFiles: 0,
    activeUsers24h: 0,
    activeUsers7d: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (isTauriEnv()) {
        const stats = await getSyncStatsUnified();
        setUsers([
          {
            userId: "admin-local",
            lastSyncAt: stats?.lastSync || new Date().toISOString(),
            lastSyncVersion: "v1.0.0",
            pendingCount: stats?.pendingSync || 0,
            syncedFilesCount: stats?.totalRecords || 0,
          },
        ]);
        setGlobalStats({
          totalUsers: 1,
          totalPublishedFiles: stats?.totalRecords || 0,
          totalSyncedFiles: stats?.totalRecords || 0,
          totalPendingFiles: stats?.pendingSync || 0,
          totalExpiredFiles: 0,
          activeUsers24h: 1,
          activeUsers7d: 1,
        });
        setRecentActivity([]);
        return;
      }

      const res = await fetch("/api/admin/sync-stats");
      if (!res.ok) {
        throw new Error(`Erreur ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      setUsers(data.users || []);
      setGlobalStats(data.global || {});
      setRecentActivity(data.recentActivity || []);
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
      {/* Bouton réactualiser en haut */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-semibold text-foreground">Supervision des Utilisateurs & Synchronisations</h3>
          <p className="text-xs text-muted-foreground">État de synchronisation individuel et activité récente des terminaux</p>
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

      {/* Cartes de métriques */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-border/60 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">Utilisateurs actifs</p>
              <h4 className="text-2xl font-bold mt-1 text-foreground">{globalStats.activeUsers24h}</h4>
              <p className="text-xs text-muted-foreground mt-0.5">{globalStats.activeUsers7d} actifs sur 7 jours</p>
            </div>
            <div className="p-2.5 bg-blue-500/10 text-blue-500 rounded-xl">
              <Users className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-border/60 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">Fichiers publiés</p>
              <h4 className="text-2xl font-bold mt-1 text-foreground">{globalStats.totalPublishedFiles}</h4>
              <p className="text-xs text-muted-foreground mt-0.5">{globalStats.totalPendingFiles} en cours de validité</p>
            </div>
            <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl">
              <ArrowDownCircle className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-border/60 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">Fichiers synchronisés</p>
              <h4 className="text-2xl font-bold mt-1 text-foreground">{globalStats.totalSyncedFiles}</h4>
              <p className="text-xs text-muted-foreground mt-0.5">Sur l&apos;ensemble des terminaux</p>
            </div>
            <div className="p-2.5 bg-purple-500/10 text-purple-500 rounded-xl">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-border/60 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">Fichiers expirés</p>
              <h4 className="text-2xl font-bold mt-1 text-foreground">{globalStats.totalExpiredFiles}</h4>
              <p className="text-xs text-muted-foreground mt-0.5">En attente de purge automatique</p>
            </div>
            <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-xl">
              <Clock className="h-5 w-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Table des utilisateurs et état de synchronisation */}
      <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            États de synchronisation par utilisateur
          </CardTitle>
          <CardDescription>
            Suivi des versions déployées et du nombre de fichiers transférés vers chaque compte
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase border-y border-border/60">
                <tr>
                  <th className="px-4 py-3">Identifiant Utilisateur</th>
                  <th className="px-4 py-3">Dernière synchronisation</th>
                  <th className="px-4 py-3">Version déployée</th>
                  <th className="px-4 py-3 text-center">Fichiers en attente</th>
                  <th className="px-4 py-3 text-center">Fichiers synchronisés</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      {loading ? "Chargement des états de synchronisation..." : "Aucun état de synchronisation enregistré"}
                    </td>
                  </tr>
                ) : (
                  users.map((u) => {
                    const lastSync = u.lastSyncAt ? new Date(u.lastSyncAt) : null;
                    return (
                      <tr key={u.userId} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono text-xs">{u.userId}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {lastSync ? (
                            <div>
                              <span>{formatDistanceToNow(lastSync, { addSuffix: true, locale: fr })}</span>
                              <span className="text-[11px] block opacity-70">({format(lastSync, "dd/MM/yyyy HH:mm")})</span>
                            </div>
                          ) : (
                            <span className="italic">Jamais</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {u.lastSyncVersion ? (
                            <Badge variant="outline" className="font-mono text-[11px]">
                              {u.lastSyncVersion}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground italic text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-center">
                          {u.pendingCount > 0 ? (
                            <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                              {u.pendingCount}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-center font-medium text-foreground">
                          {u.syncedFilesCount}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Activité récente */}
      {recentActivity.length > 0 && (
        <Card className="rounded-2xl border-border/60 shadow-sm p-4">
          <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 text-primary" />
            10 Dernières synchronisations actives
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {recentActivity.map((act, index) => (
              <div key={index} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 border border-border/40 text-xs">
                <span className="font-mono font-medium">{act.userId}</span>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>{act.filesCount} fichiers</span>
                  <span>•</span>
                  <span>{formatDistanceToNow(new Date(act.lastSyncAt), { addSuffix: true, locale: fr })}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
