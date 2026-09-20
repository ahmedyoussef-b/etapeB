export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { LocalDatabaseAdapter } from '@/lib/database/local-adapter';
import { withAuth } from '@/lib/api/auth-guard';

const seenIds = new Set<string>();

export const GET = withAuth(async () => {
  try {
    const localAdapter = new LocalDatabaseAdapter('.data');

    const dataLog = await localAdapter.readJSON<{ syncs: Array<{ failed?: number; success?: boolean; timestamp: string }> }>('system/sync-log.json').catch(() => null);
    const fileLog = await localAdapter.readJSON<{ fileSyncs: Array<{ errors?: number; timestamp: string }> }>('system/sync-files-log.json').catch(() => null);

    const dataSyncs = dataLog?.syncs || [];
    const fileSyncs = fileLog?.fileSyncs || [];

    const lastData = dataSyncs[dataSyncs.length - 1] || null;
    const lastFiles = fileSyncs[fileSyncs.length - 1] || null;

    const alerts: { id: string; severity: 'error' | 'warning'; title: string; message: string; timestamp: string }[] = [];

    if (lastData) {
      const id = `data-${(lastData as any).id || lastData.timestamp}`;
      const failed = lastData.failed || 0;
      const success = lastData.success;
      if (failed > 0) {
        alerts.push({
          id,
          severity: 'error',
          title: `Échecs de synchronisation (${failed})`,
          message: `Dernière sync : ${failed} entité(s) en échec`,
          timestamp: lastData.timestamp
        });
      } else if (success === false) {
        alerts.push({
          id,
          severity: 'error',
          title: 'Synchronisation en échec',
          message: 'La dernière synchronisation Web → Local a échoué',
          timestamp: lastData.timestamp
        });
      }
    }

    if (lastFiles) {
      const id = `files-${(lastFiles as any).id || lastFiles.timestamp}`;
      const errors = lastFiles.errors || 0;
      if (errors > 0) {
        alerts.push({
          id,
          severity: 'warning',
          title: `Erreurs fichiers (${errors})`,
          message: `${errors} fichier(s) n'ont pas pu être synchronisés`,
          timestamp: lastFiles.timestamp
        });
      }
    }

    const fresh = alerts.filter(a => !seenIds.has(a.id));
    for (const a of fresh) seenIds.add(a.id);

    return NextResponse.json({ success: true, alerts: fresh, timestamp: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}, 'logs:view');