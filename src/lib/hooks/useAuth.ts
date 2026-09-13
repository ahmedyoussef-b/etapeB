"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Role } from "@prisma/client";
import { Permission } from "@/lib/types/rbac";

export function useAuth() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const user = session?.user;
  const role = user?.role as Role | undefined;
  const permissions = (user?.permissions as Permission[]) || [];

  const isAuthenticated = status === "authenticated";
  const isLoading = status === "loading";

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
    router.push("/auth/login");
    router.refresh();
  };

  return {
    user,
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
