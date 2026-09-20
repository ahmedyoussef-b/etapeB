import { describe, expect, it, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import * as nodePath from 'node:path';
import { SyncService } from '../sync.service';
import { LocalDatabaseAdapter } from '@/lib/database/local-adapter';
import { WebDatabaseAdapter } from '@/lib/database/web-adapter';

const createMockWebWithFiles = (files: { path: string; content: Buffer }[]) => {
  const store = new Map<string, Buffer>();
  for (const f of files) store.set(f.path, f.content);
  const dirs = new Set<string>();
  for (const f of files) {
    const parts = f.path.split('/');
    for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/'));
  }

  const getImmediateChildren = (path: string): string[] => {
    const prefix = path === '.' ? '' : (path.endsWith('/') ? path : path + '/');
    const items = new Set<string>();

    Array.from(store.keys()).forEach((key) => {
      if (key.startsWith(prefix)) {
        const rest = key.slice(prefix.length);
        const slashIndex = rest.indexOf('/');
        if (slashIndex === -1) {
          items.add(rest);
        } else {
          items.add(rest.slice(0, slashIndex));
        }
      }
    });

    Array.from(dirs).forEach((dir) => {
      if (dir.startsWith(prefix)) {
        const rest = dir.slice(prefix.length);
        const slashIndex = rest.indexOf('/');
        if (slashIndex === -1) {
          items.add(rest);
        } else {
          items.add(rest.slice(0, slashIndex));
        }
      }
    });

    return Array.from(items);
  };

  return {
    usePrisma: false,
    ping: vi.fn().mockResolvedValue(true),
    list: vi.fn().mockImplementation(async (path: string) => getImmediateChildren(path)),
    exists: vi.fn().mockImplementation(async (path: string) => store.has(path) || dirs.has(path)),
    read: vi.fn().mockImplementation(async (path: string) => {
      const data = store.get(path);
      if (!data) throw new Error('NOT_FOUND');
      return data;
    }),
    writeJSON: vi.fn().mockImplementation(async (path: string, data: any) => {
      store.set(path, Buffer.from(JSON.stringify(data)));
    }),
    delete: vi.fn().mockImplementation(async (path: string) => { store.delete(path); }),
    readJSON: vi.fn().mockImplementation(async (path: string) => {
      if (path === 'mirror_repertoire.json') return { version: '1.0.0' };
      if (path === 'indexes/blocks.json') return { items: [], total: 0 };
      if (path === 'indexes/equipment.json') return { items: [], total: 0 };
      if (path === 'indexes/groups.json') return { items: [], total: 0 };
      return null;
    })
  };
};

describe('SyncService.syncFiles', () => {
  const testBasePath = nodePath.resolve(process.cwd(), '.test-sync-files');
  let localAdapter: LocalDatabaseAdapter;

  beforeAll(() => {
    localAdapter = new LocalDatabaseAdapter('.test-sync-files');
  });

  beforeEach(async () => {
    await fs.rm(testBasePath, { recursive: true, force: true });
    await fs.mkdir(testBasePath, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testBasePath, { recursive: true, force: true });
  });

  it('copie un fichier ajouté Web → Local et purge le Web', async () => {
    const webFiles = [
      { path: 'registry/items/new-file.txt', content: Buffer.from('new file content') }
    ];
    const web = createMockWebWithFiles(webFiles);
    const service = new SyncService(localAdapter, web as unknown as WebDatabaseAdapter);

    const result = await service.syncFiles();
    expect(result.success).toBe(true);
    expect(result.copied).toBe(1);
    expect(result.purged).toBe(1);

    const localContent = await localAdapter.read('registry/items/new-file.txt');
    expect(localContent.toString()).toBe('new file content');
  });

  it('déduplique un fichier déjà présent dans le Local sans l\'écraser', async () => {
    // Créer le fichier existant dans le Local
    await localAdapter.mkdir('Centrale/A0');
    await localAdapter.write('Centrale/A0/.meta.json', Buffer.from('existing local data'));

    const webFiles = [
      { path: 'Centrale/A0/.meta.json', content: Buffer.from('web data') }
    ];
    const web = createMockWebWithFiles(webFiles);
    const service = new SyncService(localAdapter, web as unknown as WebDatabaseAdapter);

    const result = await service.syncFiles();
    expect(result.success).toBe(true);
    expect(result.deduplicated).toBe(1);
    expect(result.purged).toBe(1);

    // Le fichier original est déplacé vers le dossier _duplicates
    const existsOriginal = await localAdapter.exists('Centrale/A0/.meta.json');
    expect(existsOriginal).toBe(false);

    const duplicatesDir = 'Centrale/A0/.meta_duplicates';
    const dupEntries = await localAdapter.list(duplicatesDir);
    expect(dupEntries).toContain('manifest.json');
  });

  it('gère les dossiers vides sans erreur', async () => {
    const web = createMockWebWithFiles([]);
    const service = new SyncService(localAdapter, web as unknown as WebDatabaseAdapter);

    const result = await service.syncFiles();
    expect(result.success).toBe(true);
    expect(result.total).toBe(0);
  });
});
