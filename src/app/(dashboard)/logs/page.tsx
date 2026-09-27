import { Suspense } from 'react';
import { LogsClient } from './logs-client';

export default function LogsPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Logs système
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Surveillez les événements et les erreurs de l'application.
          </p>
        </div>
      </div>

      <Suspense fallback={<div className="mt-6 animate-pulse rounded-2xl border border-border/60 bg-muted/40 p-6 text-sm text-muted-foreground">Chargement des logs...</div>}>
        <LogsClient />
      </Suspense>
    </section>
  );
}
