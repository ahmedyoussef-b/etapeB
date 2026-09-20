"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { isTauriEnv } from "@/lib/tauri/env";
import { Role, Permission, RBAC_MATRIX } from "@/lib/types/rbac";
import type { AuthUser, AuthReturn } from "./types";

interface TauriAuthSession {
  user_id: string;
  email: string;
  name: string;
  role: string;
  logged_in_at: string;
}

function tauriSessionToAuthUser(session: TauriAuthSession): AuthUser {
  const role = session.role as Role;
  return {
    id: session.user_id,
    email: session.email,
    name: session.name,
    role,
    permissions: RBAC_MATRIX[role] || [],
  };
}

export function useTauriAuth(): AuthReturn {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");

  useEffect(() => {
    let cancelled = false;

    const fetchSession = async () => {
      try {
        const session = await invoke<TauriAuthSession | null>("get_session");
        if (!cancelled) {
          if (session) {
            setUser(tauriSessionToAuthUser(session));
            setStatus("authenticated");
          } else {
            setUser(null);
            setStatus("unauthenticated");
          }
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setStatus("unauthenticated");
        }
      }
    };

    fetchSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const role = user?.role;
  const permissions = user?.permissions || [];
  const isAuthenticated = status === "authenticated";
  const isLoading = status === "loading";

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
        const session = await invoke<TauriAuthSession>("login", {
          email: email.trim().toLowerCase(),
          password,
        });
        setUser(tauriSessionToAuthUser(session));
        setStatus("authenticated");
        return {};
      } catch {
        return { error: "Email ou mot de passe incorrect" };
      }
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await invoke("logout");
    } catch {
      // ignore logout errors
    } finally {
      setUser(null);
      setStatus("unauthenticated");
      router.push("/login");
    }
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
