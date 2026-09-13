import { NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/services/db';

export const runtime = 'nodejs';

export async function GET() {
  const prisma = getPrismaClient();

  try {
    const [blocks, groups, equipments, groupEquipments, documents, users, procedures, hrs, teams, mirrors, indexes] = await Promise.all([
      prisma.block.count(),
      prisma.group.count(),
      prisma.equipment.count(),
      prisma.groupEquipment.count(),
      prisma.document.count(),
      prisma.user.count(),
      prisma.procedure.count(),
      prisma.humanResource.count(),
      prisma.team.count(),
      prisma.mirrorRepertoire.count(),
      prisma.indexRecord.count()
    ]);

    const sampleBlocks = await prisma.block.findMany({ select: { code: true, libelle: true }, take: 5 });
    const sampleGroups = await prisma.group.findMany({ select: { code: true, libelle: true }, take: 5 });

    return NextResponse.json({
      databaseUrl: '***',
      counts: { blocks, groups, equipments, groupEquipments, documents, users, procedures, hrs, teams, mirrors, indexes },
      sampleBlocks,
      sampleGroups
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
