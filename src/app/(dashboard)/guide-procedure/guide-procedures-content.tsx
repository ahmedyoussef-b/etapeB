"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Search,
  Filter,
  Plus,
  FileText,
  LayoutGrid,
  List,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ProcedureCard } from "@/components/procedures/ProcedureCard";
import { ProcedureListRow } from "@/components/procedures/ProcedureListRow";
import { PermissionGuard } from "@/components/shared/permission-guard";

import {
  getProcedures,
} from "@/lib/procedures/services/procedure-manager.service";

import type { TProcedure } from "@/lib/procedures/services/validator.service";

type ViewMode = "grid" | "list";
type SortOption = "recent" | "title" | "priority" | "duration";

export function GuideProceduresContent() {
  const router = useRouter();

  const [procedures, setProcedures] = useState<TProcedure[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  useEffect(() => {
    loadProcedures();
  }, []);

  async function loadProcedures() {
    setLoading(true);
    try {
      const data = getProcedures();
      setProcedures(data);
    } catch (error) {
      console.error("Erreur chargement procédures:", error);
      toast.error("Impossible de charger les procédures");
    } finally {
      setLoading(false);
    }
  }

  const filteredProcedures = useMemo(() => {
    let result = [...procedures];

    if (search.trim()) {
      const query = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.metadata.title.toLowerCase().includes(query) ||
          p.metadata.code.toLowerCase().includes(query) ||
          (p.metadata.description?.toLowerCase().includes(query) ?? false)
      );
    }

    if (categoryFilter !== "all") {
      result = result.filter((p) => p.metadata.category === categoryFilter);
    }

    if (priorityFilter !== "all") {
      result = result.filter((p) => p.metadata.priority === priorityFilter);
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case "title":
          return a.metadata.title.localeCompare(b.metadata.title);
        case "priority": {
          const order = { critique: 0, haute: 1, moyenne: 2, basse: 3 };
          return (
            (order[a.metadata.priority as keyof typeof order] ?? 99) -
            (order[b.metadata.priority as keyof typeof order] ?? 99)
          );
        }
        case "duration":
          return (
            (a.metadata.estimatedTimeMinutes ?? 0) -
            (b.metadata.estimatedTimeMinutes ?? 0)
          );
        case "recent":
        default:
          return 0;
      }
    });

    return result;
  }, [procedures, search, categoryFilter, priorityFilter, sortBy]);

  const categories = useMemo(
    () => Array.from(new Set(procedures.map((p) => p.metadata.category))).sort(),
    [procedures]
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-40" />
        </div>
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <Skeleton className="h-10 flex-1" />
              <Skeleton className="h-10 w-48" />
              <Skeleton className="h-10 w-40" />
              <Skeleton className="h-10 w-40" />
              <Skeleton className="h-10 w-40" />
            </div>
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Guide procédures</h1>
          <p className="text-muted-foreground">
            {procedures.length} procédure{procedures.length > 1 ? "s" : ""} disponible
            {procedures.length > 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <PermissionGuard permissions="procedures:create">
            <Button onClick={() => router.push("/creer-procedure")}>
              <Plus className="h-4 w-4 mr-2" />
              Créer une procédure
            </Button>
          </PermissionGuard>
        </div>
      </div>

      {/* Barre de filtres */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher par titre, code ou description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={categoryFilter} onValueChange={(v: unknown) => setCategoryFilter(v as string)}>
              <SelectTrigger className="w-full lg:w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={priorityFilter}
              onValueChange={(v: unknown) => setPriorityFilter(v as string)}
            >
              <SelectTrigger className="w-full lg:w-40">
                <SelectValue placeholder="Priorité" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="critique">Critique</SelectItem>
                <SelectItem value="haute">Haute</SelectItem>
                <SelectItem value="moyenne">Moyenne</SelectItem>
                <SelectItem value="basse">Basse</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={sortBy}
              onValueChange={(v) => setSortBy(v as SortOption)}
            >
              <SelectTrigger className="w-full lg:w-40">
                <SelectValue placeholder="Trier par" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Plus récentes</SelectItem>
                <SelectItem value="title">Titre (A-Z)</SelectItem>
                <SelectItem value="priority">Priorité</SelectItem>
                <SelectItem value="duration">Durée</SelectItem>
              </SelectContent>
            </Select>

            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <TabsList>
                <TabsTrigger value="grid" title="Grille">
                  <LayoutGrid className="h-4 w-4" />
                </TabsTrigger>
                <TabsTrigger value="list" title="Liste">
                  <List className="h-4 w-4" />
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Contenu */}
      {filteredProcedures.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={
            procedures.length === 0
              ? "Aucune procédure disponible"
              : "Aucun résultat"
          }
          description={
            procedures.length === 0
              ? "Commencez par créer ou importer une procédure."
              : "Essayez de modifier vos filtres ou votre recherche."
          }
          action={
            procedures.length === 0 ? (
              <PermissionGuard permissions="procedures:create">
                <Button onClick={() => router.push("/creer-procedure")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Créer une procédure
                </Button>
              </PermissionGuard>
            ) : undefined
          }
        />
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProcedures.map((procedure) => (
            <ProcedureCard
              key={procedure.metadata.code}
              procedure={procedure}
              onOpen={() =>
                router.push(`/procedures/guide/${procedure.metadata.code}`)
              }
              onDuplicate={async () => {
                const copy = { ...procedure };
                copy.metadata = {
                  ...procedure.metadata,
                  code: `${procedure.metadata.code}-COPY`,
                  title: `${procedure.metadata.title} (copie)`,
                };
                try {
                  const response = await fetch("/api/procedures/library/import", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(copy),
                  });
                  const result = await response.json();
                  if (!response.ok) throw new Error(result.message || "Erreur duplication");
                  toast.success(`Procédure dupliquée: ${copy.metadata.title}`);
                  await loadProcedures();
                } catch (error: any) {
                  toast.error(error.message || "Erreur lors de la duplication");
                }
              }}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredProcedures.map((procedure) => (
            <ProcedureListRow
              key={procedure.metadata.code}
              procedure={procedure}
              onOpen={() =>
                router.push(`/procedures/guide/${procedure.metadata.code}`)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
