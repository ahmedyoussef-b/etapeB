"use client";

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';

interface InitializationContextValue {
  initialized: boolean;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const InitializationContext = createContext<InitializationContextValue | undefined>(undefined);

export function InitializationProvider({ children }: { children: React.ReactNode }) {
  const [initialized, setInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/init', { method: 'GET', cache: 'no-store' });
      const payload = await response.json();
      console.log('[init] payload', payload);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message ?? 'Initialisation impossible');
      }
      setInitialized(Boolean(payload.initialized));
      setError(null);
    } catch (err) {
      console.error('[init] error', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      setInitialized(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<InitializationContextValue>(() => ({ initialized, isLoading, error, refresh }), [initialized, isLoading, error, refresh]);

  return <InitializationContext.Provider value={value}>{children}</InitializationContext.Provider>;
}

export function useInitializationProvider() {
  const context = useContext(InitializationContext);
  if (!context) {
    throw new Error('useInitializationProvider must be used within InitializationProvider');
  }
  return context;
}
