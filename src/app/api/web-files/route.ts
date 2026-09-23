import { NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/services/db';
import { verifyInjectToken } from '@/lib/auth/inject-token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing Bearer token' }, { status: 401 });
    }

    const token = authHeader.slice('Bearer '.length).trim();
    const verified = verifyInjectToken(token);
    if (!verified) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const prisma = getPrismaClient();

    const [files, total] = await Promise.all([
      prisma.document.findMany({
        where: {
          injectedAt: null,
        },
        select: {
          path: true,
          filename: true,
          mimeType: true,
          size: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.document.count({
        where: {
          injectedAt: null,
        },
      }),
    ]);

    return NextResponse.json({
      files: files.map((file) => ({
        path: file.path,
        filename: file.filename,
        mimeType: file.mimeType,
        size: file.size,
        createdAt: file.createdAt.toISOString(),
      })),
      total,
    });
  } catch (err) {
    console.error('[API /web-files] Erreur:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
