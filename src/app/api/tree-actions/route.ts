import { NextRequest, NextResponse } from 'next/server';
import { LocalDatabaseAdapter } from '@/lib/database/local-adapter';
import { WebDatabaseAdapter } from '@/lib/database/web-adapter';
import { withAuth } from '@/lib/api/auth-guard';
import * as nodePath from 'node:path';
import { promises as fs } from 'node:fs';

const REPO_CONFIG_FILE = nodePath.join(process.cwd(), 'repository-config.json');

async function getActiveRepository(): Promise<string> {
  try {
    const raw = await fs.readFile(REPO_CONFIG_FILE, 'utf-8');
    const config = JSON.parse(raw) as { activeRepository?: string };
    return config.activeRepository || '.data';
  } catch {
    return '.data';
  }
}

function mapWebPathToAdapter(path: string): string {
  if (path === '.data' || path === '.data/') return '.';
  if (path.startsWith('.data/')) return path.slice(6);
  return path;
}

function mapAdapterPathToWeb(path: string): string {
  if (path === '.' || path === '') return '.data';
  return `.data/${path}`;
}

async function getAdapter(source: string, repository?: string) {
  if (source === 'web') {
    const webUrl = process.env.WEB_API_URL;
    const apiKey = process.env.WEB_API_KEY;
    const databaseUrl = process.env.DATABASE_URL;
    if (webUrl || databaseUrl) {
      return new WebDatabaseAdapter(webUrl || '', apiKey || '', !webUrl, databaseUrl);
    }
  }
  const activeRepo = repository || await getActiveRepository();
  return new LocalDatabaseAdapter(activeRepo);
}

export const POST = withAuth(async (request: NextRequest) => {
  let requestSource = 'local';
  try {
    const body = await request.json();
    const { action, source = 'local', path, name, repository } = body;
    requestSource = source;

    if (!action || !path) {
      return NextResponse.json({ success: false, error: 'Paramètres manquants' }, { status: 400 });
    }

    const adapter = await getAdapter(source, repository);
    const adapterPath = source === 'web' ? mapWebPathToAdapter(path) : path;

    switch (action) {
      case 'mkdir': {
        if (!name) {
          return NextResponse.json({ success: false, error: 'Nom manquant' }, { status: 400 });
        }
        const newPath = adapterPath ? `${adapterPath}/${name}` : name;
        await adapter.mkdir(newPath);
        console.log('[tree-actions] mkdir success', { source, path: newPath });
        return NextResponse.json({ success: true, path: source === 'web' ? mapAdapterPathToWeb(newPath) : newPath });
      }

      case 'rename': {
        if (!name) {
          return NextResponse.json({ success: false, error: 'Nouveau nom manquant' }, { status: 400 });
        }
        const parts = adapterPath.split('/');
        parts[parts.length - 1] = name;
        const newPath = parts.join('/');
        await adapter.rename(adapterPath, newPath);
        console.log('[tree-actions] rename success', { source, oldPath: adapterPath, newPath });
        return NextResponse.json({ success: true, path: source === 'web' ? mapAdapterPathToWeb(newPath) : newPath });
      }

      case 'delete': {
        const beforeDelete = await adapter.exists(adapterPath);
        console.log('[tree-actions] delete start', { source, path: adapterPath, existsBefore: beforeDelete });
        await adapter.delete(adapterPath);
        const afterDelete = await adapter.exists(adapterPath);
        console.log('[tree-actions] delete end', { source, path: adapterPath, existsAfter: afterDelete });
        if (afterDelete) {
          return NextResponse.json({
            success: false,
            error: 'La suppression n\'a pas été confirmée par la source de données'
          }, { status: 409 });
        }
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ success: false, error: `Action inconnue: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('[tree-actions] error', { source: requestSource, action: (await request.json().catch(() => ({}))).action, error });
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: requestSource === 'local' ? 409 : 500 });
  }
}, 'settings:*');
