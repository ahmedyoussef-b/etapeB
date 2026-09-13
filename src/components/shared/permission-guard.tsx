"use client";

import { ReactNode } from "react";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { Permission } from "@/lib/types/rbac";

interface PermissionGuardProps {
  children: ReactNode;
  permissions: Permission | Permission[];
  fallback?: ReactNode;
  mode?: "all" | "any";
}

export function PermissionGuard({
  children,
  permissions,
  fallback = null,
  mode = "all",
}: PermissionGuardProps) {
  const { hasAllPermissions, hasAnyPermission } = usePermissions();
  const perms = Array.isArray(permissions) ? permissions : [permissions];

  const hasAccess =
    mode === "all" ? hasAllPermissions(perms) : hasAnyPermission(perms);

  return hasAccess ? children : fallback;
}
