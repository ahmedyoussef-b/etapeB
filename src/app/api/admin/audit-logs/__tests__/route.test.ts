import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockCount = vi.fn();
const mockFindMany = vi.fn();

vi.mock('@/lib/services/db', () => ({
  getPrismaClient: () => ({
    auditLog: { count: mockCount, findMany: mockFindMany },
  }),
}));

vi.mock('@/lib/api/auth-guard', () => ({
  withAuth: (handler: any) =>
    async (req: NextRequest) => {
      const fakeUser = { id: 'admin-1', email: 'admin@test', role: 'admin' };
      return handler(req, { user: fakeUser });
    },
}));

describe('GET /api/admin/audit-logs', () => {
  beforeEach(() => {
    mockCount.mockReset();
    mockFindMany.mockReset();
  });

  it('retourne les logs avec pagination par defaut', async () => {
    mockCount.mockResolvedValueOnce(3);
    mockFindMany.mockResolvedValueOnce([
      { id: 'log-3', action: 'LOGIN_SUCCESS', entity: 'user', entityId: 'u1', createdAt: new Date() },
      { id: 'log-2', action: 'ADMIN_RESET', entity: 'system', entityId: 'global', createdAt: new Date() },
      { id: 'log-1', action: 'LOGOUT', entity: 'user', entityId: 'session', createdAt: new Date() },
    ]);
    const { GET } = await import('@/app/api/admin/audit-logs/route');
    const req = new NextRequest('http://localhost/api/admin/audit-logs');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.logs).toHaveLength(3);
    expect(body.pagination.total).toBe(3);
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.limit).toBe(50);
    expect(body.pagination.totalPages).toBe(1);
    expect(body.pagination.hasNext).toBe(false);
    expect(body.pagination.hasPrev).toBe(false);
  });

  it('applique les filtres action et entity', async () => {
    mockCount.mockResolvedValueOnce(1);
    mockFindMany.mockResolvedValueOnce([]);
    const { GET } = await import('@/app/api/admin/audit-logs/route');
    const req = new NextRequest('http://localhost/api/admin/audit-logs?action=LOGIN_SUCCESS&entity=user');
    await GET(req);
    const whereArg = mockCount.mock.calls[0][0].where;
    expect(whereArg.action).toBe('LOGIN_SUCCESS');
    expect(whereArg.entity).toBe('user');
  });

  it('applique le filtre de plage de dates', async () => {
    mockCount.mockResolvedValueOnce(0);
    mockFindMany.mockResolvedValueOnce([]);
    const { GET } = await import('@/app/api/admin/audit-logs/route');
    const req = new NextRequest('http://localhost/api/admin/audit-logs?from=2026-10-01T00:00:00Z&to=2026-10-31T23:59:59Z');
    await GET(req);
    const whereArg = mockCount.mock.calls[0][0].where;
    expect(whereArg.createdAt.gte).toBeInstanceOf(Date);
    expect(whereArg.createdAt.lte).toBeInstanceOf(Date);
  });

  it('clampe limit a MAX_LIMIT (200)', async () => {
    mockCount.mockResolvedValueOnce(0);
    mockFindMany.mockResolvedValueOnce([]);
    const { GET } = await import('@/app/api/admin/audit-logs/route');
    const req = new NextRequest('http://localhost/api/admin/audit-logs?limit=99999');
    const res = await GET(req);
    const body = await res.json();
    expect(body.pagination.limit).toBe(200);
  });

  it('calcule hasNext et hasPrev correctement', async () => {
    mockCount.mockResolvedValueOnce(250);
    mockFindMany.mockResolvedValueOnce([]);
    const { GET } = await import('@/app/api/admin/audit-logs/route');
    const req = new NextRequest('http://localhost/api/admin/audit-logs?page=3&limit=100');
    const res = await GET(req);
    const body = await res.json();
    expect(body.pagination.total).toBe(250);
    expect(body.pagination.page).toBe(3);
    expect(body.pagination.limit).toBe(100);
    expect(body.pagination.totalPages).toBe(3);
    expect(body.pagination.hasNext).toBe(false);
    expect(body.pagination.hasPrev).toBe(true);
  });
});