import { Prisma, Role } from '@prisma/client';
import { getPrismaClient, isDatabaseAvailable, getDatabaseHealth } from './db';
import { canUseFallback, recordFallback, enqueueSyncOperation, drainSyncQueue, executeWithDatabaseTimed, getFallbackThrottleStatus, getDatabaseMetrics } from '@/lib/database/connection-manager';
import {
  ProcedureSchema,
  type TProcedure,
} from '@/lib/procedures/services/validator.service';
import * as localStore from '@/lib/procedures/server-store';

export interface ListGuideProceduresOptions {
  page?: number;
  pageSize?: number;
}

export interface PaginatedGuideProcedures {
  data: TProcedure[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const PROCEDURE_SELECT = {
  id: true,
  code: true,
  title: true,
  description: true,
  category: true,
  priority: true,
  status: true,
  estimatedTimeMinutes: true,
  requiredRoles: true,
  steps: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} as const;

type ProcedureRow = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  estimatedTimeMinutes: number;
  requiredRoles: unknown;
  steps: unknown;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
};

function fromPrismaProcedure(row: ProcedureRow): TProcedure {
  const metadata = (row.metadata as Record<string, unknown> | null) || {};
  return {
    metadata: {
      title: row.title,
      code: row.code,
      description: row.description || '',
      category: row.category,
      priority: row.priority as TProcedure['metadata']['priority'],
      estimatedTimeMinutes: row.estimatedTimeMinutes,
      requiredRoles: (row.requiredRoles as string[]) || [],
      globalSafetyInstructions: (metadata.globalSafetyInstructions as string[]) || [],
    },
    steps: (row.steps as TProcedure['steps']) || [],
  };
}

function toPrismaProcedure(procedure: TProcedure, id?: string) {
  return {
    id: id || `proc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    code: procedure.metadata.code,
    title: procedure.metadata.title,
    description: procedure.metadata.description || null,
    category: procedure.metadata.category,
    priority: procedure.metadata.priority,
    status: 'draft' as const,
    estimatedTimeMinutes: procedure.metadata.estimatedTimeMinutes,
    requiredRoles: procedure.metadata.requiredRoles as Role[],
    steps: procedure.steps as Prisma.InputJsonValue,
    metadata: {
      globalSafetyInstructions: procedure.metadata.globalSafetyInstructions,
    } as Prisma.InputJsonValue,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export async function getGuideProcedure(id: string): Promise<TProcedure | undefined> {
  if (!isDatabaseAvailable() || !canUseFallback()) {
    const start = Date.now();
    const items = await localStore.getAllProceduresLocal();
    const result = items.find((p: any) => p.metadata?.code === id);
    recordFallback(Date.now() - start);
    return result;
  }

  try {
    const { result } = await executeWithDatabaseTimed(async (prisma) => {
      const row = await prisma.procedure.findUnique({
        where: { id },
        select: PROCEDURE_SELECT,
      });
      if (row) return fromPrismaProcedure(row);

      const byCode = await prisma.procedure.findUnique({
        where: { code: id },
        select: PROCEDURE_SELECT,
      });
      if (byCode) return fromPrismaProcedure(byCode);

      return undefined;
    });
    return result;
  } catch (error) {
    const start = Date.now();
    const items = await localStore.getAllProceduresLocal();
    const result = items.find((p: any) => p.metadata?.code === id);
    recordFallback(Date.now() - start);
    return result;
  }
}

export async function listGuideProcedures(
  options: ListGuideProceduresOptions = {},
): Promise<PaginatedGuideProcedures> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.max(1, Math.min(100, options.pageSize ?? 20));

  if (!isDatabaseAvailable() || !canUseFallback()) {
    const start = Date.now();
    const items = await localStore.getAllProceduresLocal();
    const sliceStart = (page - 1) * pageSize;
    const data = items.slice(sliceStart, sliceStart + pageSize);
    recordFallback(Date.now() - start);
    return {
      data: data as TProcedure[],
      total: items.length,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(items.length / pageSize)),
    };
  }

  try {
    const { result } = await executeWithDatabaseTimed(async (prisma) => {
      const [rows, total] = await Promise.all([
        prisma.procedure.findMany({
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: PROCEDURE_SELECT,
        }),
        prisma.procedure.count(),
      ]);
      return {
        data: rows.map(fromPrismaProcedure),
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      } as PaginatedGuideProcedures;
    });
    return result;
  } catch (error) {
    const start = Date.now();
    const items = await localStore.getAllProceduresLocal();
    const sliceStart = (page - 1) * pageSize;
    const data = items.slice(sliceStart, sliceStart + pageSize);
    recordFallback(Date.now() - start);
    return {
      data: data as TProcedure[],
      total: items.length,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(items.length / pageSize)),
    };
  }
}

export async function createGuideProcedure(data: unknown): Promise<TProcedure> {
  const procedure = ProcedureSchema.parse(data);

  if (!isDatabaseAvailable() || !canUseFallback()) {
    const start = Date.now();
    const created: TProcedure = procedure;
    await localStore.createProcedureLocal(created);
    recordFallback(Date.now() - start);
    enqueueSyncOperation({ type: 'create', data: created });
    return created;
  }

  try {
    const { result } = await executeWithDatabaseTimed(async (prisma) => {
      const row = await prisma.procedure.create({
        data: toPrismaProcedure(procedure),
        select: PROCEDURE_SELECT,
      });
      return fromPrismaProcedure(row);
    });
    return result;
  } catch (error) {
    const start = Date.now();
    const created: TProcedure = procedure;
    await localStore.createProcedureLocal(created);
    recordFallback(Date.now() - start);
    enqueueSyncOperation({ type: 'create', data: created });
    return created;
  }
}

export async function upsertGuideProcedure(data: unknown): Promise<TProcedure> {
  const procedure = ProcedureSchema.parse(data);

  if (!isDatabaseAvailable() || !canUseFallback()) {
    const start = Date.now();
    const created: TProcedure = procedure;
    await localStore.createProcedureLocal(created);
    recordFallback(Date.now() - start);
    enqueueSyncOperation({ type: 'update', code: procedure.metadata.code, data: created });
    return created;
  }

  try {
    const { result } = await executeWithDatabaseTimed(async (prisma) => {
      const existing = await prisma.procedure.findUnique({
        where: { code: procedure.metadata.code },
        select: { id: true },
      });

      const data = existing
        ? toPrismaProcedure(procedure, existing.id)
        : toPrismaProcedure(procedure);

      const row = await prisma.procedure.upsert({
        where: { code: procedure.metadata.code },
        create: data,
        update: data,
        select: PROCEDURE_SELECT,
      });
      return fromPrismaProcedure(row);
    });
    return result;
  } catch (error) {
    const start = Date.now();
    const created: TProcedure = procedure;
    await localStore.createProcedureLocal(created);
    recordFallback(Date.now() - start);
    enqueueSyncOperation({ type: 'update', code: procedure.metadata.code, data: created });
    return created;
  }
}

export async function replaySyncQueue() {
  if (!isDatabaseAvailable()) {
    return;
  }

  await drainSyncQueue(async (operations) => {
    for (const op of operations) {
      try {
        if (op.type === 'create' || op.type === 'update') {
          await upsertGuideProcedure(op.data);
        } else if (op.type === 'delete' && op.code) {
          // Delete handled by safeDeleteProcedure in procedures.fallback
        }
      } catch (error) {
        console.error('[SyncQueue] Failed to replay operation:', op, error);
      }
    }
  });
}

export function getGuideProceduresDatabaseHealth() {
  return getDatabaseHealth();
}

export function getGuideProceduresFallbackStatus() {
  return getFallbackThrottleStatus();
}

export function getGuideProceduresMetrics() {
  return getDatabaseMetrics();
}
