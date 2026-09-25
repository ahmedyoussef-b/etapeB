"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Role } from "@prisma/client";
import { Permission } from "@/lib/types/rbac";
import { isTauriEnv } from "@/lib/tauri/env";

export function useAuth() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // In Tauri, NextAuth session provider is not mounted (avoids CLIENT_FETCH_ERROR).
  // Tauri app uses JWT Bearer tokens for API calls. The local Tauri user is
  // always treated as admin (desktop = full local access by the admin account).
  const isTauri = isTauriEnv();
  const isAuthenticated = isTauri ? true : status === "authenticated";
  const isLoading = isTauri ? false : status === "loading";

  // In Tauri, derive role from environment (always admin for desktop users).
  // In browser, derive from NextAuth session.
  const role = isTauri ? ("ADMIN" as Role) : (session?.user?.role as Role | undefined);
  const permissions = (session?.user?.permissions as Permission[]) || [];

  const hasRole = (requiredRole: Role | Role[]): boolean => {
    if (!role) return false;
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    return roles.includes(role);
  };

  const hasPermission = (permission: Permission | Permission[]): boolean => {
    const perms = Array.isArray(permission) ? permission : [permission];
    return perms.some(p => permissions.includes(p));
  };

  const logout = async () => {
    await signOut({ redirect: false });
    router.push("/login");
    router.refresh();
  };

  return {
    user: session?.user ?? (isTauri ? { id: "tauri-local", email: "local", name: "Tauri" as string } : undefined),
    role,
    permissions,
    isAuthenticated,
    isLoading,
    hasRole,
    hasPermission,
    logout,
    session,
  };
}
