import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, FileText, Users, Shield, Clock } from "lucide-react";
import { proceduresFR } from "@/lib/i18n/procedures";
import { TProcedure, TStep } from "@/lib/procedures/services/validator.service";

interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  icon: React.ReactNode;
  weight: number;
}

interface ProcedureChecklistProps {
  procedure: TProcedure;
  className?: string;
}

export function ProcedureChecklist({ procedure, className }: ProcedureChecklistProps) {
  const [items, setItems] = useState<ChecklistItem[]>([]);

  useEffect(() => {
    const hasTitle = !!procedure.metadata.title.trim();
    const hasCode = !!procedure.metadata.code.trim();
    const hasCategory = !!procedure.metadata.category;
    const hasPriority = !!procedure.metadata.priority;
    const hasSteps = procedure.steps.length > 0;
    const hasStepTitles = procedure.steps.every((s) => s.title.trim());
    const hasInstructions = procedure.steps.some((s) => s.instructions.trim());
    const hasMandatory = procedure.steps.some((s) => s.isMandatory);
    const hasSafety = (procedure.metadata.globalSafetyInstructions || []).length > 0;
    const hasRoles = (procedure.metadata.requiredRoles || []).length > 0;
    const hasEstimatedTime = procedure.metadata.estimatedTimeMinutes > 0;
    const noCircularDeps = !hasCircularDependencies(procedure.steps);

    setItems([
      { id: "title", label: proceduresFR.checklist.title, completed: hasTitle, icon: <FileText className="h-3.5 w-3.5" />, weight: 10 },
      { id: "code", label: proceduresFR.checklist.code, completed: hasCode, icon: <FileText className="h-3.5 w-3.5" />, weight: 5 },
      { id: "category", label: proceduresFR.checklist.category, completed: hasCategory, icon: <FileText className="h-3.5 w-3.5" />, weight: 5 },
      { id: "priority", label: proceduresFR.checklist.priority, completed: hasPriority, icon: <FileText className="h-3.5 w-3.5" />, weight: 5 },
      { id: "steps", label: proceduresFR.checklist.steps, completed: hasSteps, icon: <FileText className="h-3.5 w-3.5" />, weight: 15 },
      { id: "stepTitles", label: proceduresFR.checklist.stepTitles, completed: hasStepTitles, icon: <FileText className="h-3.5 w-3.5" />, weight: 10 },
      { id: "instructions", label: proceduresFR.checklist.instructions, completed: hasInstructions, icon: <FileText className="h-3.5 w-3.5" />, weight: 10 },
      { id: "mandatory", label: proceduresFR.checklist.mandatory, completed: hasMandatory, icon: <Shield className="h-3.5 w-3.5" />, weight: 5 },
      { id: "safety", label: proceduresFR.checklist.safety, completed: hasSafety, icon: <Shield className="h-3.5 w-3.5" />, weight: 10 },
      { id: "roles", label: proceduresFR.checklist.roles, completed: hasRoles, icon: <Users className="h-3.5 w-3.5" />, weight: 5 },
      { id: "time", label: proceduresFR.checklist.time, completed: hasEstimatedTime, icon: <Clock className="h-3.5 w-3.5" />, weight: 5 },
      { id: "noCircular", label: proceduresFR.checklist.noCircular, completed: noCircularDeps, icon: <FileText className="h-3.5 w-3.5" />, weight: 15 },
    ]);
  }, [procedure]);

  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  const completedWeight = items.filter((item) => item.completed).reduce((sum, item) => sum + item.weight, 0);
  const score = Math.round((completedWeight / totalWeight) * 100);

  const completedCount = items.filter((item) => item.completed).length;
  const totalCount = items.length;

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {proceduresFR.checklist.title}
          </p>
          <p className="text-xs text-muted-foreground">
            {completedCount}/{totalCount} — {score}%
          </p>
        </div>
        <Badge variant={score >= 80 ? "default" : score >= 50 ? "secondary" : "destructive"} className="text-xs">
          {score >= 80 ? "Complet" : score >= 50 ? "En cours" : "À améliorer"}
        </Badge>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden mb-4">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${score}%` }}
        />
      </div>

      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2.5 text-sm">
            {item.completed ? (
              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            )}
            <span className={item.completed ? "text-foreground" : "text-muted-foreground line-through opacity-60 flex-1 text-xs md:text-sm truncate max-w-[200px]"}>
              {item.label}
            </span>
            {item.icon && <div className="text-muted-foreground">{item.icon}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function hasCircularDependencies(steps: TStep[]): boolean {
  const graph = new Map<string, string[]>();
  steps.forEach((s) => graph.set(s.id, s.dependencies || []));

  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(node: string): boolean {
    if (inStack.has(node)) return true;
    if (visited.has(node)) return false;
    visited.add(node);
    inStack.add(node);
    for (const dep of graph.get(node) || []) {
      if (dfs(dep)) return true;
    }
    inStack.delete(node);
    return false;
  }

  for (const node of Array.from(graph.keys())) {
    if (dfs(node)) return true;
  }
  return false;
}