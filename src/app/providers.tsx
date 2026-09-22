"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/notifications/toast-provider";
import { isTauriEnv } from "@/lib/tauri/env";

export function Providers({ children }: { children: React.ReactNode }) {
  const isTauri = isTauriEnv();
  const content = (
    <ThemeProvider>
      <ToastProvider>
        {children}
      </ToastProvider>
    </ThemeProvider>
  );

  if (isTauri) {
    return content;
  }

  return (
    <SessionProvider>
      {content}
    </SessionProvider>
  );
}
