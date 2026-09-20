import {
  getAllProcedures,
  getProcedureByCode,
  createProcedure,
  updateProcedure,
  deleteProcedure,
  upsertProcedure,
  archiveOrDeleteProcedure,
  type ArchiveOrDeleteResult,
} from './procedures.service';
import * as localStore from '@/lib/procedures/server-store';
import { isDatabaseAvailable, getDatabaseHealth, canUseFallback, recordFallback, enqueueSyncOperation, drainSyncQueue, executeWithDatabaseTimed } from '@/lib/database/connection-manager';
import { procedureVersionService, VersionedProcedure } from '@/lib/procedures/services/procedure-version.service';
import logger from '@/lib/logger';

export async function safeGetAllProcedures() {
  if (!isDatabaseAvailable() || !canUseFallback()) {
    const start = Date.now();
    const result = await localStore.getAllProceduresLocal();
    recordFallback(Date.now() - start);
    return result;
  }

  try {
    const { result } = await executeWithDatabaseTimed(async (prisma) => {
      return await getAllProcedures();
    });
    return result;
  } catch (error) {
    const start = Date.now();
    const result = await localStore.getAllProceduresLocal();
    recordFallback(Date.now() - start);
    return result;
  }
}

export async function safeGetProcedureByCode(code: string) {
  if (!isDatabaseAvailable() || !canUseFallback()) {
    const start = Date.now();
    const result = await localStore.getProcedureByCodeLocal(code);
    recordFallback(Date.now() - start);
    return result;
  }

  try {
    const { result } = await executeWithDatabaseTimed(async (prisma) => {
      return await getProcedureByCode(code);
    });
    return result;
  } catch (error) {
    const start = Date.now();
    const result = await localStore.getProcedureByCodeLocal(code);
    recordFallback(Date.now() - start);
    return result;
  }
}

export async function safeCreateProcedure(procedure: Parameters<typeof createProcedure>[0]) {
  if (!isDatabaseAvailable() || !canUseFallback()) {
    const start = Date.now();
    const result = await localStore.createProcedureLocal(procedure);
    recordFallback(Date.now() - start);
    enqueueSyncOperation({ type: 'create', data: result });
    return result;
  }

  try {
    const { result } = await executeWithDatabaseTimed(async (prisma) => {
      return await createProcedure(procedure);
    });
    return result;
  } catch (error) {
    const start = Date.now();
    const result = await localStore.createProcedureLocal(procedure);
    recordFallback(Date.now() - start);
    enqueueSyncOperation({ type: 'create', data: result });
    return result;
  }
}

export async function safeUpdateProcedure(code: string, procedure: Parameters<typeof updateProcedure>[1]) {
  if (!isDatabaseAvailable() || !canUseFallback()) {
    const start = Date.now();
    const result = await localStore.updateProcedureLocal(code, procedure);
    recordFallback(Date.now() - start);
    enqueueSyncOperation({ type: 'update', code, data: result });
    return result;
  }

  try {
    const { result } = await executeWithDatabaseTimed(async (prisma) => {
      return await updateProcedure(code, procedure);
    });
    return result;
  } catch (error) {
    const start = Date.now();
    const result = await localStore.updateProcedureLocal(code, procedure);
    recordFallback(Date.now() - start);
    enqueueSyncOperation({ type: 'update', code, data: result });
    return result;
  }
}

export async function safeUpsertProcedure(procedure: Parameters<typeof upsertProcedure>[0]) {
  const code = procedure.metadata.code;

  if (!isDatabaseAvailable() || !canUseFallback()) {
    const start = Date.now();
    const result = await localStore.createProcedureLocal(procedure);
    recordFallback(Date.now() - start);
    enqueueSyncOperation({ type: 'update', code, data: result });
    return result;
  }

  try {
    const { result } = await executeWithDatabaseTimed(async (prisma) => {
      return await upsertProcedure(procedure);
    });
    return result;
  } catch (error) {
    const start = Date.now();
    const result = await localStore.createProcedureLocal(procedure);
    recordFallback(Date.now() - start);
    enqueueSyncOperation({ type: 'update', code, data: result });
    return result;
  }
}

export async function safeSaveProcedureVersion(code: string, procedure: any): Promise<VersionedProcedure | null> {
  if (!isDatabaseAvailable() || !canUseFallback()) {
    const start = Date.now();
    const result = await localStore.createProcedureLocal(procedure);
    recordFallback(Date.now() - start);
    enqueueSyncOperation({ type: 'update', code, data: result });
    return null;
  }

  try {
    const result = await procedureVersionService.saveWithVersion(code, procedure);
    return result;
  } catch (error) {
    console.warn('[Procedures] Failed to save version, using local storage:', error);
    const start = Date.now();
    const result = await localStore.createProcedureLocal(procedure);
    recordFallback(Date.now() - start);
    enqueueSyncOperation({ type: 'update', code, data: result });
    return null;
  }
}

export async function safeGetProcedureVersion(code: string, version: number): Promise<any | null> {
  if (!isDatabaseAvailable() || !canUseFallback()) {
    const start = Date.now();
    const result = await localStore.getProcedureByCodeLocal(code);
    recordFallback(Date.now() - start);
    return result;
  }

  try {
    const result = await procedureVersionService.getVersion(code, version);
    return result;
  } catch {
    const start = Date.now();
    const result = await localStore.getProcedureByCodeLocal(code);
    recordFallback(Date.now() - start);
    return result;
  }
}

export async function safeGetProcedureLatest(code: string): Promise<any | null> {
  if (!isDatabaseAvailable() || !canUseFallback()) {
    const start = Date.now();
    const result = await localStore.getProcedureByCodeLocal(code);
    recordFallback(Date.now() - start);
    return result;
  }

  try {
    const result = await procedureVersionService.getLatest(code);
    return result;
  } catch {
    const start = Date.now();
    const result = await localStore.getProcedureByCodeLocal(code);
    recordFallback(Date.now() - start);
    return result;
  }
}

export async function safeListProcedureVersions(code: string): Promise<VersionedProcedure[]> {
  if (!isDatabaseAvailable() || !canUseFallback()) {
    const start = Date.now();
    const result = await localStore.getProcedureByCodeLocal(code);
    recordFallback(Date.now() - start);
    return [];
  }

  try {
    const result = await procedureVersionService.listVersions(code);
    return result;
  } catch {
    return [];
  }
}

export async function safeDeleteProcedure(
  code: string,
  actorUserId?: string
): Promise<ArchiveOrDeleteResult | null> {
  if (!isDatabaseAvailable() || !canUseFallback()) {
    // Fallback local : soft delete uniquement (pas de hard delete offline)
    const start = Date.now();
    const result = await localStore.archiveProcedureLocal(code);
    recordFallback(Date.now() - start);
    if (result) {
      enqueueSyncOperation({ type: 'archive', code });
    }
    return result ? { archived: true, executionCount: 0 } : null;
  }

  try {
    const { result } = await executeWithDatabaseTimed(async () => {
      return await archiveOrDeleteProcedure(code, actorUserId);
    });
    return result;
  } catch (error) {
    // Ne PAS basculer en fallback sur erreur FK (reglementaire, pas reseau)
    logger.error('safeDeleteProcedure failed', { code, error });
    throw error;
  }
}

export function getProceduresDatabaseHealth() {
  return getDatabaseHealth();
}

export async function replaySyncQueue() {
  if (!isDatabaseAvailable()) {
    return;
  }

  await drainSyncQueue(async (operations) => {
    for (const op of operations) {
      try {
        if (op.type === 'create' || op.type === 'update') {
          if (op.data && op.data.metadata && op.data.metadata.code) {
            await procedureVersionService.saveWithVersion(op.data.metadata.code, op.data);
          } else {
            await upsertProcedure(op.data);
          }
        } else if (op.type === 'delete' && op.code) {
          // Hard delete : uniquement pour procedures sans execution
          await deleteProcedure(op.code);
        } else if (op.type === 'archive' && op.code) {
          // Soft delete : replay de l'archivage differe hors-ligne
          await archiveOrDeleteProcedure(op.code);
        }
      } catch (error) {
        console.error('[SyncQueue] Failed to replay operation:', op, error);
      }
    }
  });
}
