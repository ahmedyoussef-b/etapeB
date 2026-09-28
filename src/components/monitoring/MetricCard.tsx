import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

interface MetricCardProps {
  name: string;
  current: number;
  limit: number;
  unit: string;
  status: "ok" | "warning" | "critical";
  percent: number;
  details?: string;
}

const statusConfig = {
  ok: {
    color: "bg-green-500",
    textColor: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    icon: CheckCircle2,
    label: "OK",
  },
  warning: {
    color: "bg-yellow-500",
    textColor: "text-yellow-600",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-200",
    icon: AlertTriangle,
    label: "Alerte",
  },
  critical: {
    color: "bg-red-500",
    textColor: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    icon: XCircle,
    label: "Critique",
  },
};

export function MetricCard(props: MetricCardProps) {
  const config = statusConfig[props.status];
  const Icon = config.icon;

  return (
    <Card className={`p-4 ${config.bgColor} ${config.borderColor} border`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${config.textColor}`} />
          <h3 className="font-medium text-sm">{props.name}</h3>
        </div>
        <Badge variant="outline" className={config.textColor}>
          {config.label}
        </Badge>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">
            {props.current.toLocaleString("fr-FR")} {props.unit}
          </span>
          <span className="text-gray-400">
            / {props.limit.toLocaleString("fr-FR")} {props.unit}
          </span>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${config.color}`}
            style={{ width: `${Math.min(props.percent, 100)}%` }}
          />
        </div>

        <p className="text-xs text-gray-500 text-right">
          {props.percent.toFixed(1)}%
        </p>

        {props.details && (
          <p className="text-xs text-gray-400 mt-1">{props.details}</p>
        )}
      </div>
    </Card>
  );
}
