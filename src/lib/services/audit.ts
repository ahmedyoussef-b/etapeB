import { getPrismaClient } from '@/lib/services/db';
import logger from '@/lib/logger';

export const AuditAction = {
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGOUT: 'LOGOUT',
  ADMIN_RESET: 'ADMIN_RESET',
  ADMIN_PURGE: 'ADMIN_PURGE',
  ADMIN_SYNC: 'ADMIN_SYNC',
  PROCEDURE_ARCHIVED: 'PROCEDURE_ARCHIVED',
  PROCEDURE_DELETED: 'PROCEDURE_DELETED',
  TAURI_TOKEN_FAILED: 'TAURI_TOKEN_FAILED',
} as const;

export type AuditAction = typeof AuditAction[keyof typeof AuditAction];

export interface AuditLogInput {
  action: string;
  entity: string;
  entityId: string;
  userId?: string | null;
  before?: unknown;
  after?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export const auditService = {
  async log(input: AuditLogInput): Promise<void> {
    try {
      const prisma = getPrismaClient();
      await prisma.auditLog.create({
        data: {
          action: input.action,
          entity: input.entity,
          entityId: input.entityId,
          userId: input.userId ?? null,
          before: input.before === undefined ? undefined : (input.before as any),
          after: input.after === undefined ? undefined : (input.after as any),
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
        },
      });
    } catch (error) {
      logger.warn('auditService.log failed (fail-safe)', {
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
};