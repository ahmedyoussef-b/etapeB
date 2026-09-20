"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PermissionGuard } from "@/components/shared/permission-guard";
import { FileText, PlayCircle, PauseCircle, CheckCircle } from "lucide-react";
import Link from "next/link";

interface BlockProcedure {
  id: number;
  title: string;
  block: string;
  status: "active" | "paused" | "completed";
  lastRun: string;
  requiredRoles: string[];
}

const procedures: BlockProcedure[] = [
  {
    id: 1,
    title: "Ronde matinale bloc A",
    block: "Bloc A - Entrée",
    status: "active",
    lastRun: "06:00",
    requiredRoles: ["rondier", "chef-de-quart"],
  },
  {
    id: 2,
    title: "Contrôle sécurité bloc B",
    block: "Bloc B - Production",
    status: "active",
    lastRun: "05:30",
    requiredRoles: ["rondier", "chef-de-bloc"],
  },
  {
    id: 3,
    title: "Vérification équipements bloc C",
    block: "Bloc C - Stockage",
    status: "paused",
    lastRun: "Hier",
    requiredRoles: ["chef-de-bloc"],
  },
  {
    id: 4,
    title: "Rapport d'incident bloc A",
    block: "Bloc A - Entrée",
    status: "completed",
    lastRun: "14:22",
    requiredRoles: ["rondier", "chef-de-quart"],
  },
];

const statusConfig = {
  active: { icon: PlayCircle, color: "text-emerald-500", label: "Active" },
  paused: { icon: PauseCircle, color: "text-amber-500", label: "En pause" },
  completed: { icon: CheckCircle, color: "text-blue-500", label: "Terminée" },
};

export function BlockProcedures() {
  return (
    <Card className="rounded-2xl border-border/60 p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <FileText className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Procédures par bloc</h2>
      </div>

      <div className="space-y-3">
        {procedures.map((proc) => {
          const config = statusConfig[proc.status];
          const Icon = config.icon;
          return (
            <div
              key={proc.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
            >
              <div className="flex items-center gap-3">
                <Icon className={`h-5 w-5 ${config.color}`} />
                <div>
                  <p className="text-sm font-medium text-foreground">{proc.title}</p>
                  <p className="text-xs text-muted-foreground">{proc.block}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge
                  variant={
                    proc.status === "active"
                      ? "default"
                      : proc.status === "paused"
                        ? "secondary"
                        : "outline"
                  }
                  className="rounded-lg text-xs"
                >
                  {config.label}
                </Badge>
                <PermissionGuard permissions="procedures:view">
                  <Link href={`/procedures/${proc.id}`}>
                    <FileText className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-primary" />
                  </Link>
                </PermissionGuard>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
