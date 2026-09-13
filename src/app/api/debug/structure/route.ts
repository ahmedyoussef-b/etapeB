import { NextRequest, NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/services/db';

export const runtime = 'nodejs';

export async function GET(_request: NextRequest) {
  const prisma = getPrismaClient();

  try {
    const rootList = await prisma.block.findMany({ orderBy: { code: 'asc' } });
    const centraleChildren = await prisma.equipment.findMany({
      where: { blocCode: 'B0', subsystemCode: null },
      orderBy: { code: 'asc' }
    });

    return NextResponse.json({
      databaseUrl: '***',
      blocks: rootList.map(b => b.code),
      b0Equipments: centraleChildren.map(e => e.code)
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
