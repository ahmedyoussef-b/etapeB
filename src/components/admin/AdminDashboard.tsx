"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PublishQueueTab } from "./PublishQueueTab";
import { UsersTab } from "./UsersTab";
import { VersionsTab } from "./VersionsTab";
import { VectorizationTab } from "./VectorizationTab";
import { HardDrive, Users, GitBranch, Cpu, ShieldCheck } from "lucide-react";

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("publish-queue");

  return (
    <div className="space-y-6">
      {/* En-tête principal */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <ShieldCheck className="h-8 w-8 text-primary" />
            Supervision & Administration
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tableau de bord de pilotage du pipeline de données (Publication, Synchronisation, Versions, RAG Vectoriel)
          </p>
        </div>
      </div>

      {/* Onglets Shadcn */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 p-1 rounded-2xl bg-muted/70 border border-border/50 h-auto gap-1">
          <TabsTrigger
            value="publish-queue"
            className="rounded-xl py-2.5 text-xs sm:text-sm font-medium flex items-center justify-center gap-2 data-active:bg-background data-active:shadow-sm transition-all"
          >
            <HardDrive className="h-4 w-4" />
            <span>File de publication</span>
          </TabsTrigger>

          <TabsTrigger
            value="users"
            className="rounded-xl py-2.5 text-xs sm:text-sm font-medium flex items-center justify-center gap-2 data-active:bg-background data-active:shadow-sm transition-all"
          >
            <Users className="h-4 w-4" />
            <span>Utilisateurs & Sync</span>
          </TabsTrigger>

          <TabsTrigger
            value="versions"
            className="rounded-xl py-2.5 text-xs sm:text-sm font-medium flex items-center justify-center gap-2 data-active:bg-background data-active:shadow-sm transition-all"
          >
            <GitBranch className="h-4 w-4" />
            <span>Versions Système</span>
          </TabsTrigger>

          <TabsTrigger
            value="vectorization"
            className="rounded-xl py-2.5 text-xs sm:text-sm font-medium flex items-center justify-center gap-2 data-active:bg-background data-active:shadow-sm transition-all"
          >
            <Cpu className="h-4 w-4" />
            <span>Vectorisation (ONNX)</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="publish-queue" className="mt-0 focus-visible:outline-none">
          <PublishQueueTab active={activeTab === "publish-queue"} />
        </TabsContent>

        <TabsContent value="users" className="mt-0 focus-visible:outline-none">
          <UsersTab active={activeTab === "users"} />
        </TabsContent>

        <TabsContent value="versions" className="mt-0 focus-visible:outline-none">
          <VersionsTab active={activeTab === "versions"} />
        </TabsContent>

        <TabsContent value="vectorization" className="mt-0 focus-visible:outline-none">
          <VectorizationTab active={activeTab === "vectorization"} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
