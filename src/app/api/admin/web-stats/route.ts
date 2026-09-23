import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/options';
import { getPrismaClient } from '@/lib/services/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const prisma = getPrismaClient();

    const [totalCount, placeholderCount, oldest, newest] = await Promise.all([
      prisma.document.count(),
      prisma.document.count({
        where: { path: { endsWith: '.placeholder' } },
      }),
      prisma.document.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      prisma.document.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    const uploadCount = totalCount - placeholderCount;

    return NextResponse.json({
      populated: uploadCount > 0,
      uploadCount,
      placeholderCount,
      totalCount,
      oldest: oldest?.createdAt ?? null,
      newest: newest?.createdAt ?? null,
    });
  } catch (err) {
    console.error('[API /admin/web-stats] Erreur:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
