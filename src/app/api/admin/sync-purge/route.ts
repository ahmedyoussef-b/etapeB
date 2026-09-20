import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/options';
import { getPrismaClient } from '@/lib/services/db';
import { resolveStorageRoot, readIndex } from '@/lib/services/sync/sync-index';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const dryRun = body.dryRun === true;
    const requestedPaths: string[] | undefined = Array.isArray(body.paths) ? body.paths : undefined;

    const storageRoot = resolveStorageRoot();
    const index = await readIndex(storageRoot);
    if (!index) {
      return NextResponse.json(
        { error: 'Sync index not found. Run a sync first.' },
        { status: 409 },
      );
    }

    const allIndexedPaths = new Set(index.getAll().map(e => e.path));
    const pathsToPurge = (requestedPaths ?? Array.from(allIndexedPaths)).filter(p => allIndexedPaths.has(p));

    if (requestedPaths && pathsToPurge.length !== requestedPaths.length) {
      const rejected = requestedPaths.filter(p => !allIndexedPaths.has(p));
      console.warn(`[SyncPurge] ${rejected.length} chemins rejetés (non indexés)`, rejected);
    }

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        total: pathsToPurge.length,
        paths: pathsToPurge,
      });
    }

    const prisma = getPrismaClient();
    const results = { deleted: 0, errors: 0, failed: [] as string[] };

    for (const p of pathsToPurge) {
      try {
        await prisma.document.deleteMany({ where: { path: p } });
        results.deleted++;
      } catch (err) {
        console.error(`[SyncPurge] Failed to delete ${p}:`, err);
        results.errors++;
        results.failed.push(p);
      }
    }

    return NextResponse.json({
      success: true,
      total: pathsToPurge.length,
      ...results,
    });
  } catch (err) {
    console.error('[SyncPurge] Unexpected error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
