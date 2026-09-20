import { Role, Permission, RBAC_MATRIX } from "@/lib/types/rbac";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  role: Role;
  blockId?: string | null;
  blockName?: string | null;
  permissions: Permission[];
}

export interface AuthReturn {
  user: AuthUser | null;
  session: AuthUser | null;
  role: Role | undefined;
  permissions: Permission[];
  isAuthenticated: boolean;
  isLoading: boolean;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  hasRole: (role: Role | Role[]) => boolean;
  hasPermission: (permission: Permission | Permission[]) => boolean;
}
