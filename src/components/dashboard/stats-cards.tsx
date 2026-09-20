"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Users, FileText, Activity, AlertTriangle, CheckCircle, Clock, BarChart3 } from "lucide-react";

export interface StatItem {
  title: string;
  value: string;
  change?: string;
  trend?: "up" | "down" | "neutral";
  icon?: React.ComponentType<{ className?: string }>;
}

export interface StatsCardsProps {
  showAllStats?: boolean;
  showUserStats?: boolean;
  showSystemStats?: boolean;
  customStats?: StatItem[];
}

const defaultUserStats: StatItem[] = [
  { title: "Utilisateurs", value: "1 248", change: "+12%", trend: "up", icon: Users },
  { title: "Procédures", value: "86", change: "+4%", trend: "up", icon: FileText },
  { title: "Équipes actives", value: "4", change: "+0%", trend: "neutral", icon: Users },
];

const defaultSystemStats: StatItem[] = [
  { title: "Workflows actifs", value: "324", change: "-2%", trend: "down", icon: Activity },
  { title: "Erreurs 24h", value: "7", change: "-18%", trend: "down", icon: AlertTriangle },
  { title: "Taux de disponibilité", value: "99.9%", change: "+0.1%", trend: "up", icon: CheckCircle },
  { title: "Dernière sync", value: "2 min", change: "", trend: "neutral", icon: Clock },
];

export function StatsCards({
  showAllStats = false,
  showUserStats = false,
  showSystemStats = false,
  customStats = [],
}: StatsCardsProps) {
  const stats: StatItem[] = [];

  if (customStats.length > 0) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {customStats.map((stat) => {
          const Icon = stat.icon ?? BarChart3;
          return (
            <Card
              key={stat.title}
              className="relative overflow-hidden rounded-2xl border-border/60 p-6 shadow-sm transition-all hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                {stat.change && (
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      stat.trend === "up"
                        ? "text-emerald-600"
                        : stat.trend === "down"
                          ? "text-rose-600"
                          : "text-muted-foreground"
                    )}
                  >
                    {stat.change}
                  </span>
                )}
              </div>
              <div className="mt-4">
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{stat.title}</p>
              </div>
            </Card>
          );
        })}
      </div>
    );
  }

  if (showUserStats) {
    stats.push(...defaultUserStats);
  }

  if (showSystemStats) {
    stats.push(...defaultSystemStats);
  }

  if (showAllStats) {
    stats.push(...defaultUserStats, ...defaultSystemStats);
  }

  if (stats.length === 0) {
    stats.push(...defaultUserStats);
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon ?? BarChart3;
        return (
          <Card
            key={stat.title}
            className="relative overflow-hidden rounded-2xl border-border/60 p-6 shadow-sm transition-all hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-6 w-6" />
              </div>
              {stat.change && (
                <span
                  className={cn(
                    "text-xs font-semibold",
                    stat.trend === "up"
                      ? "text-emerald-600"
                      : stat.trend === "down"
                        ? "text-rose-600"
                        : "text-muted-foreground"
                  )}
                >
                  {stat.change}
                </span>
              )}
            </div>
            <div className="mt-4">
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{stat.title}</p>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
