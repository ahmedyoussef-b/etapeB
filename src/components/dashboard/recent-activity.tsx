"use client";

import { Card } from "@/components/ui/card";
import { Activity } from "lucide-react";

export interface ActivityItem {
  time: string;
  action: string;
  user: string;
}

interface RecentActivityProps {
  limit?: number;
}

const allActivities: ActivityItem[] = [
  { time: "14:32", action: "Nouveau workflow créé", user: "Alice Martin" },
  { time: "14:15", action: "Mise à jour des tarifs", user: "System" },
  { time: "13:58", action: "Suppression d'une procédure", user: "Bob Dupont" },
  { time: "13:40", action: "Connexion depuis Paris", user: "Claire Leroy" },
  { time: "12:22", action: "Déploiement terminé", user: "System" },
  { time: "11:50", action: "État des lieux créé", user: "David Moreau" },
  { time: "11:30", action: "Rapport généré", user: "Alice Martin" },
  { time: "10:15", action: "Nouvelle procédure importée", user: "System" },
  { time: "09:45", action: "Équipe mise à jour", user: "Claire Leroy" },
  { time: "09:00", action: "Point de sécurité effectué", user: "Rondier Dupont" },
];

export function RecentActivity({ limit = 5 }: RecentActivityProps) {
  const items = allActivities.slice(0, limit);

  return (
    <Card className="rounded-2xl border-border/60 p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Activity className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Activité récente</h2>
      </div>
      <div className="space-y-4">
        {items.map((item) => (
          <div
            key={`${item.time}-${item.action}`}
            className="flex items-start justify-between gap-3"
          >
            <div>
              <p className="text-sm font-medium text-foreground">{item.action}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{item.user}</p>
            </div>
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
              {item.time}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
