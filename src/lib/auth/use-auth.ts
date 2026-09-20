"use client";

import { useState } from "react";
import { isTauriEnv } from "@/lib/tauri/env";
import { useTauriAuth } from "./use-tauri-auth";
import { useWebAuth } from "./use-web-auth";
import type { AuthReturn } from "./types";

/**
 * Hook d'authentification unifié.
 *
 * - En environnement Tauri (desktop) → retourne l'état de `useTauriAuth`
 * - En environnement navigateur (web) → retourne l'état de `useWebAuth`
 *
 * Les deux hooks sous-jacents sont **toujours appelés** pour respecter
 * les règles des Hooks React. Dans l'environnement non utilisé, le hook
 * retombe sur des valeurs par défaut sans effet de bord.
 */
export function useAuth(): AuthReturn {
  const [isTauri] = useState(() => isTauriEnv());
  const tauriAuth = useTauriAuth();
  const webAuth = useWebAuth();

  if (isTauri) {
    return tauriAuth;
  }

  return webAuth;
}
