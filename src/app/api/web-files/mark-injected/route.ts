import { NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/services/db';
import { verifyInjectToken } from '@/lib/auth/inject-token';
import { revalidateTag } from 'next/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
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

    const body = await request.json().catch(() => ({}));
    const paths: string[] = Array.isArray(body.paths) ? body.paths : [];
    if (paths.length === 0) {
      return NextResponse.json({ error: 'Missing paths array' }, { status: 400 });
    }

    const prisma = getPrismaClient();
    const now = new Date();

    const result = await prisma.document.updateMany({
      where: {
        path: { in: paths },
        injectedAt: null,
      },
      data: {
        injectedAt: now,
      },
    });

    revalidateTag('structure-web');

    return NextResponse.json({
      marked: result.count,
    });
  } catch (err) {
    console.error('[API /web-files/mark-injected] Erreur:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
