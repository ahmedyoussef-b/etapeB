export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { LocalDatabaseAdapter } from '@/lib/database/local-adapter';
import { WebDatabaseAdapter } from '@/lib/database/web-adapter';
import { SyncService, EntityType } from '@/lib/services/sync/sync.service';
import { withAuth } from '@/lib/api/auth-guard';
import logger from '@/lib/logger';
import * as nodePath from 'node:path';
import { promises as fs } from 'node:fs';

const DEFAULT_ENTITIES: EntityType[] = ['blocks', 'equipments', 'groups', 'groupEquipments', 'procedures'];

async function getActiveRepositoryPath(): Promise<string> {
  try {
    const configPath = nodePath.join(process.cwd(), 'repository-config.json');
    const raw = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(raw) as { activeRepository?: string };
    const active = config.activeRepository || '.data';
    return active.startsWith('repositories/') ? active : `repositories/${active}`;
  } catch {
    return '.data';
  }
}

export const POST = withAuth(async (request: NextRequest) => {
  const startTime = Date.now();
  const userId = request.headers.get('x-user-id') || 'unknown';

  try {
    const body = await request.json().catch(() => ({}));
    const { mode = 'data', force = false, dryRun = false, entityTypes = DEFAULT_ENTITIES } = body;

    logger.info('Sync started', { userId, mode, force, dryRun, entityTypes });

    const webUrl = process.env.WEB_API_URL;
    const apiKey = process.env.WEB_API_KEY;
    const databaseUrl = process.env.DATABASE_URL;

    const webAdapter = new WebDatabaseAdapter(
      webUrl || 'http://localhost',
      apiKey || 'noop',
      !!(databaseUrl)
    );

    try {
      const webAvailable = await webAdapter.ping();
      if (!webAvailable) {
        logger.warn('Web database unavailable', { userId });
        return NextResponse.json({ success: false, error: 'BDD Web inaccessible' }, { status: 503 });
      }
    } catch (error) {
      logger.error('Web database check failed', { userId, error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({
        success: false,
        error: 'BDD Web inaccessible: ' + (error instanceof Error ? error.message : String(error))
      }, { status: 503 });
    }

    const requestedRepo = body.repository || body.targetRepo;
    let activeRepoPath = requestedRepo ? (
      requestedRepo === '.data' ? '.data' : (
        requestedRepo.startsWith('repositories/') ? requestedRepo : `repositories/${requestedRepo}`
      )
    ) : await getActiveRepositoryPath();

    if (activeRepoPath === '.data' && mode === 'files') {
      try {
        const reposDir = nodePath.resolve(process.cwd(), 'repositories');
        const entries = await fs.readdir(reposDir, { withFileTypes: true });
        const firstWorkspace = entries.find(e => e.isDirectory() && !e.name.startsWith('.'));
        if (firstWorkspace) {
          activeRepoPath = `repositories/${firstWorkspace.name}`;
        }
      } catch {}
    }

    const localAdapter = new LocalDatabaseAdapter(activeRepoPath);
    const syncService = new SyncService(localAdapter, webAdapter);
    const syncResult = mode === 'files'
      ? await syncService.syncFiles()
      : mode === 'all'
        ? await syncService.syncAll({ force, dryRun, entityTypes })
        : await syncService.syncFromWeb({ force, dryRun, entityTypes });

    const duration = Date.now() - startTime;
    const isDataResult = 'imported' in syncResult;
    logger.info('Sync completed', { 
      userId, 
      success: syncResult.success, 
      duration,
      imported: isDataResult ? syncResult.imported : undefined,
      updated: isDataResult ? syncResult.updated : undefined,
      failed: isDataResult ? syncResult.failed : undefined,
    });

    return NextResponse.json({
      success: syncResult.success,
      result: syncResult,
      timestamp: new Date().toISOString()
    }, { status: syncResult.success ? 200 : 500 });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Sync failed', { userId, error: error instanceof Error ? error.message : String(error), duration });
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}, 'settings:*');

export const GET = withAuth(async (request: NextRequest) => {
  const userId = request.headers.get('x-user-id') || 'unknown';

  try {
    logger.info('Sync status requested', { userId });

    const webUrl = process.env.WEB_API_URL;
    const apiKey = process.env.WEB_API_KEY;
    const databaseUrl = process.env.DATABASE_URL;

    let webAvailable = false;
    const webAdapter = new WebDatabaseAdapter(
      webUrl || 'http://localhost',
      apiKey || 'noop',
      !!(databaseUrl)
    );

    try {
      webAvailable = await webAdapter.ping();
    } catch {
      webAvailable = false;
    }

    const activeRepoPath = await getActiveRepositoryPath();
    const localAdapter = new LocalDatabaseAdapter(activeRepoPath);
    const syncService = new SyncService(localAdapter, webAdapter);
    const status = await syncService.getSyncStatus();

    logger.debug('Sync status returned', { userId, status, webAvailable });

    return NextResponse.json({
      success: true,
      status,
      webAvailable,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Sync status failed', { userId, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}, 'logs:view');
