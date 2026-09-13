"use client";

import { usePermissions } from "@/lib/hooks/usePermissions";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { SystemHealth } from "@/components/dashboard/system-health";
import { PermissionGuard } from "@/components/shared/permission-guard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToastHelpers } from "@/components/notifications/toast-provider";
import { FileText, Activity, AlertTriangle, Users } from "lucide-react";

export default function AdminDashboard() {
  const { role } = usePermissions();
  const toast = useToastHelpers();

  const stats = [
    { title: "Utilisateurs", value: "1 248", change: "+12%", trend: "up" as const, icon: Users },
    { title: "Procédures", value: "86", change: "+4%", trend: "up" as const, icon: FileText },
    { title: "Workflows actifs", value: "324", change: "-2%", trend: "down" as const, icon: Activity },
    { title: "Erreurs 24h", value: "7", change: "-18%", trend: "down" as const, icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Dashboard Administrateur
          </h1>
          <p className="text-sm text-muted-foreground">
            Vue d&apos;ensemble du système NexaFlow — rôle: {role}
          </p>
        </div>
        <PermissionGuard permissions={["settings:*", "users:manage"]} mode="any">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => toast.info("Export en cours...", "Fonctionnalité à venir")}>
              Exporter
            </Button>
            <Button size="sm" className="rounded-xl shadow-sm" onClick={() => toast.success("Données rafraîchies")}>
              Rafraîchir
            </Button>
          </div>
        </PermissionGuard>
      </div>

      <PermissionGuard permissions={["settings:*", "users:manage"]} mode="any">
        <StatsCards
          customStats={stats}
        />
      </PermissionGuard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RecentActivity limit={20} />
        <SystemHealth detailed={true} />
      </div>

      <PermissionGuard permissions="users:manage">
        <Card className="rounded-2xl border-border/60 p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-foreground">Gestion des utilisateurs</h2>
          <p className="text-sm text-muted-foreground">
            Créer, modifier et supprimer des comptes utilisateurs
          </p>
          <Button size="sm" className="mt-4 rounded-xl">
            Gérer les utilisateurs
          </Button>
        </Card>
      </PermissionGuard>
    </div>
  );
}
