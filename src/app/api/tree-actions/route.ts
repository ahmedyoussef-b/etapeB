import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api/auth-guard';
import { PrismaAdapter } from '@/lib/database/prisma-adapter';
import { revalidateTag } from 'next/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getWebAdapter() {
  return new PrismaAdapter();
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

const PROTECTED_ROOTS = ['bank', 'documents', 'system'] as readonly string[];

function isProtectedRoot(path: string): boolean {
  const parts = path.split('/').filter(p => p);
  return parts.length === 1 && PROTECTED_ROOTS.includes(parts[0]);
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const isAdmin = user.role?.toLowerCase() === 'admin';
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { action, path, source, name, repository } = body as {
      action?: string;
      path?: string;
      source?: string;
      name?: string;
      repository?: string;
    };

    if (source !== 'web') {
      return NextResponse.json(
        { error: 'Only web source is supported by this endpoint' },
        { status: 400 }
      );
    }

    if (!action || !path) {
      return NextResponse.json(
        { error: 'Missing action or path' },
        { status: 400 }
      );
    }

    const adapterPath = mapWebPathToAdapter(path);
    const adapter = getWebAdapter();

    switch (action) {
      case 'rename': {
        const newName = name?.trim();
        if (!newName) {
          return NextResponse.json({ error: 'Missing name for rename' }, { status: 400 });
        }

        const parts = adapterPath.split('/').filter(Boolean);
        parts[parts.length - 1] = newName;
        const newPath = parts.join('/');

        if (newPath === adapterPath) {
          return NextResponse.json({ success: true, path, oldPath: path });
        }

        const exists = await adapter.exists(adapterPath).catch(() => false);
        if (!exists) {
          return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        await adapter.rename(adapterPath, newPath);
        revalidateTag('structure-web');
        return NextResponse.json({ success: true, path: mapAdapterPathToWeb(newPath), oldPath: path });
      }

      case 'delete': {
        if (isProtectedRoot(adapterPath)) {
          return NextResponse.json(
            { error: 'Ce répertoire est structurel et ne peut être supprimé' },
            { status: 403 }
          );
        }

        const exists = await adapter.exists(adapterPath).catch(() => false);
        if (!exists) {
          return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        await adapter.delete(adapterPath);
        revalidateTag('structure-web');
        return NextResponse.json({ success: true, deleted: 1 });
      }

      case 'mkdir': {
        const newName = name?.trim();
        if (!newName) {
          return NextResponse.json({ error: 'Missing name for mkdir' }, { status: 400 });
        }

        const newPath = adapterPath ? `${adapterPath}/${newName}` : newName;
        await adapter.mkdir(newPath);
        revalidateTag('structure-web');
        return NextResponse.json({ success: true, path: mapAdapterPathToWeb(newPath) });
      }

      case 'create':
      case 'upload': {
        const fileName = name?.trim();
        if (!fileName) {
          return NextResponse.json({ error: 'Missing name for create' }, { status: 400 });
        }

        const newPath = adapterPath ? `${adapterPath}/${fileName}` : fileName;
        await adapter.write(newPath, Buffer.from(''));
        revalidateTag('structure-web');
        return NextResponse.json({ success: true, path: mapAdapterPathToWeb(newPath) });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (err) {
    console.error('Erreur tree-action:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
