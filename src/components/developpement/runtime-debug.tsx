"use client";

import { useAuth } from "@/lib/auth/use-auth";
import { isTauriEnv } from "@/lib/tauri/env";
import { usePathname } from "next/navigation";

export function RuntimeDebug() {
  const { user, isAuthenticated, isLoading, status } = useAuth();
  const pathname = usePathname();
  const tauri = isTauriEnv();

  return (
    <div
      style={{
        position: "fixed",
        bottom: 8,
        right: 8,
        zIndex: 9999,
        background: "rgba(0,0,0,0.85)",
        color: "#fff",
        padding: 10,
        borderRadius: 8,
        fontFamily: "monospace",
        fontSize: 11,
        lineHeight: 1.5,
        maxWidth: 420,
        pointerEvents: "none",
      }}
    >
      <div>[RuntimeDebug]</div>
      <div>tauri={String(tauri)}</div>
      <div>pathname={pathname}</div>
      <div>status={status}</div>
      <div>isAuthenticated={String(isAuthenticated)}</div>
      <div>isLoading={String(isLoading)}</div>
      <div>user={user ? `${user.email} / ${user.role}` : "null"}</div>
    </div>
  );
}
