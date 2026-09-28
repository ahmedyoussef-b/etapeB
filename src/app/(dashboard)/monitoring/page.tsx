"use client";

import { useEffect, useState } from "react";
import { MetricCard } from "@/components/monitoring/MetricCard";
import { Card } from "@/components/ui/card";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth/use-auth";
import { useRouter } from "next/navigation";
import { fetchWithAuth } from "@/lib/tauri/fetch-with-auth";

interface Metric {
  name: string;
  current: number;
  limit: number;
  unit: string;
  status: "ok" | "warning" | "critical";
  percent: number;
  details?: string;
}

export default function MonitoringPage() {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const { isLoading, isAuthenticated, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.push("/login");
    } else if (user?.role !== "admin") {
      router.push("/dashboard");
    }
  }, [isLoading, isAuthenticated, user, router]);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/monitoring");
      if (res.ok) {
        const data = await res.json();
        setMetrics(data.metrics);
        setLastUpdate(new Date().toLocaleTimeString("fr-FR"));
      }
    } catch (err) {
      console.error("Erreur fetch metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && user?.role === "admin") {
      fetchMetrics();
      const interval = setInterval(fetchMetrics, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, user]);

  if (isLoading || !isAuthenticated || user?.role !== "admin") {
    return null;
  }

  const criticalCount = metrics.filter((m) => m.status === "critical").length;
  const warningCount = metrics.filter((m) => m.status === "warning").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Monitoring</h1>
          <p className="text-sm text-gray-500">
            Dernière mise à jour : {lastUpdate || "Chargement..."}
          </p>
        </div>
        <button
          onClick={fetchMetrics}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Actualiser
        </button>
      </div>

      {/* Résumé */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-sm text-gray-500">Total métriques</p>
          <p className="text-2xl font-bold">{metrics.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Alertes</p>
          <p className="text-2xl font-bold text-yellow-600">{warningCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Critiques</p>
          <p className="text-2xl font-bold text-red-600">{criticalCount}</p>
        </Card>
      </div>

      {/* Métriques */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((metric, i) => (
          <MetricCard key={i} {...metric} />
        ))}
      </div>

      {/* Alertes détaillées */}
      {criticalCount + warningCount > 0 && (
        <Card className="p-4 bg-yellow-50 border-yellow-200">
          <h3 className="font-medium mb-2">⚠️ Alertes actives</h3>
          <ul className="space-y-1 text-sm">
            {metrics
              .filter((m) => m.status !== "ok")
              .map((m, i) => (
                <li key={i}>
                  <strong>{m.name}</strong> : {m.current.toLocaleString("fr-FR")}{" "}
                  {m.unit}
                  {m.unit && ` (${m.percent.toFixed(1)}% de la limite)`}
                </li>
              ))}
          </ul>
        </Card>
      )}

      {metrics.length === 0 && !loading && (
        <Card className="p-8 text-center">
          <ShieldCheck className="w-12 h-12 mx-auto text-gray-400 mb-2" />
          <p className="text-gray-500">Aucune métrique disponible pour le moment.</p>
        </Card>
      )}
    </div>
  );
}
