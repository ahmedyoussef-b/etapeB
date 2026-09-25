"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Role } from "@prisma/client";
import { Permission } from "@/lib/types/rbac";
import { isTauriEnv } from "@/lib/tauri/env";

export function useAuth() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const isTauri = isTauriEnv();
  // In Tauri, session is provided by MockSessionProvider in providers.tsx
  // with role="admin". In browser, session comes from real SessionProvider.
  const isAuthenticated = status === "authenticated";
  const isLoading = status === "loading" || status === "unauthenticated";

  const role = (session?.user?.role as Role | undefined);
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
    user: session?.user,
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
