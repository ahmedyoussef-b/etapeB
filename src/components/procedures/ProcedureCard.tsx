"use client";

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Clock,
  ListChecks,
  Shield,
  Play,
  MoreVertical,
  Copy,
  Trash2,
  Edit,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TProcedure } from "@/lib/procedures/services/validator.service";

interface ProcedureCardProps {
  procedure: TProcedure;
  onOpen: () => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  production: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
  maintenance: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  securite: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20",
  qualite: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
  logistique: "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20",
  environnement: "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20",
};

const PRIORITY_CONFIG: Record<
  string,
  { label: string; className: string; icon?: React.ComponentType<{ className?: string }> }
> = {
  critique: {
    label: "Critique",
    className: "bg-red-600 text-white hover:bg-red-700",
    icon: AlertTriangle,
  },
  haute: { label: "Haute", className: "bg-orange-500 text-white hover:bg-orange-600" },
  moyenne: { label: "Moyenne", className: "bg-blue-500 text-white hover:bg-blue-600" },
  basse: { label: "Basse", className: "bg-gray-500 text-white hover:bg-gray-600" },
};

export function ProcedureCard({
  procedure,
  onOpen,
  onEdit,
  onDuplicate,
  onDelete,
}: ProcedureCardProps) {
  const { metadata, steps } = procedure;
  const priority = PRIORITY_CONFIG[metadata.priority] ?? PRIORITY_CONFIG.basse;
  const PriorityIcon = priority.icon;

  return (
    <Card className="group flex flex-col h-full overflow-hidden transition-all hover:shadow-lg hover:border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <Badge
              variant="outline"
              className={cn("text-xs", CATEGORY_COLORS[metadata.category])}
            >
              {metadata.category}
            </Badge>
            <Badge className={cn("text-xs", priority.className)}>
              {PriorityIcon && <PriorityIcon className="h-3 w-3 mr-1" />}
              {priority.label}
            </Badge>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Modifier
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="h-4 w-4 mr-2" />
                Dupliquer
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="space-y-1 pt-2">
          <h3 className="font-semibold text-lg leading-tight line-clamp-2">
            {metadata.title}
          </h3>
          <p className="text-xs font-mono text-muted-foreground">{metadata.code}</p>
        </div>
      </CardHeader>

      <CardContent className="flex-1 pb-3">
        {metadata.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
            {metadata.description}
          </p>
        )}

        <div className="grid grid-cols-3 gap-2 text-xs">
          <Stat icon={ListChecks} label={`${steps.length} étape${steps.length > 1 ? "s" : ""}`} />
          <Stat icon={Clock} label={`${metadata.estimatedTimeMinutes} min`} />
          <Stat
            icon={Shield}
            label={`${(metadata.globalSafetyInstructions || []).length} consigne(s)`}
          />
        </div>

        {metadata.requiredRoles && metadata.requiredRoles.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {metadata.requiredRoles.slice(0, 3).map((role: string) => (
              <Badge key={role} variant="secondary" className="text-xs font-normal">
                {role}
              </Badge>
            ))}
            {metadata.requiredRoles.length > 3 && (
              <Badge variant="secondary" className="text-xs font-normal">
                +{metadata.requiredRoles.length - 3}
              </Badge>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-0">
        <Button className="w-full" variant="outline" onClick={onOpen}>
          <Play className="h-4 w-4 mr-2" />
          Lancer le guide
        </Button>
      </CardFooter>
    </Card>
  );
}

function Stat({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{label}</span>
    </div>
  );
}
