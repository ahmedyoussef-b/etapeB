"use client";

import { useContext } from 'react';
import { InitializationContext, useInitializationProvider } from '@/components/providers/initialization-provider';

export type InitializationStatus = 'idle' | 'loading' | 'ready' | 'error';

export function useInitialization() {
  const context = useContext(InitializationContext);
  if (!context) {
    throw new Error('useInitialization must be used within InitializationProvider');
  }
  const { isLoading, initialized, error, refresh } = context;

  const status: InitializationStatus = error ? 'error' : initialized ? 'ready' : isLoading ? 'loading' : 'idle';

  return {
    status,
    progress: initialized ? 100 : isLoading ? 50 : 0,
    initialized,
    refresh,
    error,
  };
}
