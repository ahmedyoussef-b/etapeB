export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/auth-guard';
import { getPrismaClient } from '@/lib/services/db';

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json().catch(() => ({}));
    const { type, entity, entityId, data } = body;

    if (!entity || !entityId || !data) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const prisma = getPrismaClient();

    switch (entity) {
      case 'procedures': {
        const existing = await prisma.procedure.findUnique({ where: { id: entityId } });
        if (existing) {
          await prisma.procedure.update({ where: { id: entityId }, data });
        } else {
          await prisma.procedure.create({ data });
        }
        break;
      }
      default:
        return NextResponse.json({ success: false, error: `Unsupported entity: ${entity}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, entity, entityId });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}, 'settings:*');
