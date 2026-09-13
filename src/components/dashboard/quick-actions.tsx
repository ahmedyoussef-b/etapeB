"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import React from "react";

export interface QuickActionItem {
  label: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface QuickActionsProps {
  actions: QuickActionItem[];
}

export function QuickActions({ actions }: QuickActionsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Link key={action.href} href={action.href}>
            <Card className="h-full cursor-pointer rounded-2xl border-border/60 p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/40">
              <div className="flex items-center gap-4">
                {Icon && (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-foreground">{action.label}</p>
                </div>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
