import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.fn();

vi.mock('@/lib/services/db', () => ({
  getPrismaClient: () => ({
    auditLog: { create: mockCreate },
  }),
}));

vi.mock('@/lib/logger', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

describe('auditService.log', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('insere un log avec tous les champs', async () => {
    mockCreate.mockResolvedValueOnce({});
    const { auditService } = await import('@/lib/services/audit');
    await auditService.log({
      action: 'LOGIN_SUCCESS',
      entity: 'user',
      entityId: 'user-1',
      userId: 'user-1',
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
    });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const call = mockCreate.mock.calls[0][0];
    expect(call.data.action).toBe('LOGIN_SUCCESS');
    expect(call.data.entity).toBe('user');
    expect(call.data.entityId).toBe('user-1');
    expect(call.data.userId).toBe('user-1');
    expect(call.data.ipAddress).toBe('127.0.0.1');
    expect(call.data.userAgent).toBe('vitest');
  });

  it('insere un log minimal (champs optionnels absents)', async () => {
    mockCreate.mockResolvedValueOnce({});
    const { auditService } = await import('@/lib/services/audit');
    await auditService.log({
      action: 'ADMIN_RESET',
      entity: 'system',
      entityId: 'global',
    });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const call = mockCreate.mock.calls[0][0];
    expect(call.data.action).toBe('ADMIN_RESET');
    expect(call.data.userId).toBeNull();
    expect(call.data.ipAddress).toBeNull();
    expect(call.data.userAgent).toBeNull();
  });

  it('fail-safe : avale les erreurs Prisma et ne propage pas', async () => {
    mockCreate.mockRejectedValueOnce(new Error('DB down'));
    const { auditService } = await import('@/lib/services/audit');
    await expect(
      auditService.log({ action: 'LOGIN_FAILED', entity: 'user', entityId: 'unknown' })
    ).resolves.toBeUndefined();
  });

  it('fail-safe : log un warning en cas d erreur', async () => {
    mockCreate.mockRejectedValueOnce(new Error('DB down'));
    const loggerModule = await import('@/lib/logger');
    const warnSpy = loggerModule.default.warn as unknown as ReturnType<typeof vi.fn>;
    warnSpy.mockReset();
    const { auditService } = await import('@/lib/services/audit');
    await auditService.log({ action: 'LOGIN_FAILED', entity: 'user', entityId: 'unknown' });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const firstCall = warnSpy.mock.calls[0];
    expect(String(firstCall[0])).toContain('auditService.log failed');
  });

  it('AuditAction expose les constantes attendues', async () => {
    const { AuditAction } = await import('@/lib/services/audit');
    expect(AuditAction.LOGIN_SUCCESS).toBe('LOGIN_SUCCESS');
    expect(AuditAction.ADMIN_RESET).toBe('ADMIN_RESET');
    expect(AuditAction.TAURI_TOKEN_FAILED).toBe('TAURI_TOKEN_FAILED');
  });
});