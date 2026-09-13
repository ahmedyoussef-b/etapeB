"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Map, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import Link from "next/link";

interface Tour {
  id: number;
  name: string;
  time: string;
  status: "completed" | "pending" | "in-progress";
}

const tours: Tour[] = [
  { id: 1, name: "Ronde entrée principale", time: "06:00", status: "completed" },
  { id: 2, name: "Ronde zone B", time: "10:00", status: "completed" },
  { id: 3, name: "Ronde parking", time: "14:00", status: "in-progress" },
  { id: 4, name: "Ronde toiture", time: "18:00", status: "pending" },
  { id: 5, name: "Ronde sortie", time: "22:00", status: "pending" },
];

const statusIcons = {
  completed: CheckCircle2,
  pending: Clock,
  "in-progress": AlertCircle,
};

const statusColors = {
  completed: "text-emerald-500 bg-emerald-500/10",
  pending: "text-slate-500 bg-slate-200/30",
  "in-progress": "text-blue-500 bg-blue-500/10",
};

export function TourStatus() {
  const completedCount = tours.filter((t) => t.status === "completed").length;

  return (
    <Card className="rounded-2xl border-border/60 p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Map className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Rondes du jour</h2>
        </div>
        <Badge variant="secondary" className="rounded-lg">
          {completedCount}/{tours.length} terminées
        </Badge>
      </div>

      <div className="space-y-3">
        {tours.map((tour) => {
          const Icon = statusIcons[tour.status];
          return (
            <div
              key={tour.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${statusColors[tour.status]}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{tour.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Prévue à {tour.time}
                  </p>
                </div>
              </div>
              <Badge
                variant={
                  tour.status === "completed"
                    ? "default"
                    : tour.status === "in-progress"
                      ? "secondary"
                      : "outline"
                }
                className="rounded-lg text-xs"
              >
                {tour.status === "completed"
                  ? "Terminée"
                  : tour.status === "in-progress"
                    ? "En cours"
                    : "À faire"}
              </Badge>
            </div>
          );
        })}
      </div>

      <Link href="/etat-des-lieux">
        <Button
          variant="ghost"
          size="sm"
          className="mt-4 w-full justify-start rounded-xl"
        >
          Voir toutes les rondes
        </Button>
      </Link>
    </Card>
  );
}
