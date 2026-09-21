"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/use-auth";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { useToastHelpers } from "@/components/notifications/toast-provider";
import { isTauriEnv } from "@/lib/tauri/env";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Search,
  RefreshCw,
  Mail,
  Calendar,
  Shield,
  Users,
  UserCheck,
  Clock,
  TrendingUp,
  Activity,
  UserPlus,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type RequestStatus = "PENDING" | "APPROVED" | "REJECTED";

interface RegistrationRequest {
  id: string;
  name: string;
  email: string;
  requestedRole: string;
  status: RequestStatus;
  createdAt: string;
}

interface UserStats {
  totalUsers: number;
  totalPending: number;
  usersByRole: Record<string, number>;
}

interface RecentUser {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  block?: {
    code: string;
    libelle: string;
  } | null;
}

const STATUS_LABELS: Record<RequestStatus, string> = {
  PENDING: "En attente",
  APPROVED: "Approuvée",
  REJECTED: "Rejetée",
};

const ROLE_LABELS: Record<string, string> = {
  RONDIER: "Rondier",
  CHEF_DE_BLOC: "Chef de bloc",
  CHEF_DE_QUART: "Chef de quart",
  ADMIN: "Administrateur",
};

const ROLE_COLORS: Record<string, string> = {
  RONDIER: "bg-blue-50 text-blue-700 border-blue-200",
  CHEF_DE_BLOC: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CHEF_DE_QUART: "bg-amber-50 text-amber-700 border-amber-200",
  ADMIN: "bg-purple-50 text-purple-700 border-purple-200",
};

export default function AdminUsersPage() {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuth();
  const { hasPermission } = usePermissions();
  const { success, error } = useToastHelpers();

  const [stats, setStats] = useState<UserStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [pendingRequests, setPendingRequests] = useState<RegistrationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadData = async () => {
    try {
      if (isTauriEnv()) {
        setStats({
          totalUsers: 1,
          activeUsers: 1,
          pendingRequests: 0,
          rejectedRequests: 0,
          usersByRole: { ADMIN: 1 },
          recentActivity: [],
        } as any);
        setRecentUsers([
          {
            id: "local-admin",
            name: "Administrateur Local",
            email: "admin@nexaflow.local",
            role: "ADMIN",
            isActive: true,
            createdAt: new Date().toISOString(),
          } as any,
        ]);
        setPendingRequests([]);
        return;
      }

      const res = await fetch("/api/admin/users/stats", { cache: "no-store" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erreur lors du chargement");
      }

      setStats(data.stats);
      setRecentUsers(data.recentUsers || []);
      setPendingRequests(data.pendingRequests || []);
    } catch (err) {
      error(err instanceof Error ? err.message : "Erreur lors du chargement des données");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.push("/login");
    } else if (!hasPermission("users:manage")) {
      router.push("/dashboard");
    }
  }, [isLoading, isAuthenticated, hasPermission, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();

      refreshIntervalRef.current = setInterval(() => {
        loadData();
      }, 30000);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, router]);

  const filteredPending = useMemo(() => {
    return pendingRequests.filter((item) => {
      return !search || item.name.toLowerCase().includes(search.toLowerCase()) || item.email.toLowerCase().includes(search.toLowerCase());
    });
  }, [pendingRequests, search]);

  const filteredUsers = useMemo(() => {
    return recentUsers.filter((item) => {
      return !search || item.name.toLowerCase().includes(search.toLowerCase()) || item.email.toLowerCase().includes(search.toLowerCase());
    });
  }, [recentUsers, search]);

  const roleDistribution = useMemo(() => {
    if (!stats?.usersByRole) return [];
    return Object.entries(stats.usersByRole)
      .map(([role, count]) => ({
        role: ROLE_LABELS[role] || role,
        count,
        percentage: stats.totalUsers > 0 ? Math.round((count / stats.totalUsers) * 100) : 0,
        color: ROLE_COLORS[role] || "bg-gray-50 text-gray-700 border-gray-200",
      }))
      .sort((a, b) => b.count - a.count);
  }, [stats]);

  const selectedRequest = useMemo(
    () => pendingRequests.find((r) => r.id === selectedId) || null,
    [pendingRequests, selectedId]
  );

  const handleAction = async () => {
    if (!selectedId || !actionType) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/registration-requests/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: actionType === "approve" ? "APPROVED" : "REJECTED" }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erreur lors du traitement");
      }

      success(
        actionType === "approve"
          ? "Demande approuvée. Utilisateur créé."
          : "Demande rejetée."
      );

      await loadData();
      setSelectedId(null);
      setActionType(null);
    } catch (err) {
      error(err instanceof Error ? err.message : "Erreur lors du traitement de la demande");
    } finally {
      setSubmitting(false);
    }
  };

  const openDialog = (id: string, action: "approve" | "reject") => {
    setSelectedId(id);
    setActionType(action);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Utilisateurs
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Gestion des utilisateurs et approbation des inscriptions.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRefreshing(true);
                loadData();
              }}
              disabled={refreshing}
            >
              {refreshing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Actualiser
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4 border-border/70">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Total utilisateurs</p>
                  <p className="mt-2 text-3xl font-semibold text-foreground">{stats?.totalUsers ?? 0}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                    <TrendingUp className="h-3 w-3" />
                    Actif
                  </p>
                </div>
                <div className="rounded-full bg-blue-50 p-3">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </Card>

            <Card className="p-4 border-border/70">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-amber-600">En attente</p>
                  <p className="mt-2 text-3xl font-semibold text-amber-600">{stats?.totalPending ?? 0}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Demandes à traiter
                  </p>
                </div>
                <div className="rounded-full bg-amber-50 p-3">
                  <UserCheck className="h-6 w-6 text-amber-600" />
                </div>
              </div>
            </Card>

            <Card className="p-4 border-border/70">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Rôles actifs</p>
                  <p className="mt-2 text-3xl font-semibold text-foreground">{stats?.usersByRole ? Object.keys(stats.usersByRole).length : 0}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                    <Activity className="h-3 w-3" />
                    Répartition active
                  </p>
                </div>
                <div className="rounded-full bg-emerald-50 p-3">
                  <Shield className="h-6 w-6 text-emerald-600" />
                </div>
              </div>
            </Card>

            <Card className="p-4 border-border/70">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Derniers inscrits</p>
                  <p className="mt-2 text-3xl font-semibold text-foreground">{recentUsers.length}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    Derniers 10 utilisateurs
                  </p>
                </div>
                <div className="rounded-full bg-purple-50 p-3">
                  <UserPlus className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2 border-border/70">
              <div className="p-4 border-b border-border/60">
                <h3 className="text-sm font-medium text-foreground">Répartition par rôle</h3>
                <p className="text-xs text-muted-foreground mt-1">Distribution des utilisateurs actifs</p>
              </div>
              <div className="p-4">
                {roleDistribution.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">Aucune donnée disponible</div>
                ) : (
                  <div className="space-y-4">
                    {roleDistribution.map((item) => (
                      <div key={item.role} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={item.color}>
                              {item.role}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground">{item.percentage}%</span>
                            <span className="font-medium text-foreground">{item.count}</span>
                          </div>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-100">
                          <div
                            className="h-2 rounded-full bg-primary transition-all duration-500"
                            style={{ width: `${item.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            <Card className="border-border/70">
              <div className="p-4 border-b border-border/60">
                <h3 className="text-sm font-medium text-foreground">Demandes en attente</h3>
                <p className="text-xs text-muted-foreground mt-1">{pendingRequests.length} demande(s) à traiter</p>
              </div>
              <div className="p-4">
                {pendingRequests.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">Aucune demande en attente</div>
                ) : (
                  <div className="space-y-3">
                    {pendingRequests.slice(0, 5).map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-md border border-border/60 p-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{item.email}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {format(new Date(item.createdAt), "dd MMM yyyy", { locale: fr })}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700"
                            onClick={() => openDialog(item.id, "approve")}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                            onClick={() => openDialog(item.id, "reject")}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {pendingRequests.length > 5 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => {}}
                      >
                        <span className="flex items-center gap-1">
                          Voir tout
                          <ChevronRight className="h-3 w-3" />
                        </span>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </div>

          <Card className="border-border/70">
            <div className="p-4 border-b border-border/60">
              <h3 className="text-sm font-medium text-foreground">Utilisateurs récents</h3>
              <p className="text-xs text-muted-foreground mt-1">Les 10 derniers utilisateurs créés</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Nom</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Rôle</th>
                    <th className="px-4 py-3 font-medium">Bloc</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                        Aucun utilisateur trouvé.
                      </td>
                    </tr>
                  )}
                  {filteredUsers.map((item) => (
                    <tr key={item.id} className="border-b border-border/40 last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-xs font-medium text-primary">
                              {item.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .slice(0, 2)
                                .toUpperCase()}
                            </span>
                          </div>
                          <span className="font-medium text-foreground">{item.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="text-foreground">{item.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={ROLE_COLORS[item.role] || ROLE_COLORS.RONDIER}>
                          {ROLE_LABELS[item.role] || item.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-foreground">{item.block?.libelle || item.block?.code || "—"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {format(new Date(item.createdAt), "dd MMM yyyy HH:mm", { locale: fr })}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>

      <Dialog open={!!selectedId} onOpenChange={(open) => { if (!open) { setSelectedId(null); setActionType(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" ? "Approuver la demande" : "Rejeter la demande"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "approve"
                ? "Cette action créera un compte utilisateur avec le rôle sélectionné."
                : "Cette action refusera définitivement cette demande."}
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-md border border-border/60 p-3">
                <span className="text-muted-foreground">Nom</span>
                <span className="font-medium text-foreground">{selectedRequest.name}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border/60 p-3">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium text-foreground">{selectedRequest.email}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border/60 p-3">
                <span className="text-muted-foreground">Rôle</span>
                <span className="font-medium text-foreground">
                  {ROLE_LABELS[selectedRequest.requestedRole] || selectedRequest.requestedRole}
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setSelectedId(null); setActionType(null); }}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button
              onClick={handleAction}
              disabled={submitting}
              className={
                actionType === "approve"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-red-600 hover:bg-red-700"
              }
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Traitement...
                </span>
              ) : actionType === "approve" ? (
                "Confirmer l'approbation"
              ) : (
                "Confirmer le rejet"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
