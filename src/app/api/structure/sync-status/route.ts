export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// src/app/api/structure/sync-status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, hasPermission, unauthorizedResponse, unauthenticatedResponse } from '@/lib/api/auth-guard';
import { getPrismaClient } from '@/lib/services/db';
import { LocalDatabaseAdapter } from '@/lib/database/local-adapter';

interface SyncStatusResponse {
  success: boolean;
  aligned: boolean;
  localCounts: {
    blocks: number;
    equipments: number;
    groups: number;
    groupEquipments: number;
  };
  dbCounts: {
    blocks: number;
    equipments: number;
    groups: number;
    groupEquipments: number;
  };
  missingInDb: {
    blocks: string[];
    equipments: string[];
    groups: string[];
    groupEquipments: string[];
  };
  extraInDb: {
    blocks: string[];
    equipments: string[];
    groups: string[];
    groupEquipments: string[];
  };
  lastSync: string | null;
}

export async function GET(_request: NextRequest) {
  const user = await getAuthenticatedUser(_request);
  if (!user) {
    return unauthenticatedResponse();
  }
  if (!hasPermission(user.role, 'settings:*')) {
    return unauthorizedResponse();
  }

  try {
    const prisma = getPrismaClient();

    try {
      const [dbBlocks, dbEquipments, dbGroups, dbGroupEquipments] = await Promise.all([
        prisma.block.findMany({ select: { code: true } }),
        prisma.equipment.findMany({ select: { code: true, blocCode: true } }),
        prisma.group.findMany({ select: { code: true } }),
        prisma.groupEquipment.findMany({ select: { code: true, groupeCode: true } }),
      ]);

      const localAdapter = new LocalDatabaseAdapter('.data');
      const [centraleEntries, groupesEntries] = await Promise.all([
        localAdapter.list('Centrale').catch(() => []),
        localAdapter.list('Groupes').catch(() => []),
      ]);

      const localBlockNames = centraleEntries.filter(e => !e.startsWith('.'));
      const localGroupNames = groupesEntries.filter(e => !e.startsWith('.'));

      const equipmentLists = await Promise.all(
        localBlockNames.map(block => localAdapter.list(`Centrale/${block}`).catch(() => []))
      );
      const localEquipments = equipmentLists.flatMap((eqs, i) =>
        eqs.filter(e => !e.startsWith('.')).map(eq => `${localBlockNames[i]}/${eq}`)
      );

      const groupEquipmentLists = await Promise.all(
        localGroupNames.map(group => localAdapter.list(`Groupes/${group}`).catch(() => []))
      );
      const localGroupEquipments = groupEquipmentLists.flatMap((geqs, i) =>
        geqs.filter(e => !e.startsWith('.')).map(geq => `${localGroupNames[i]}/${geq}`)
      );

      const dbBlockCodes = new Set(dbBlocks.map(b => b.code));
      const dbEquipKeys = new Set(dbEquipments.map(e => `${e.blocCode}/${e.code}`));
      const dbGroupCodes = new Set(dbGroups.map(g => g.code));
      const dbGEKeys = new Set(dbGroupEquipments.map(ge => `${ge.groupeCode}/${ge.code}`));

      const missingInDb = {
        blocks: localBlockNames.filter(b => !dbBlockCodes.has(b)),
        equipments: localEquipments.filter(e => !dbEquipKeys.has(e)),
        groups: localGroupNames.filter(g => !dbGroupCodes.has(g)),
        groupEquipments: localGroupEquipments.filter(ge => !dbGEKeys.has(ge))
      };

      const extraInDb = {
        blocks: Array.from(dbBlockCodes).filter(b => !localBlockNames.includes(b)),
        equipments: Array.from(dbEquipKeys).filter(e => !localEquipments.includes(e)),
        groups: Array.from(dbGroupCodes).filter(g => !localGroupNames.includes(g)),
        groupEquipments: Array.from(dbGEKeys).filter(ge => !localGroupEquipments.includes(ge))
      };

      const aligned =
        missingInDb.blocks.length === 0 &&
        missingInDb.equipments.length === 0 &&
        missingInDb.groups.length === 0 &&
        missingInDb.groupEquipments.length === 0 &&
        extraInDb.blocks.length === 0 &&
        extraInDb.equipments.length === 0 &&
        extraInDb.groups.length === 0 &&
        extraInDb.groupEquipments.length === 0;

      const response: SyncStatusResponse = {
        success: true,
        aligned,
        localCounts: {
          blocks: localBlockNames.length,
          equipments: localEquipments.length,
          groups: localGroupNames.length,
          groupEquipments: localGroupEquipments.length
        },
        dbCounts: {
          blocks: dbBlocks.length,
          equipments: dbEquipments.length,
          groups: dbGroups.length,
          groupEquipments: dbGroupEquipments.length
        },
        missingInDb,
        extraInDb,
        lastSync: null
      };

      return NextResponse.json(response, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      console.error('sync-status error:', error);
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        available: false
      }, { status: 500 });
    }
  } catch (error) {
    console.error('sync-status error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      available: false
    }, { status: 500 });
  }
}