import {
  saveProcedureMedia as saveToPrisma,
  getProcedureMedia as getFromPrisma,
  getProcedureMediaByStep as getByStepFromPrisma,
  deleteProcedureMedia as deleteFromPrisma,
  deleteProcedureMediaByStep as deleteByStepFromPrisma,
  deleteProcedureMediaById as deleteByIdFromPrisma,
  getProcedureMediaCount as getCountFromPrisma,
  ProcedureMediaItem,
} from './procedure-media.service';
import * as localStore from '@/lib/procedures/media/server-store';
import {
  isDatabaseAvailable,
  canUseFallback,
  recordFallback,
  enqueueSyncOperation,
} from '@/lib/database/connection-manager';

export async function safeSaveProcedureMedia(
  procedureCode: string,
  stepId: string,
  stepOrder: number,
  media: Parameters<typeof saveToPrisma>[3]
): Promise<ProcedureMediaItem | null> {
  if (!isDatabaseAvailable() || !canUseFallback()) {
    const start = Date.now();
    const result = await localStore.saveMediaLocal(procedureCode, stepId, stepOrder, media);
    recordFallback(Date.now() - start);
    enqueueSyncOperation({
      type: 'create',
      data: { procedureCode, stepId, stepOrder, media },
    });
    return result as unknown as ProcedureMediaItem;
  }

  try {
    return await saveToPrisma(procedureCode, stepId, stepOrder, media);
  } catch (error) {
    console.warn('[ProcedureMedia] Prisma unavailable, falling back to local storage:', error);
    const start = Date.now();
    const result = await localStore.saveMediaLocal(procedureCode, stepId, stepOrder, media);
    recordFallback(Date.now() - start);
    enqueueSyncOperation({
      type: 'create',
      data: { procedureCode, stepId, stepOrder, media },
    });
    return result as unknown as ProcedureMediaItem;
  }
}

export async function safeGetProcedureMedia(procedureCode: string): Promise<ProcedureMediaItem[]> {
  if (!isDatabaseAvailable() || !canUseFallback()) {
    const start = Date.now();
    const result = await localStore.getMediaLocal(procedureCode);
    recordFallback(Date.now() - start);
    return result as unknown as ProcedureMediaItem[];
  }

  try {
    return await getFromPrisma(procedureCode);
  } catch (error) {
    console.warn('[ProcedureMedia] Prisma unavailable, falling back to local storage:', error);
    const start = Date.now();
    const result = await localStore.getMediaLocal(procedureCode);
    recordFallback(Date.now() - start);
    return result as unknown as ProcedureMediaItem[];
  }
}

export async function safeGetProcedureMediaByStep(
  procedureCode: string,
  stepId: string
): Promise<ProcedureMediaItem[]> {
  if (!isDatabaseAvailable() || !canUseFallback()) {
    const start = Date.now();
    const result = await localStore.getMediaByStepLocal(procedureCode, stepId);
    recordFallback(Date.now() - start);
    return result as unknown as ProcedureMediaItem[];
  }

  try {
    return await getByStepFromPrisma(procedureCode, stepId);
  } catch (error) {
    console.warn('[ProcedureMedia] Prisma unavailable, falling back to local storage:', error);
    const start = Date.now();
    const result = await localStore.getMediaByStepLocal(procedureCode, stepId);
    recordFallback(Date.now() - start);
    return result as unknown as ProcedureMediaItem[];
  }
}

export async function safeDeleteProcedureMedia(procedureCode: string): Promise<number> {
  if (!isDatabaseAvailable() || !canUseFallback()) {
    const start = Date.now();
    const result = await localStore.deleteMediaLocal(procedureCode);
    recordFallback(Date.now() - start);
    enqueueSyncOperation({ type: 'delete', code: procedureCode });
    return result;
  }

  try {
    return await deleteFromPrisma(procedureCode);
  } catch (error) {
    console.warn('[ProcedureMedia] Prisma unavailable, falling back to local storage:', error);
    const start = Date.now();
    const result = await localStore.deleteMediaLocal(procedureCode);
    recordFallback(Date.now() - start);
    enqueueSyncOperation({ type: 'delete', code: procedureCode });
    return result;
  }
}

export async function safeDeleteProcedureMediaByStep(
  procedureCode: string,
  stepId: string
): Promise<number> {
  if (!isDatabaseAvailable() || !canUseFallback()) {
    const start = Date.now();
    const result = await localStore.deleteMediaByStepLocal(procedureCode, stepId);
    recordFallback(Date.now() - start);
    enqueueSyncOperation({ type: 'delete', code: `${procedureCode}/${stepId}` });
    return result;
  }

  try {
    return await deleteByStepFromPrisma(procedureCode, stepId);
  } catch (error) {
    console.warn('[ProcedureMedia] Prisma unavailable, falling back to local storage:', error);
    const start = Date.now();
    const result = await localStore.deleteMediaByStepLocal(procedureCode, stepId);
    recordFallback(Date.now() - start);
    enqueueSyncOperation({ type: 'delete', code: `${procedureCode}/${stepId}` });
    return result;
  }
}

export async function safeDeleteProcedureMediaById(id: string): Promise<boolean> {
  if (!isDatabaseAvailable() || !canUseFallback()) {
    const start = Date.now();
    const result = await localStore.deleteMediaByIdLocal(id);
    recordFallback(Date.now() - start);
    enqueueSyncOperation({ type: 'delete', code: id });
    return result;
  }

  try {
    return await deleteByIdFromPrisma(id);
  } catch (error) {
    console.warn('[ProcedureMedia] Prisma unavailable, falling back to local storage:', error);
    const start = Date.now();
    const result = await localStore.deleteMediaByIdLocal(id);
    recordFallback(Date.now() - start);
    enqueueSyncOperation({ type: 'delete', code: id });
    return result;
  }
}

export async function safeGetProcedureMediaCount(procedureCode: string): Promise<number> {
  if (!isDatabaseAvailable() || !canUseFallback()) {
    const start = Date.now();
    const result = await localStore.getMediaCountLocal(procedureCode);
    recordFallback(Date.now() - start);
    return result;
  }

  try {
    return await getCountFromPrisma(procedureCode);
  } catch (error) {
    console.warn('[ProcedureMedia] Prisma unavailable, falling back to local storage:', error);
    const start = Date.now();
    const result = await localStore.getMediaCountLocal(procedureCode);
    recordFallback(Date.now() - start);
    return result;
  }
}

export async function replayMediaSyncQueue(operations: any[]): Promise<void> {
  for (const op of operations) {
    try {
      if (op.type === 'create' && op.data?.procedureCode) {
        await saveToPrisma(
          op.data.procedureCode,
          op.data.stepId,
          op.data.stepOrder,
          op.data.media
        );
      } else if (op.type === 'delete') {
        if (op.code?.includes('/')) {
          const [procedureCode, stepId] = op.code.split('/');
          await deleteByStepFromPrisma(procedureCode, stepId);
        } else if (op.code) {
          await deleteFromPrisma(op.code);
        }
      }
    } catch (error) {
      console.error('[MediaSyncQueue] Failed to replay operation:', op, error);
    }
  }
}