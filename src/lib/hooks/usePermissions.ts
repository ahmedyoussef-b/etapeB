"use client";

import { useSession } from "next-auth/react";
import { Role, Permission, RBAC_MATRIX } from "@/lib/types/rbac";

const PRISMA_ROLE_TO_APP_ROLE: Record<string, Role> = {
  RONDIER: "rondier",
  CHEF_DE_BLOC: "chef-de-bloc",
  CHEF_DE_QUART: "chef-de-quart",
  ADMIN: "admin",
};

export function usePermissions() {
  const { data: session, status } = useSession();
  const rawRole = (session?.user?.role as Role | undefined) || "rondier";
  const role = (PRISMA_ROLE_TO_APP_ROLE[rawRole] || rawRole) as Role;
  const permissions = RBAC_MATRIX[role] || [];

  const hasPermission = (permission: Permission): boolean => {
    if (permissions.includes(permission)) return true;

    const [resource] = permission.split(":");
    const wildcard = `${resource}:*` as Permission;
    if (permissions.includes(wildcard)) return true;

    return false;
  };

  const hasAnyPermission = (perms: Permission[]): boolean => {
    return perms.some(p => hasPermission(p));
  };

  const hasAllPermissions = (perms: Permission[]): boolean => {
    return perms.every(p => hasPermission(p));
  };

  return { role, permissions, hasPermission, hasAnyPermission, hasAllPermissions };
}
