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

    const url = new URL(request.url);
    const path = url.searchParams.get('path');
    if (!path) {
      return NextResponse.json({ error: 'Missing path query parameter' }, { status: 400 });
    }

    const prisma = getPrismaClient();
    const document = await prisma.document.findUnique({
      where: { path },
      select: {
        data: true,
        mimeType: true,
        filename: true,
        size: true,
      },
    });

    if (!document) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const buffer = document.data ? Buffer.from(document.data) : Buffer.alloc(0);
    const contentType = document.mimeType || 'application/octet-stream';
    const filename = document.filename || path.split('/').pop() || 'download';

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': String(document.size ?? buffer.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[API /web-files/download] Erreur:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
