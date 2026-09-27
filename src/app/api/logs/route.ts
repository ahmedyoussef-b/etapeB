export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/auth-guard';
import { LocalDatabaseAdapter } from '@/lib/database/local-adapter';

export const GET = withAuth(async () => {
  try {
    const localAdapter = new LocalDatabaseAdapter('.data');

    const dataLog = await localAdapter.readJSON<{ syncs: Array<{ failed?: number; success?: boolean; timestamp: string; message?: string }> }>('system/sync-log.json').catch(() => null);
    const fileLog = await localAdapter.readJSON<{ fileSyncs: Array<{ errors?: number; timestamp: string; message?: string }> }>('system/sync-files-log.json').catch(() => null);

    const logs: Array<{ timestamp: string; level: 'info' | 'warn' | 'error'; message: string; meta?: any }> = [];

    for (const sync of dataLog?.syncs || []) {
      const level: 'info' | 'warn' | 'error' = sync.failed ? 'error' : sync.success === false ? 'error' : 'info';
      logs.push({
        timestamp: sync.timestamp,
        level,
        message: sync.message || `Sync ${sync.success === false ? 'échouée' : sync.failed ? 'avec erreurs' : 'OK'}`,
        meta: sync,
      });
    }

    for (const fileSync of fileLog?.fileSyncs || []) {
      logs.push({
        timestamp: fileSync.timestamp,
        level: fileSync.errors ? 'warn' : 'info',
        message: fileSync.message || `Fichiers ${fileSync.errors ? 'en erreur' : 'OK'}`,
        meta: fileSync,
      });
    }

    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({ success: true, logs });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      logs: [],
    }, { status: 500 });
  }
}, 'logs:view');
