import { NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/services/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'userId requis' },
        { status: 400 }
      );
    }

    const prisma = getPrismaClient();

    const userState = await prisma.userSyncState.findUnique({
      where: { userId },
    });

    const syncedIds = userState?.syncedFileIds || [];

    const pendingCount = await prisma.publishQueue.count({
      where: {
        id: { notIn: syncedIds },
        expiresAt: { gt: new Date() },
      },
    });

    return NextResponse.json({
      pendingCount,
      lastSyncAt: userState?.lastSyncAt?.toISOString() || null,
    });

  } catch (error) {
    console.error('[sync/count] error:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
