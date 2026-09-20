"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/use-auth";
import { cn } from "@/lib/utils";
import { LayoutDashboard, HelpCircle, FileText, MessageSquare, BookOpen, Image, Database, Video, BarChart3, Users, ClipboardList, Bot, Sun, Moon, GitBranch, Activity, User, UserPlus, Download } from "lucide-react";
import { NexaFlowLogo } from "@/components/brand/nexaflow-logo";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { RBAC_MATRIX, Role } from "@/lib/types/rbac";
import { Permission } from "@/lib/types/rbac";

const PRISMA_ROLE_TO_APP_ROLE: Record<string, Role> = {
  RONDIER: "rondier",
  CHEF_DE_BLOC: "chef-de-bloc",
  CHEF_DE_QUART: "chef-de-quart",
  ADMIN: "admin",
};

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permissions: Permission[];
}

const ROLE_HOMES: Record<Role, { href: string; label: string }> = {
  "rondier": { href: "/rondier", label: "Mon espace" },
  "chef-de-bloc": { href: "/chef-de-bloc", label: "Mon espace" },
  "chef-de-quart": { href: "/chef-de-quart", label: "Mon espace" },
  "admin": { href: "/admin", label: "Tableau de bord" },
};

const NAV_ITEMS: NavItem[] = [
  { href: "/pipeline", label: "Pipeline", icon: GitBranch, permissions: ["settings:*"] },
  { href: "/q-r", label: "Q/R", icon: HelpCircle, permissions: ["settings:*"] },
  { href: "/actions-ia", label: "Actions IA", icon: Bot, permissions: ["settings:*"] },
  { href: "/creer-procedure", label: "Créer une procédure", icon: FileText, permissions: ["procedures:create"] },
  { href: "/guide-procedure", label: "Guide procédure", icon: BookOpen, permissions: ["procedures:view"] },
  { href: "/structure-bdd", label: "Structure BDD", icon: Database, permissions: ["settings:*"] },
  { href: "/images", label: "Banque d'images", icon: Image, permissions: ["banque-images:view"] },
  { href: "/video-conference", label: "Visioconférence", icon: Video, permissions: ["visio:*"] },
  { href: "/rapports", label: "Rapports", icon: BarChart3, permissions: ["rapports:view"] },
  { href: "/equipes", label: "Équipes", icon: Users, permissions: ["equipes:view"] },
  { href: "/etat-des-lieux", label: "État des lieux", icon: ClipboardList, permissions: ["etat-lieux:*"] },
  { href: "/logs", label: "Logs", icon: Activity, permissions: ["logs:view"] },
  { href: "/chat-ia", label: "Chat IA", icon: MessageSquare, permissions: ["chat-ia:*"] },
  { href: "/admin", label: "Supervision", icon: Activity, permissions: ["users:manage"] },
  { href: "/admin/users", label: "Utilisateurs", icon: UserPlus, permissions: ["users:manage"] },
  { href: "/download", label: "Télécharger", icon: Download, permissions: ["dashboard:view"] },
  { href: "/profile", label: "Profil", icon: User, permissions: ["dashboard:view"] },
];

function hasAnyPermission(userPermissions: Permission[], itemPermissions: Permission[]): boolean {
  return itemPermissions.some(itemPerm => {
    if (userPermissions.includes(itemPerm)) return true;
    const [resource] = itemPerm.split(":");
    const wildcard = `${resource}:*` as Permission;
    return userPermissions.includes(wildcard);
  });
}

export const DashboardSidebar = React.memo(function DashboardSidebar({ collapsed }: { collapsed?: boolean } = {}) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();

  const rawRole = (user?.role as Role | string) || "rondier";
  const role = (PRISMA_ROLE_TO_APP_ROLE[rawRole] || rawRole) as Role;
  const userPermissions = RBAC_MATRIX[role] || [];

  const roleHome = ROLE_HOMES[role] || ROLE_HOMES["rondier"];
  const homeActive = !!pathname && (pathname === roleHome.href || pathname.startsWith(roleHome.href + "/"));

  const additionalItems = NAV_ITEMS.filter((item) => hasAnyPermission(userPermissions, item.permissions));



  const isActive = (href: string) => !!pathname && (pathname === href || pathname.startsWith(href + "/"));

  return (
    <aside className={`flex h-screen w-64 shrink-0 flex-col border-r border-border bg-white transition-opacity duration-300 ${collapsed ? "opacity-0" : "opacity-100"}`}>
      <div className="flex h-16 items-center gap-3 border-b border-border px-5">
        <NexaFlowLogo className="h-9 w-9" />
        <span className="text-lg font-semibold tracking-tight text-slate-900">NexaFlow</span>
      </div>

      <nav className="flex-1 overflow-y-auto space-y-1 p-3">
        <Link
          href={roleHome.href}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
            homeActive ? "bg-slate-100 text-slate-900 shadow-sm" : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
          )}
        >
          <LayoutDashboard className={cn("h-4 w-4 transition-colors", homeActive ? "text-slate-900" : "text-slate-500")} />
          {roleHome.label}
        </Link>

        {additionalItems.map((item) => {
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                active ? "bg-slate-100 text-slate-900 shadow-sm" : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <item.icon className={cn("h-4 w-4 transition-colors", active ? "text-slate-900" : "text-slate-500")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 rounded-xl text-slate-700 hover:text-slate-900"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {theme === "dark" ? "Mode clair" : "Mode sombre"}
        </Button>
      </div>
    </aside>
  );
});
