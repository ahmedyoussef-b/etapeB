"use client";

import { usePermissions } from "@/lib/hooks/usePermissions";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { TeamOverview } from "@/components/dashboard/team-overview";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { PermissionGuard } from "@/components/shared/permission-guard";
import { FileText, BarChart3, Shield } from "lucide-react";

export default function ChefDeQuartDashboard() {
  const { role } = usePermissions();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Dashboard Chef de Quart
        </h1>
        <p className="text-sm text-muted-foreground">
          Supervision des opérations et gestion des équipes — rôle: {role}
        </p>
      </div>

      <StatsCards showAllStats={true} showUserStats={true} showSystemStats={false} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RecentActivity limit={15} />
        <TeamOverview />
      </div>

      <PermissionGuard permissions="procedures:create">
        <QuickActions
          actions={[
            { label: "Créer une procédure", href: "/creer-procedure", icon: FileText },
            { label: "Générer un rapport", href: "/rapports/creer", icon: BarChart3 },
            { label: "Voir les équipes", href: "/equipes", icon: Shield },
          ]}
        />
      </PermissionGuard>
    </div>
  );
}
