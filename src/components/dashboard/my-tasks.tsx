"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardList, Clock, CheckCircle2, ArrowUpRight } from "lucide-react";
import Link from "next/link";

interface Task {
  id: number;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  dueTime: string;
  status: "pending" | "in-progress";
}

const tasks: Task[] = [
  {
    id: 1,
    title: "État des lieux bloc A",
    description: "Inspection complète du bloc d'entrée",
    priority: "high",
    dueTime: "15:00",
    status: "pending",
  },
  {
    id: 2,
    title: "Rapport d'incident",
    description: "Bloc B - porte défectueuse",
    priority: "medium",
    dueTime: "16:30",
    status: "in-progress",
  },
  {
    id: 3,
    title: "Ronde de nuit",
    description: "Patrouille des zones C et D",
    priority: "high",
    dueTime: "18:00",
    status: "pending",
  },
  {
    id: 4,
    title: "Contrôle accès",
    description: "Vérification badgeues entrantes",
    priority: "low",
    dueTime: "14:00",
    status: "pending",
  },
];

const priorityColors = {
  high: "border-l-rose-500",
  medium: "border-l-amber-500",
  low: "border-l-emerald-500",
};

export function MyTasks() {
  return (
    <Card className="rounded-2xl border-border/60 p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Mes tâches</h2>
        </div>
        <Badge variant="secondary" className="rounded-lg">
          {tasks.length} tâches
        </Badge>
      </div>

      <div className="space-y-3">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`rounded-lg border-l-4 border-transparent ${priorityColors[task.priority]} border bg-card p-3 shadow-sm`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                {task.status === "in-progress" ? (
                  <Clock className="h-4 w-4 text-blue-500" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                )}
                <div>
                  <p className="text-sm font-medium text-foreground">{task.title}</p>
                  <p className="text-xs text-muted-foreground">{task.description}</p>
                </div>
              </div>
              <Badge
                variant={task.priority === "high" ? "default" : "secondary"}
                className="rounded-lg text-xs"
              >
                {task.priority === "high"
                  ? "Urgent"
                  : task.priority === "medium"
                    ? "Moyen"
                    : "Bas"}
              </Badge>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                À faire avant : {task.dueTime}
              </span>
              <Link href={`/etat-des-lieux/nouveau`}>
                <Button variant="ghost" size="sm" className="rounded-xl">
                  <ArrowUpRight className="h-3 w-3 mr-1" />
                  Commencer
                </Button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
