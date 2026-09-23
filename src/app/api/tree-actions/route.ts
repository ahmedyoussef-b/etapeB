import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/options';
import { PrismaAdapter } from '@/lib/database/prisma-adapter';
import { revalidateTag } from 'next/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getWebAdapter() {
  return new PrismaAdapter();
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== 'admin') {
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

    const adapter = getWebAdapter();

    switch (action) {
      case 'rename': {
        const newName = name?.trim();
        if (!newName) {
          return NextResponse.json({ error: 'Missing name for rename' }, { status: 400 });
        }

        const parts = path.split('/').filter(Boolean);
        parts[parts.length - 1] = newName;
        const newPath = parts.join('/');

        if (newPath === path) {
          return NextResponse.json({ success: true, path, oldPath: path });
        }

        const exists = await adapter.exists(path).catch(() => false);
        if (!exists) {
          return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        await adapter.rename(path, newPath);
        revalidateTag('structure-web');
        return NextResponse.json({ success: true, path: newPath, oldPath: path });
      }

      case 'delete': {
        const exists = await adapter.exists(path).catch(() => false);
        if (!exists) {
          return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        await adapter.delete(path);
        revalidateTag('structure-web');
        return NextResponse.json({ success: true, deleted: 1 });
      }

      case 'mkdir': {
        const newName = name?.trim();
        if (!newName) {
          return NextResponse.json({ error: 'Missing name for mkdir' }, { status: 400 });
        }

        const newPath = path ? `${path}/${newName}` : newName;
        await adapter.mkdir(newPath);
        revalidateTag('structure-web');
        return NextResponse.json({ success: true, path: newPath });
      }

      case 'create':
      case 'upload': {
        const fileName = name?.trim();
        if (!fileName) {
          return NextResponse.json({ error: 'Missing name for create' }, { status: 400 });
        }

        const newPath = path ? `${path}/${fileName}` : fileName;
        await adapter.write(newPath, Buffer.from(''));
        revalidateTag('structure-web');
        return NextResponse.json({ success: true, path: newPath });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (err) {
    console.error('[API /tree-actions] Erreur:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
