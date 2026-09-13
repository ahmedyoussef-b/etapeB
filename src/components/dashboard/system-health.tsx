"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Server,
  Database,
  Activity,
} from "lucide-react";

interface HealthItem {
  name: string;
  status: "online" | "warning" | "offline";
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface SystemHealthProps {
  detailed?: boolean;
}

const healthItems: HealthItem[] = [
  {
    name: "API Gateway",
    status: "online",
    detail: "Réponse 42ms",
    icon: Activity,
  },
  {
    name: "Base de données",
    status: "online",
    detail: "Connectée",
    icon: Database,
  },
  {
    name: "Synchronisation",
    status: "warning",
    detail: "Dernière sync: 2 min",
    icon: Server,
  },
];

const statusIcons = {
  online: CheckCircle,
  warning: AlertTriangle,
  offline: XCircle,
};

const statusColors = {
  online: "text-emerald-500",
  warning: "text-amber-500",
  offline: "text-rose-500",
};

export function SystemHealth({ detailed = false }: SystemHealthProps) {
  return (
    <Card className="rounded-2xl border-border/60 p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Server className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">
          {detailed ? "Santé du système" : "Santé du système"}
        </h2>
      </div>

      <div className="space-y-3">
        {healthItems.map((item) => {
          const Icon = statusIcons[item.status];
          const colorClass = statusColors[item.status];
          return (
            <div
              key={item.name}
              className="flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10`}>
                  {Icon ? <Icon className={`h-4 w-4 ${colorClass}`} /> : null}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{item.name}</p>
                  {detailed && (
                    <p className="text-xs text-muted-foreground">{item.detail}</p>
                  )}
                </div>
              </div>
              <Badge
                variant={
                  item.status === "online"
                    ? "default"
                    : item.status === "warning"
                      ? "secondary"
                      : "outline"
                }
                className="rounded-lg"
              >
                {item.status === "online"
                  ? "En ligne"
                  : item.status === "warning"
                    ? "Avertissement"
                    : "Hors ligne"}
              </Badge>
            </div>
          );
        })}
      </div>

      {detailed && (
        <div className="mt-4 border-t border-border pt-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Uptime global</span>
            <span className="font-medium text-foreground">99.95%</span>
          </div>
        </div>
      )}
    </Card>
  );
}
