import { DefaultSession, DefaultUser } from "next-auth";
import { Role, Permission } from "@/lib/types/rbac";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      blockId?: string | null;
      blockName?: string | null;
      permissions: Permission[];
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    role: Role;
    blockId?: string | null;
    blockName?: string | null;
    permissions: Permission[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    blockId?: string | null;
    blockName?: string | null;
    permissions: Permission[];
  }
}
