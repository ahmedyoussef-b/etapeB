"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/use-auth";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardTopNav } from "@/components/dashboard/top-nav";
import { isTauriEnv } from "@/lib/tauri/env";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToastHelpers } from "@/components/notifications/toast-provider";
import {
  Loader2,
  UserPlus,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  RefreshCw,
  Mail,
  Calendar,
  Shield,
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
  reviewedAt?: string;
  reviewedBy?: {
    name?: string;
    email?: string;
  };
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

export default function AdminRegistrationsPage() {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuth();
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<RequestStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { success, error } = useToastHelpers();

  const loadRequests = async () => {
    try {
      if (isTauriEnv()) {
        setRequests([]);
        return;
      }

      const res = await fetch("/api/admin/registration-requests");
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erreur lors du chargement");
      }

      setRequests(data.data || []);
    } catch (err) {
      error(err instanceof Error ? err.message : "Erreur lors du chargement des demandes");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadRequests();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, router]);

  const filtered = useMemo(() => {
    return requests.filter((item) => {
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const matchesSearch =
        !search ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.email.toLowerCase().includes(search.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [requests, statusFilter, search]);

  const stats = useMemo(() => {
    return {
      total: requests.length,
      pending: requests.filter((r) => r.status === "PENDING").length,
      approved: requests.filter((r) => r.status === "APPROVED").length,
      rejected: requests.filter((r) => r.status === "REJECTED").length,
    };
  }, [requests]);

  const selectedRequest = useMemo(
    () => requests.find((r) => r.id === selectedId) || null,
    [requests, selectedId]
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

      await loadRequests();
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

  if (isLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <DashboardSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <DashboardTopNav />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  Inscriptions
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Gérez les demandes de création de compte.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRefreshing(true);
                  loadRequests();
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

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <Card className="p-4">
                <p className="text-xs font-medium text-muted-foreground">Total</p>
                <p className="mt-2 text-2xl font-semibold">{stats.total}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs font-medium text-amber-600">En attente</p>
                <p className="mt-2 text-2xl font-semibold text-amber-600">{stats.pending}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs font-medium text-emerald-600">Approuvées</p>
                <p className="mt-2 text-2xl font-semibold text-emerald-600">{stats.approved}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs font-medium text-red-600">Rejetées</p>
                <p className="mt-2 text-2xl font-semibold text-red-600">{stats.rejected}</p>
              </Card>
            </div>

            <Card className="border-border/70">
              <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                <div className="relative w-full md:max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher par nom ou email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as RequestStatus | "all")}>
                    <SelectTrigger className="w-44">
                      <SelectValue placeholder="Filtrer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>
                      <SelectItem value="PENDING">En attente</SelectItem>
                      <SelectItem value="APPROVED">Approuvées</SelectItem>
                      <SelectItem value="REJECTED">Rejetées</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Nom</th>
                      <th className="px-4 py-3 font-medium">Email</th>
                      <th className="px-4 py-3 font-medium">Rôle demandé</th>
                      <th className="px-4 py-3 font-medium">Statut</th>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                          Aucune demande trouvée.
                        </td>
                      </tr>
                    )}

                    {filtered.map((item) => (
                      <tr key={item.id} className="border-b border-border/40 last:border-0">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <UserPlus className="h-4 w-4 text-muted-foreground" />
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
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-muted-foreground" />
                            <span className="text-foreground">
                              {ROLE_LABELS[item.requestedRole] || item.requestedRole}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={
                              item.status === "PENDING"
                                ? "border-amber-200 text-amber-700"
                                : item.status === "APPROVED"
                                  ? "border-emerald-200 text-emerald-700"
                                  : "border-red-200 text-red-700"
                            }
                          >
                            {STATUS_LABELS[item.status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            {format(new Date(item.createdAt), "dd MMM yyyy HH:mm", { locale: fr })}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {item.status === "PENDING" && (
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                onClick={() => openDialog(item.id, "approve")}
                              >
                                <CheckCircle2 className="mr-1 h-4 w-4" />
                                Approuver
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-red-200 text-red-700 hover:bg-red-50"
                                onClick={() => openDialog(item.id, "reject")}
                              >
                                <XCircle className="mr-1 h-4 w-4" />
                                Rejeter
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </main>
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
