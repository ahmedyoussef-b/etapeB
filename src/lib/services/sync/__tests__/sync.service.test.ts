import { describe, expect, it, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { SyncService } from '../sync.service';
import { LocalDatabaseAdapter } from '@/lib/database/local-adapter';
import { WebDatabaseAdapter } from '@/lib/database/web-adapter';

vi.mock('@/lib/database/web-adapter');
vi.mock('@/lib/database/prisma-adapter');

const createMockWebAdapter = (blocks: any[] = [], equipment: any[] = [], options: { ping?: boolean } = {}) => {
  const blockIndex = { items: blocks.map(b => ({ id: b.code })), total: blocks.length };
  const blockStore: Record<string, any> = {};
  for (const b of blocks) blockStore[b.code] = b;

  const adapter: any = {
    ping: vi.fn().mockResolvedValue(options.ping ?? true),
    readJSON: vi.fn().mockImplementation(async (path: string) => {
      if (path === 'indexes/blocks.json') return blockIndex;
      if (path === 'indexes/equipment.json') return { items: [], total: 0 };
      if (path === 'indexes/groups.json') return { items: [], total: 0 };
      if (path === 'indexes/procedures.json') return { items: [], total: 0 };
      if (path === 'indexes/users.json') return { items: [], total: 0 };
      if (path === 'indexes/teams.json') return { items: [], total: 0 };
      const m = path.match(/^Centrale\/([^/]+)\/\.meta\.json$/);
      if (m && blockStore[m[1]]) return blockStore[m[1]];
      return null;
    }),
    listBlocks: vi.fn().mockResolvedValue(blocks),
    listEquipment: vi.fn().mockResolvedValue(equipment),
    listGroups: vi.fn().mockResolvedValue([]),
    listGroupEquipments: vi.fn().mockResolvedValue([]),
    listProcedures: vi.fn().mockResolvedValue([]),
    listUsers: vi.fn().mockResolvedValue([]),
    listTeams: vi.fn().mockResolvedValue([])
  };
  return adapter;
};

describe('SyncService (Web → Local)', () => {
  const testBasePath = '.test-sync-data';
  let localAdapter: LocalDatabaseAdapter;
  let webAdapter: WebDatabaseAdapter;
  let syncService: SyncService;

  beforeAll(() => {
    localAdapter = new LocalDatabaseAdapter(testBasePath);
    webAdapter = createMockWebAdapter() as unknown as WebDatabaseAdapter;
    syncService = new SyncService(localAdapter, webAdapter);
  });

  beforeEach(async () => {
    await localAdapter.delete('Centrale').catch(() => {});
    await localAdapter.delete('system').catch(() => {});
    await localAdapter.delete('mirror_repertoire.json').catch(() => {});
    await localAdapter.delete('indexes').catch(() => {});
  });

  afterAll(async () => {
    await localAdapter.delete(testBasePath).catch(() => {});
  });

  it('échoue proprement si la BDD Web est inaccessible', async () => {
    const unavailableWeb = createMockWebAdapter([], [], { ping: false }) as unknown as WebDatabaseAdapter;
    const service = new SyncService(localAdapter, unavailableWeb);
    const result = await service.syncFromWeb();
    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.id === 'global')).toBe(true);
  });

  it('importe les blocs quand le Web est disponible', async () => {
    await localAdapter.writeJSON('mirror_repertoire.json', { version: '1.0.0', lastSynced: new Date(Date.now() - 86400000).toISOString() });
    const block = { libelle: 'Bloc A0', code: 'A0', type: 'centrale' as const, updatedAt: new Date().toISOString() };
    const web = createMockWebAdapter([block]) as unknown as WebDatabaseAdapter;
    const service = new SyncService(localAdapter, web);

    const result = await service.syncFromWeb({ entityTypes: ['blocks'] });
    expect(result.success).toBe(true);
    expect(result.imported.blocks).toBe(1);

    const localBlock = await localAdapter.readJSON<any>('Centrale/A0/.meta.json');
    expect(localBlock?.code).toBe('A0');
  });

  it('met à jour un bloc existant plutôt que de le dupliquer', async () => {
    await localAdapter.writeJSON('Centrale/A0/.meta.json', { libelle: 'Bloc A0', code: 'A0', type: 'centrale' });
    const block = { libelle: 'Bloc A0 v2', code: 'A0', type: 'centrale' as const, updatedAt: new Date().toISOString() };
    const web = createMockWebAdapter([block]) as unknown as WebDatabaseAdapter;
    const service = new SyncService(localAdapter, web);

    const result = await service.syncFromWeb({ entityTypes: ['blocks'], force: true });
    expect(result.success).toBe(true);
    expect(result.updated.blocks).toBe(1);
  });

  it('filtre les entités non modifiées depuis le dernier sync', async () => {
    const oldBlock = {
      libelle: 'Old',
      code: 'B0',
      type: 'centrale' as const,
      updatedAt: new Date(Date.now() - 3600 * 1000).toISOString()
    };
    const web = createMockWebAdapter([oldBlock]) as unknown as WebDatabaseAdapter;

    await localAdapter.writeJSON('mirror_repertoire.json', {
      version: '1.0.0',
      lastSynced: new Date().toISOString()
    });

    const service = new SyncService(localAdapter, web);
    const result = await service.syncFromWeb({ entityTypes: ['blocks'] });
    expect(result.imported.blocks).toBe(0);
    expect(result.updated.blocks).toBe(0);
  });

  it('écrit un journal de synchronisation', async () => {
    const service = new SyncService(localAdapter, createMockWebAdapter());
    await service.syncFromWeb({ entityTypes: ['blocks'] });

    const log = await localAdapter.readJSON<any>('system/sync-log.json');
    expect(log).toBeDefined();
    expect(Array.isArray(log.syncs)).toBe(true);
    expect(log.syncs.length).toBeGreaterThan(0);
  });
});