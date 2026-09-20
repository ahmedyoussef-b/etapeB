"use client";

import { usePermissions } from "@/lib/hooks/usePermissions";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { MyTasks } from "@/components/dashboard/my-tasks";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { TourStatus } from "@/components/dashboard/tour-status";
import { PermissionGuard } from "@/components/shared/permission-guard";
import { StatItem } from "@/components/dashboard/stats-cards";
import { ClipboardList, MessageSquare, Video, BookOpen } from "lucide-react";

export default function RondierDashboard() {
  const { role } = usePermissions();

  const customStats: StatItem[] = [
    { title: "Tâches à réaliser", value: "5", icon: ClipboardList },
    { title: "États des lieux terminés", value: "8", icon: BookOpen },
    { title: "Rapports à soumettre", value: "2", icon: MessageSquare },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Dashboard Rondier
        </h1>
        <p className="text-sm text-muted-foreground">
          Vos tâches et états des lieux à réaliser — rôle: {role}
        </p>
      </div>

      <TourStatus />

      <StatsCards customStats={customStats} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MyTasks />
        <PermissionGuard permissions="chat-ia:*" fallback={null}>
          <QuickActions
            actions={[
              { label: "Nouvel état des lieux", href: "/etat-des-lieux/nouveau", icon: ClipboardList },
              { label: "Consulter les rapports", href: "/rapports", icon: BookOpen },
              { label: "Chat IA", href: "/chat-ia", icon: MessageSquare },
            ]}
          />
        </PermissionGuard>
      </div>

      <PermissionGuard permissions="visio:*" fallback={null}>
        <QuickActions
          actions={[
            { label: "Visioconférence", href: "/video-conference", icon: Video },
          ]}
        />
      </PermissionGuard>
    </div>
  );
}
