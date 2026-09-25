"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/notifications/toast-provider";
import { isTauriEnv } from "@/lib/tauri/env";
import { Role, Permission } from "@/lib/types/rbac";
import { ReactNode } from "react";

// In Tauri, NextAuth client session fetching hits the local static server
// (tauri://) instead of Vercel, causing CLIENT_FETCH_ERROR.
// We provide a mock session via SessionProvider with refetch disabled,
// so useSession() returns the mock session without any network fetch.
const TAURI_MOCK_SESSION = {
  user: {
    id: "tauri-local",
    email: "local",
    name: "Tauri",
    role: "admin" as Role,
    permissions: [] as Permission[],
  },
  expires: new Date(Date.now() + 86400000).toISOString(),
};

export function Providers({ children }: { children: ReactNode }) {
  const content = (
    <ThemeProvider>
      <ToastProvider>
        {children}
      </ToastProvider>
    </ThemeProvider>
  );

  if (isTauriEnv()) {
    return (
      <SessionProvider
        session={TAURI_MOCK_SESSION}
        refetchInterval={0}
        refetchOnWindowFocus={false}
      >
        {content}
      </SessionProvider>
    );
  }

  return (
    <SessionProvider>
      {content}
    </SessionProvider>
  );
}
