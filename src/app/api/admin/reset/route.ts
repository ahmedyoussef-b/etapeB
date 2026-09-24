import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api/auth-guard';
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

export async function POST(request: NextRequest) {
  const reqId = Math.random().toString(36).slice(2, 8);
  console.log(`[RESET-API][${reqId}][1] Début`);

  try {
    const authHeader = request.headers.get('authorization');
    console.log(`[RESET-API][${reqId}][2] Authorization header`, {
      hasHeader: !!authHeader,
      prefix: authHeader?.substring(0, 20),
    });

    const user = await getAuthenticatedUser(request);
    console.log(`[RESET-API][${reqId}][3] User`, {
      id: user.id, email: user.email, role: user.role,
    });

    const isAdmin = user.role?.toLowerCase() === 'admin';
    if (!isAdmin) {
      console.log(`[RESET-API][${reqId}][4] NON-ADMIN refusé`);
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    console.log(`[RESET-API][${reqId}][5] Body`, body);

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

    console.log(`[RESET-API][${reqId}][6] SUCCESS`, {
      tablesTruncated: tablesTruncated.length,
      filesInserted,
      usersUpserted,
      duration,
    });
    return NextResponse.json({
      success: true,
      tablesTruncated,
      filesInserted,
      usersUpserted,
      duration,
    });
  } catch (err) {
    console.error(`[RESET-API][${reqId}][ERROR]`, {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      toString: String(err),
    });
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
