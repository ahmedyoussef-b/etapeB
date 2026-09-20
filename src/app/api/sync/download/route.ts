import { NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/services/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');
    
    if (!fileId) {
      return NextResponse.json(
        { error: 'fileId requis' },
        { status: 400 }
      );
    }

    const prisma = getPrismaClient();
    const file = await prisma.publishQueue.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      return NextResponse.json(
        { error: 'Fichier introuvable' },
        { status: 404 }
      );
    }

    // Retourner le contenu
    if (file.textContent) {
      return new NextResponse(file.textContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-File-Path': file.path,
          'X-File-Hash': file.hash,
        },
      });
    }

    if (file.content) {
      return new NextResponse(file.content, {
        status: 200,
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-File-Path': file.path,
          'X-File-Hash': file.hash,
        },
      });
    }

    return NextResponse.json(
      { error: 'Contenu vide' },
      { status: 500 }
    );
  } catch (error) {
    console.error('[sync/download] error:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
