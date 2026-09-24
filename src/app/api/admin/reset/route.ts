import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/options';
import { getPrismaClient } from '@/lib/services/db';
import { revalidateTag } from 'next/cache';
import { seedDatabase } from '@/lib/seed-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TRUNCATE_ORDER: { model: string; table: string }[] = [
  { model: 'executionStepLog', table: 'execution_step_logs' },
  { model: 'procedureMedia', table: 'procedure_media' },
  { model: 'procedureExecution', table: 'procedure_executions' },
  { model: 'procedure', table: 'procedures' },
  { model: 'auditLog', table: 'audit_logs' },
  { model: 'registrationRequest', table: 'registration_requests' },
  { model: 'groupEquipment', table: 'group_equipments' },
  { model: 'equipment', table: 'equipments' },
  { model: 'group', table: 'groups' },
  { model: 'block', table: 'blocks' },
  { model: 'mirrorRepertoire', table: 'mirror_repertoire' },
  { model: 'indexRecord', table: 'indexes' },
  { model: 'document', table: 'documents' },
  { model: 'humanResource', table: 'human_resources' },
  { model: 'team', table: 'teams' },
  { model: 'publishQueue', table: 'publish_queue' },
  { model: 'userSyncState', table: 'user_sync_states' },
  { model: 'systemVersion', table: 'system_versions' },
  { model: 'report', table: 'reports' },
  { model: 'syncLog', table: 'sync_logs' },
];

const PRESERVED_TABLES = [
  'users',
  'sessions',
  '_prisma_migrations',
];

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const backup = body.backup === true;

    const prisma = getPrismaClient();
    const startTime = Date.now();
    const tablesTruncated: string[] = [];
    let filesInserted = 0;
    let usersUpserted = 0;

    await prisma.$transaction(async (tx) => {
      for (const entry of TRUNCATE_ORDER) {
        if (entry.model === 'block') {
          await (tx as any).user.updateMany({ where: {}, data: { blockId: null as any } });
        }
        await (tx as any)[entry.model].deleteMany({ where: {} });
        tablesTruncated.push(entry.table);
      }
    });

    const seedResult = await seedDatabase(prisma);
    filesInserted = seedResult.filesInserted;
    usersUpserted = seedResult.usersUpserted;

    const duration = Date.now() - startTime;

    revalidateTag('structure-web');

    return NextResponse.json({
      success: true,
      tablesTruncated,
      filesInserted,
      usersUpserted,
      duration,
    });
  } catch (err) {
    console.error('[API /admin/reset] Erreur:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
