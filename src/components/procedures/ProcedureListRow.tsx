"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, ListChecks, Play, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TProcedure } from "@/lib/procedures/services/validator.service";

interface ProcedureListRowProps {
  procedure: TProcedure;
  onOpen: () => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  critique: "bg-red-600 text-white",
  haute: "bg-orange-500 text-white",
  moyenne: "bg-blue-500 text-white",
  basse: "bg-gray-500 text-white",
};

export function ProcedureListRow({ procedure, onOpen }: ProcedureListRowProps) {
  const { metadata, steps } = procedure;

  return (
    <Card className="flex items-center gap-4 p-4 hover:border-primary/30 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold truncate">{metadata.title}</h3>
          <Badge className={cn("text-xs shrink-0", PRIORITY_COLORS[metadata.priority])}>
            {metadata.priority}
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="font-mono">{metadata.code}</span>
          <span>•</span>
          <span>{metadata.category}</span>
        </div>
      </div>

      <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <ListChecks className="h-3.5 w-3.5" />
          {steps.length}
        </div>
        <div className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {metadata.estimatedTimeMinutes} min
        </div>
        <div className="flex items-center gap-1">
          <Shield className="h-3.5 w-3.5" />
          {metadata.globalSafetyInstructions?.length ?? 0}
        </div>
      </div>

      <Button variant="outline" size="sm" onClick={onOpen}>
        <Play className="h-4 w-4 mr-2" />
        Lancer
      </Button>
    </Card>
  );
}
