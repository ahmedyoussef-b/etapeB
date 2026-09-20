export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/services/db';

export const dynamic = 'force-dynamic';

export const GET = async (request: NextRequest) => {
  const prisma = getPrismaClient();

  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'status';

    if (action === 'status') {
      const blocks = await prisma.block.count();
      const equipment = await prisma.equipment.count();
      const groups = await prisma.group.count();
      const groupEquipments = await prisma.groupEquipment.count();
      const procedures = await prisma.procedure.count();
      const users = await prisma.user.count();
      const teams = await prisma.team.count();

      return NextResponse.json({
        success: true,
        initialized: true,
        stats: {
          blocks,
          equipment,
          groups,
          groupEquipments,
          procedures,
          users,
          teams
        }
      });
    }

    if (action === 'init') {
      const blocks = ['A0', 'B0', 'B1', 'B2', 'B3'];
      for (const code of blocks) {
        await prisma.block.upsert({
          where: { code },
          update: {},
          create: { code, libelle: `Bloc ${code}`, type: 'centrale', syncState: 'local_only' }
        });
      }

      const groups = [
        { libelle: 'CHAUDIERE DE RECUPERATION 1', code: 'CHAUDIERE_DE_RECUPERATION_1' },
        { libelle: 'CHAUDIERE DE RECUPERATION 2', code: 'CHAUDIERE_DE_RECUPERATION_2' },
        { libelle: 'CONTROSTEAM', code: 'CONTROSTEAM' },
        { libelle: 'DISTRIBUTION ELECTRIQUE', code: 'DISTRIBUTION_ELECTRIQUE' },
        { libelle: "ORDINATEUR DE SUPERVISION - TCI", code: 'ORDINATEUR_DE_SUPERVISION_TCI' },
        { libelle: "POSTE D'EAU", code: 'POSTE_D_EAU' },
        { libelle: 'REGULATION ET CALCULS', code: 'REGULATION_ET_CALCULS' },
        { libelle: 'SUPERVISION DU BLOC', code: 'SUPERVISION_DU_BLOC' },
        { libelle: 'TURBINE GAZ 1', code: 'TURBINE_GAZ_1' },
        { libelle: 'TURBINE GAZ 2', code: 'TURBINE_GAZ_2' },
        { libelle: 'TURBINE VAPEUR', code: 'TURBINE_VAPEUR' }
      ];

      for (const group of groups) {
        await prisma.group.upsert({
          where: { code: group.code },
          update: {},
          create: { code: group.code, libelle: group.libelle, type: 'groupe', syncState: 'local_only' }
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Base de données initialisée',
        stats: {
          blocks: blocks.length,
          groups: groups.length
        }
      });
    }

    return NextResponse.json({ error: 'Action non supportée' }, { status: 400 });

  } catch (error) {
    console.error('Erreur init DB:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
};
