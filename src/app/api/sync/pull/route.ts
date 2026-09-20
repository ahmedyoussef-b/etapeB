export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/auth-guard';
import { getPrismaClient } from '@/lib/services/db';

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const prisma = getPrismaClient();
    const searchParams = request.nextUrl.searchParams;
    const entity = searchParams.get('entity');
    const since = searchParams.get('since');

    const where: any = {};
    if (since) {
      where.updatedAt = { gt: new Date(since) };
    }

    let data: any[] = [];

    switch (entity) {
      case 'procedures':
        data = await prisma.procedure.findMany({ where });
        break;
      case 'all':
        const [procedures] = await Promise.all([
          prisma.procedure.findMany(),
        ]);
        data = [
          ...procedures.map((p) => ({ ...p, entity: 'procedures' })),
        ];
        break;
      default:
        return NextResponse.json({ success: false, error: 'Invalid entity parameter' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: data.map((item) => ({
        id: item.id,
        entity: entity || 'all',
        data: item,
        updatedAt: item.updatedAt || item.createdAt,
      })),
      count: data.length,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}, 'logs:view');
