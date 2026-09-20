"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { invoke } from "@tauri-apps/api/core";
import { useAuth } from "@/lib/auth/use-auth";
import { isTauriEnv } from "@/lib/tauri/env";

export function SetupGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoading, isAuthenticated } = useAuth();
  const [phase, setPhase] = useState<"checking" | "ready" | "redirecting">("checking");
  const needsSetupRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (isLoading) {
        return;
      }
      if (!isAuthenticated) {
        setPhase("ready");
        return;
      }
      if (!isTauriEnv()) {
        setPhase("ready");
        return;
      }
      try {
        const config = await invoke<{ setup_completed: boolean } | null>("read_config");
        if (!cancelled) {
          needsSetupRef.current = !config || !config.setup_completed;
          setPhase("ready");
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[SetupGuard] read_config failed:", err);
          needsSetupRef.current = false;
          setPhase("ready");
        }
      }
    };

    check();
    return () => {
      cancelled = true;
    };
  }, [isLoading, isAuthenticated]);

  useEffect(() => {
    if (phase === "ready" && needsSetupRef.current && pathname && pathname !== "/setup") {
      router.replace("/setup");
      setPhase("redirecting");
    }
  }, [phase, pathname]);

  if (phase === "checking" || phase === "redirecting") {
    return null;
  }

  return <>{children}</>;
}
