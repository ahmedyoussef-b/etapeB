import { NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/services/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // 1. Récupérer userId (query ou session)
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'userId requis' },
        { status: 400 }
      );
    }

    const prisma = getPrismaClient();

    // 2. État de sync de l'utilisateur
    const userState = await prisma.userSyncState.findUnique({
      where: { userId },
    });

    const syncedIds = userState?.syncedFileIds || [];

    // 3. Fichiers non synchronisés et non expirés
    const pendingFiles = await prisma.publishQueue.findMany({
      where: {
        id: { notIn: syncedIds },
        expiresAt: { gt: new Date() },
      },
      orderBy: { publishedAt: 'asc' },
      take: 100,
      select: {
        id: true,
        path: true,
        hash: true,
        size: true,
        version: true,
        publishedAt: true,
      },
    });

    return NextResponse.json({
      files: pendingFiles.map(f => ({
        ...f,
        publishedAt: f.publishedAt.toISOString(),
      })),
      total: pendingFiles.length,
    });

  } catch (error) {
    console.error('[sync/pending] error:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}
