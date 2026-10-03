import { executeWithDatabase, getPrismaClient } from './db';
import { Prisma, Role } from '@prisma/client';
import { TProcedure } from '@/lib/procedures/services/validator.service';
import logger from '@/lib/logger';
import { auditService } from './audit';

function toPrismaProcedure(procedure: TProcedure, id?: string) {
  const metadata = procedure.metadata;
  return {
    id: id || `proc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    code: metadata.code,
    title: metadata.title,
    description: metadata.description || null,
    category: metadata.category,
    priority: metadata.priority,
    status: 'draft' as const,
    estimatedTimeMinutes: metadata.estimatedTimeMinutes,
    requiredRoles: metadata.requiredRoles as Role[],
    steps: procedure.steps as Prisma.InputJsonValue,
    metadata: {
      globalSafetyInstructions: metadata.globalSafetyInstructions,
    } as Prisma.InputJsonValue,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function fromPrismaProcedure(row: {
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
}): TProcedure {
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

export async function getAllProcedures(): Promise<TProcedure[]> {
  const startTime = Date.now();
  return executeWithDatabase(async (prisma) => {
    const rows = await prisma.procedure.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, code: true, title: true, description: true, category: true, priority: true, status: true, estimatedTimeMinutes: true, requiredRoles: true, steps: true, metadata: true, createdAt: true, updatedAt: true },
    });
    const duration = Date.now() - startTime;
    logger.debug('Fetched procedures', { count: rows.length, duration });
    return rows.map(fromPrismaProcedure);
  });
}

export async function getProcedureByCode(code: string): Promise<TProcedure | undefined> {
  return executeWithDatabase(async (prisma) => {
    const row = await prisma.procedure.findUnique({
      where: { code },
      select: { id: true, code: true, title: true, description: true, category: true, priority: true, status: true, estimatedTimeMinutes: true, requiredRoles: true, steps: true, metadata: true, createdAt: true, updatedAt: true },
    });
    return row ? fromPrismaProcedure(row) : undefined;
  });
}

export async function createProcedure(
  procedure: TProcedure,
  actorUserId?: string
): Promise<TProcedure> {
  return executeWithDatabase(async (prisma) => {
    const data = toPrismaProcedure(procedure);
    const row = await prisma.procedure.create({
      data,
      select: { id: true, code: true, title: true, description: true, category: true, priority: true, status: true, estimatedTimeMinutes: true, requiredRoles: true, steps: true, metadata: true, createdAt: true, updatedAt: true },
    });
    logger.info('Procedure created', { code: row.code, title: row.title });
    await auditService.log({
      action: 'PROCEDURE_CREATED',
      entity: 'Procedure',
      entityId: row.id,
      userId: actorUserId ?? null,
      before: undefined,
      after: { code: row.code, title: row.title } as Prisma.InputJsonValue,
    });
    return fromPrismaProcedure(row);
  });
}

export async function upsertProcedure(
  procedure: TProcedure,
  actorUserId?: string
): Promise<TProcedure> {
  return executeWithDatabase(async (prisma) => {
    const existing = await prisma.procedure.findUnique({ where: { code: procedure.metadata.code } });
    const data = toPrismaProcedure(procedure, existing?.id);

    const row = await prisma.procedure.upsert({
      where: { code: procedure.metadata.code },
      create: data,
      update: data,
      select: { id: true, code: true, title: true, description: true, category: true, priority: true, status: true, estimatedTimeMinutes: true, requiredRoles: true, steps: true, metadata: true, createdAt: true, updatedAt: true },
    });
    logger.info('Procedure upserted', { code: row.code, title: row.title });
    await auditService.log({
      action: existing ? 'PROCEDURE_UPDATED' : 'PROCEDURE_CREATED',
      entity: 'Procedure',
      entityId: row.id,
      userId: actorUserId ?? null,
      before: existing ? { code: existing.code, title: existing.title } : undefined,
      after: { code: row.code, title: row.title } as Prisma.InputJsonValue,
    });
    return fromPrismaProcedure(row);
  });
}

export async function updateProcedure(
  code: string,
  procedure: TProcedure,
  actorUserId?: string
): Promise<TProcedure | undefined> {
  return executeWithDatabase(async (prisma) => {
    const existing = await prisma.procedure.findUnique({ where: { code } });
    if (!existing) return undefined;

    const data = toPrismaProcedure(procedure, existing.id);
    const row = await prisma.procedure.update({
      where: { code },
      data,
      select: { id: true, code: true, title: true, description: true, category: true, priority: true, status: true, estimatedTimeMinutes: true, requiredRoles: true, steps: true, metadata: true, createdAt: true, updatedAt: true },
    });
    logger.info('Procedure updated', { code, title: row.title });
    await auditService.log({
      action: 'PROCEDURE_UPDATED',
      entity: 'Procedure',
      entityId: row.id,
      userId: actorUserId ?? null,
      before: { code: existing.code, title: existing.title },
      after: { code: row.code, title: row.title } as Prisma.InputJsonValue,
    });
    return fromPrismaProcedure(row);
  });
}

export type ArchiveOrDeleteResult =
  | { archived: true; executionCount: number }
  | { deleted: true };

// Conserve pour compatibilite avec replaySyncQueue (replay d'operations locales,
// contexte sans executions en base). Le findUnique prealable permet de capturer
// l'etat avant suppression pour l'audit (fallback sur code si entite absente).
export async function deleteProcedure(
  code: string,
  actorUserId?: string
): Promise<boolean> {
  return executeWithDatabase(async (prisma) => {
    const existing = await prisma.procedure.findUnique({
      where: { code },
      select: { id: true, code: true, title: true },
    });
    await prisma.procedure.delete({ where: { code } });
    logger.info('Procedure deleted', { code });
    await auditService.log({
      action: 'PROCEDURE_DELETED',
      entity: 'Procedure',
      entityId: existing?.id ?? code,
      userId: actorUserId ?? null,
      before: existing ? { code: existing.code, title: existing.title } : undefined,
      after: Prisma.JsonNull,
    });
    return true;
  });
}

// Soft delete si executions existantes, hard delete sinon.
// Protection reglementaire des preuves d'execution (Scenario A).
export async function archiveOrDeleteProcedure(
  code: string,
  actorUserId?: string
): Promise<ArchiveOrDeleteResult | null> {
  return executeWithDatabase(async (prisma) => {
    const procedure = await prisma.procedure.findUnique({
      where: { code },
      select: { id: true, code: true, title: true, status: true },
    });
    if (!procedure) return null;

    const executionCount = await prisma.procedureExecution.count({
      where: { procedureId: procedure.id },
    });

    if (executionCount > 0) {
      // Soft delete : archivage logique
      await prisma.procedure.update({
        where: { code },
        data: { status: 'archived' },
      });
      await auditService.log({
        action: 'PROCEDURE_ARCHIVED',
        entity: 'Procedure',
        entityId: procedure.id,
        userId: actorUserId ?? null,
        before: { status: procedure.status } as Prisma.InputJsonValue,
        after: { status: 'archived' } as Prisma.InputJsonValue,
      });
      logger.info('Procedure archived (has executions)', { code, executionCount });
      return { archived: true, executionCount };
    }

    // Hard delete : aucune execution
    await prisma.procedure.delete({ where: { code } });
    await auditService.log({
      action: 'PROCEDURE_DELETED',
      entity: 'Procedure',
      entityId: procedure.id,
      userId: actorUserId ?? null,
      before: { code: procedure.code, title: procedure.title } as Prisma.InputJsonValue,
      after: Prisma.JsonNull,
    });
    logger.info('Procedure deleted (no executions)', { code });
    return { deleted: true };
  });
}
