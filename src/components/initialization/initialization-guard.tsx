"use client";

import { InitializationContext } from '@/components/providers/initialization-provider';
import { InitializationProgress } from './initialization-progress';

export function InitializationGuard({ children }: { children: React.ReactNode }) {
  return (
    <InitializationContext.Consumer>
      {(ctx) => {
        const status = ctx?.error ? 'error' : ctx?.initialized ? 'ready' : ctx?.isLoading ? 'loading' : 'idle';
        const progress = ctx?.initialized ? 100 : ctx?.isLoading ? 50 : 0;

        if (status === 'loading' || status === 'idle') {
          return (
            <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-50">
              <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl backdrop-blur-sm">
                <div className="mb-4 text-center">
                  <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">NexaFlow</p>
                  <h1 className="mt-2 text-2xl font-semibold">Initialisation locale</h1>
                </div>
                <InitializationProgress progress={progress} />
              </div>
            </div>
          );
        }

        return <>{children}</>;
      }}
    </InitializationContext.Consumer>
  );
}
