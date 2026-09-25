"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { Role, Permission, RBAC_MATRIX } from "@/lib/types/rbac";
import type { AuthUser, AuthReturn } from "./types";
import { isTauriEnv } from "@/lib/tauri/env";

export function useWebAuth(): AuthReturn {
  const isTauri = isTauriEnv();
  const sessionResult = isTauri ? { data: undefined, status: "unauthenticated" as const } : useSession();
  const session = sessionResult?.data;
  const status = sessionResult?.status ?? "loading";
  const router = useRouter();

  const rawUser = session?.user;
  const user: AuthUser | null = rawUser
    ? {
        id: rawUser.id,
        email: rawUser.email ?? undefined,
        name: rawUser.name ?? undefined,
        role: (rawUser.role as Role) || "rondier",
        blockId: (rawUser as any).blockId ?? null,
        blockName: (rawUser as any).blockName ?? null,
        permissions: ((rawUser as any).permissions as Permission[]) || [],
      }
    : null;

  const role = user?.role;
  const permissions = user?.permissions || [];
  const isAuthenticated = isTauri ? false : status === "authenticated";
  const isLoading = isTauri ? false : status === "loading";

  const hasRole = useCallback(
    (requiredRole: Role | Role[]): boolean => {
      if (!role) return false;
      const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
      return roles.includes(role);
    },
    [role]
  );

  const hasPermission = useCallback(
    (permission: Permission | Permission[]): boolean => {
      const perms = Array.isArray(permission) ? permission : [permission];
      return perms.some(p => permissions.includes(p));
    },
    [permissions]
  );

  const login = useCallback(
    async (email: string, password: string): Promise<{ error?: string }> => {
      try {
        const result = await signIn("credentials", {
          email: email.trim().toLowerCase(),
          password,
          redirect: false,
        });
        if (result?.error) {
          return { error: "Email ou mot de passe incorrect" };
        }
        return {};
      } catch {
        return { error: "Une erreur est survenue lors de la connexion" };
      }
    },
    []
  );

  const logout = useCallback(async () => {
    await signOut({ redirect: false });
    router.push("/login");
    router.refresh();
  }, [router]);

  return {
    user,
    session: user,
    role,
    permissions,
    isAuthenticated,
    isLoading,
    status,
    login,
    logout,
    hasRole,
    hasPermission,
  };
}
