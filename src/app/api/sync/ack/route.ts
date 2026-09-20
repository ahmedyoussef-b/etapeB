import { NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/services/db';

export const runtime = 'nodejs';

interface AckBody {
  userId: string;
  fileIds: string[];
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AckBody;
    
    if (!body.userId || !Array.isArray(body.fileIds) || body.fileIds.length === 0) {
      return NextResponse.json(
        { error: 'userId et fileIds requis' },
        { status: 400 }
      );
    }

    const prisma = getPrismaClient();

    // 1. Récupérer l'état actuel
    const current = await prisma.userSyncState.findUnique({
      where: { userId: body.userId },
    });

    const currentIds = current?.syncedFileIds || [];
    const newIds = Array.from(new Set([...currentIds, ...body.fileIds]));

    // 2. Upsert UserSyncState
    const updated = await prisma.userSyncState.upsert({
      where: { userId: body.userId },
      create: {
        userId: body.userId,
        syncedFileIds: newIds,
        lastSyncAt: new Date(),
      },
      update: {
        syncedFileIds: newIds,
        lastSyncAt: new Date(),
      },
    });

    // 3. Incrémenter downloadCount et transféré pour chaque fichier
    const rows = await prisma.publishQueue.findMany({
      where: { id: { in: body.fileIds } },
      select: { id: true, transferredTo: true },
    });

    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        if (!row.transferredTo.includes(body.userId)) {
          await tx.publishQueue.update({
            where: { id: row.id },
            data: { transferredTo: { push: body.userId } },
          });
        }
      }

      await tx.publishQueue.updateMany({
        where: { id: { in: body.fileIds } },
        data: { downloadCount: { increment: 1 } },
      });
    });

    return NextResponse.json({
      success: true,
      syncedCount: body.fileIds.length,
      totalSynced: updated.syncedFileIds.length,
    });

  } catch (error) {
    console.error('[sync/ack] error:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}
