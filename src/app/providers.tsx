"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/notifications/toast-provider";
import { isTauriEnv } from "@/lib/tauri/env";

export function Providers({ children }: { children: React.ReactNode }) {
  const content = (
    <ThemeProvider>
      <ToastProvider>
        {children}
      </ToastProvider>
    </ThemeProvider>
  );

  // In Tauri, NextAuth client session fetching hits the local static server
  // (tauri://) instead of Vercel, causing CLIENT_FETCH_ERROR.
  // Tauri uses JWT Bearer tokens via Rust invoke + getAuthenticatedUser server-side.
  if (isTauriEnv()) {
    return <>{content}</>;
  }

  return (
    <SessionProvider>
      {content}
    </SessionProvider>
  );
}
