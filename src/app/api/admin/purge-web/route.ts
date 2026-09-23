import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/options';
import { getPrismaClient } from '@/lib/services/db';
import { revalidateTag } from 'next/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRESERVED_TABLES = [
  'blocks',
  'equipments',
  'groups',
  'group_equipments',
  'procedures',
  'human_resources',
  'teams',
  'mirror_repertoire',
  'indexes',
  'system_versions',
  'users',
  'sessions',
  '_prisma_migrations',
];

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const dryRun = body.dryRun === true;

    const prisma = getPrismaClient();
    const startTime = Date.now();

    if (dryRun) {
      const estimatedCount = await prisma.document.count({
        where: { NOT: { path: { endsWith: '.placeholder' } } },
      });
      return NextResponse.json({
        success: true,
        dryRun: true,
        tablesToTruncate: ['documents'],
        preservedTables: PRESERVED_TABLES,
        estimatedCount,
      });
    }

    const result = await prisma.document.deleteMany({
      where: { NOT: { path: { endsWith: '.placeholder' } } },
    });
    const duration = Date.now() - startTime;

    revalidateTag('structure-web');

    return NextResponse.json({
      success: true,
      purgedTable: 'documents',
      deleted: result.count,
      duration,
    });
  } catch (err) {
    console.error('[API /admin/purge-web] Erreur:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
