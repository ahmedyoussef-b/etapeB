"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/notifications/toast-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  const content = (
    <ThemeProvider>
      <ToastProvider>
        {children}
      </ToastProvider>
    </ThemeProvider>
  );

  return (
    <SessionProvider>
      {content}
    </SessionProvider>
  );
}
