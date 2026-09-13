"use client";

import { usePermissions } from "@/lib/hooks/usePermissions";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { BlockProcedures } from "@/components/dashboard/block-procedures";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { PermissionGuard } from "@/components/shared/permission-guard";
import { StatItem } from "@/components/dashboard/stats-cards";
import { FileText, BarChart3, CheckCircle, AlertTriangle } from "lucide-react";

export default function ChefDeBlocDashboard() {
  const { role } = usePermissions();

  const customStats: StatItem[] = [
    { title: "Procédures actives", value: "12", icon: FileText },
    { title: "États des lieux en cours", value: "3", icon: CheckCircle },
    { title: "Équipements", value: "47", icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Dashboard Chef de Bloc
        </h1>
        <p className="text-sm text-muted-foreground">
          Gestion des procédures et des opérations de votre bloc — rôle: {role}
        </p>
      </div>

      <StatsCards customStats={customStats} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BlockProcedures />
        <RecentActivity limit={10} />
      </div>

      <PermissionGuard permissions="procedures:create">
        <QuickActions
          actions={[
            { label: "Créer une procédure", href: "/creer-procedure", icon: FileText },
            { label: "Générer un rapport", href: "/rapports/creer", icon: BarChart3 },
          ]}
        />
      </PermissionGuard>
    </div>
  );
}
