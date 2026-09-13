import { describe, expect, it, beforeEach, vi } from 'vitest';
import { createNextRequest } from '../../__tests__/next-request-helper';

const mockReadJSON = vi.fn();
vi.mock('@/lib/database/local-adapter', () => ({
  LocalDatabaseAdapter: class {
    readJSON = mockReadJSON;
  }
}));

const mockGetAuthenticatedUser = vi.fn();
const mockHasPermission = vi.fn().mockReturnValue(true);
vi.mock('@/lib/api/auth-guard', () => ({
  getAuthenticatedUser: mockGetAuthenticatedUser,
  hasPermission: mockHasPermission,
  unauthorizedResponse: () => new Response('Non autorisé', { status: 403 }),
  unauthenticatedResponse: () => new Response('Non authentifié', { status: 401 }),
}));

describe('API /api/notifications', () => {
  beforeEach(() => {
    mockReadJSON.mockReset();
    mockGetAuthenticatedUser.mockReset();
    mockHasPermission.mockReset();
    mockHasPermission.mockReturnValue(true);
    mockGetAuthenticatedUser.mockResolvedValue({
      id: 'test-user',
      email: 'test@example.com',
      name: 'Test User',
      role: 'admin',
    });
  });

  it('retourne une alerte erreur quand la dernière sync a des échecs', async () => {
    mockReadJSON.mockImplementation(async (path: string) => {
      if (path === 'system/sync-log.json') return {
        syncs: [{ id: 't1', timestamp: new Date().toISOString(), success: true, failed: 3, imported: {}, updated: {}, errors: [] }]
      };
      if (path === 'system/sync-files-log.json') return { fileSyncs: [] };
      return null;
    });

    const { GET } = await import('@/app/api/notifications/route');
    const res = await GET(createNextRequest('http://localhost'));
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.alerts.length).toBe(1);
    expect(data.alerts[0].severity).toBe('error');
    expect(data.alerts[0].title).toContain('3');
  });

  it('retourne une alerte warning quand la dernière sync fichiers a des erreurs', async () => {
    mockReadJSON.mockImplementation(async (path: string) => {
      if (path === 'system/sync-log.json') return { syncs: [] };
      if (path === 'system/sync-files-log.json') return {
        fileSyncs: [{ id: 't2', timestamp: new Date().toISOString(), copied: 2, deduplicated: 1, errors: 5, total: 8 }]
      };
      return null;
    });

    const { GET } = await import('@/app/api/notifications/route');
    const res = await GET(createNextRequest('http://localhost'));
    const data = await res.json();

    expect(data.alerts.length).toBe(1);
    expect(data.alerts[0].severity).toBe('warning');
  });

  it('pas d\'alerte si tout est OK', async () => {
    mockReadJSON.mockImplementation(async () => ({ syncs: [{ id: 't3', timestamp: new Date().toISOString(), success: true, failed: 0, imported: {}, updated: {}, errors: [] }], fileSyncs: [] }));

    const { GET } = await import('@/app/api/notifications/route');
    const res = await GET(createNextRequest('http://localhost'));
    const data = await res.json();

    expect(data.alerts.length).toBe(0);
  });

  it('combine alertes data (erreur) + files (warning)', async () => {
    mockReadJSON.mockImplementation(async (path: string) => {
      if (path === 'system/sync-log.json') return {
        syncs: [{ id: 't4', timestamp: new Date().toISOString(), success: false, failed: 1, imported: {}, updated: {}, errors: [] }]
      };
      if (path === 'system/sync-files-log.json') return {
        fileSyncs: [{ id: 't5', timestamp: new Date().toISOString(), copied: 0, deduplicated: 0, errors: 2, total: 2 }]
      };
      return null;
    });

    const { GET } = await import('@/app/api/notifications/route');
    const res = await GET(createNextRequest('http://localhost'));
    const data = await res.json();

    expect(data.alerts.length).toBe(2);
    expect(data.alerts.some((a: any) => a.severity === 'error')).toBe(true);
    expect(data.alerts.some((a: any) => a.severity === 'warning')).toBe(true);
  });
});
