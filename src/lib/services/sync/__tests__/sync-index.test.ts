import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  SyncIndex,
  buildIndexFromWeb,
  readIndex,
  verifyIndexIntegrity,
  verifyAndRebuildIfNeeded,
  updateIndexOnWebWrite,
  sha256,
  getLastVerifyTimestamp,
  setLastVerifyTimestamp,
} from '../sync-index';
import { LocalDatabaseAdapter } from '@/lib/database/local-adapter';
import { WebDatabaseAdapter } from '@/lib/database/web-adapter';

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'sync-index-test-'));
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

const createMockWebAdapter = (files: { path: string; content: Buffer }[]) => {
  const store = new Map<string, Buffer>();
  for (const f of files) store.set(f.path, f.content);
  const dirs = new Set<string>();
  for (const f of files) {
    const parts = f.path.split('/');
    for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/'));
  }

  const getImmediateChildren = (currentPath: string): string[] => {
    const prefix = currentPath === '.' ? '' : currentPath.endsWith('/') ? currentPath : currentPath + '/';
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
    list: vi.fn().mockImplementation(async (p: string) => getImmediateChildren(p)),
    exists: vi.fn().mockImplementation(async (p: string) => store.has(p) || dirs.has(p)),
    read: vi.fn().mockImplementation(async (p: string) => {
      const data = store.get(p);
      if (!data) throw new Error('NOT_FOUND');
      return data;
    }),
    writeJSON: vi.fn().mockImplementation(async (p: string, data: any) => {
      store.set(p, Buffer.from(JSON.stringify(data)));
    }),
    delete: vi.fn().mockImplementation(async (p: string) => { store.delete(p); }),
    readJSON: vi.fn().mockImplementation(async (p: string) => {
      if (p === 'mirror_repertoire.json') return { version: '1.0.0' };
      if (p === 'indexes/blocks.json') return { items: [], total: 0 };
      if (p === 'indexes/equipment.json') return { items: [], total: 0 };
      if (p === 'indexes/groups.json') return { items: [], total: 0 };
      return null;
    }),
  } as unknown as WebDatabaseAdapter;
};

describe('sha256', () => {
  it('retourne un hash déterministe', () => {
    expect(sha256('hello')).toBe(sha256('hello'));
  });

  it('retourne des hashs différents pour des entrées différentes', () => {
    expect(sha256('hello')).not.toBe(sha256('world'));
  });

  it('accepte Buffer', () => {
    const h1 = sha256(Buffer.from('test'));
    const h2 = sha256(Buffer.from('test'));
    expect(h1).toBe(h2);
  });
});

describe('SyncIndex.load', () => {
  it('retourne null si le fichier est absent', async () => {
    const result = await SyncIndex.load(tmpRoot);
    expect(result).toBeNull();
  });

  it('retourne null si le JSON est corrompu', async () => {
    const indexPath = path.join(tmpRoot, 'system', 'sync-index.json');
    await fs.mkdir(path.dirname(indexPath), { recursive: true });
    await fs.writeFile(indexPath, 'not a json');
    const result = await SyncIndex.load(tmpRoot);
    expect(result).toBeNull();
  });

  it('retourne null si la version est incompatible', async () => {
    const indexPath = path.join(tmpRoot, 'system', 'sync-index.json');
    await fs.mkdir(path.dirname(indexPath), { recursive: true });
    await fs.writeFile(indexPath, JSON.stringify({ version: 999, builtAt: '', entries: [] }));
    const result = await SyncIndex.load(tmpRoot);
    expect(result).toBeNull();
  });

  it('retourne null si une entrée est invalide', async () => {
    const indexPath = path.join(tmpRoot, 'system', 'sync-index.json');
    await fs.mkdir(path.dirname(indexPath), { recursive: true });
    await fs.writeFile(indexPath, JSON.stringify({
      version: 1,
      builtAt: new Date().toISOString(),
      totalFiles: 1,
      entries: [{ path: '', hash: 'abc', size: 0, addedAt: '' }],
    }));
    const result = await SyncIndex.load(tmpRoot);
    expect(result).toBeNull();
  });

  it('charge correctement un index valide', async () => {
    const adapter = new LocalDatabaseAdapter(tmpRoot);
    await adapter.mkdir('system');
    await adapter.writeJSON('system/sync-index.json', {
      version: 1,
      builtAt: new Date().toISOString(),
      entries: [
        { path: 'a.txt', name: 'a.txt', folder: '.', size: 4, hash: sha256('test'), source: 'document', addedAt: new Date().toISOString() },
      ],
    });

    const result = await SyncIndex.load(tmpRoot);
    expect(result).not.toBeNull();
    expect(result!.totalFiles).toBe(1);
    expect(result!.get('a.txt')).toBeDefined();
  });
});

describe('SyncIndex CRUD', () => {
  let index: SyncIndex;

  beforeEach(() => {
    index = new SyncIndex({
      version: 1,
      builtAt: new Date().toISOString(),
      totalFiles: 0,
      entries: [],
    });
  });

  it('upsert ajoute une nouvelle entrée', () => {
    index.upsert({ path: 'a.txt', name: 'a.txt', folder: '.', size: 1, hash: 'h1', source: 'document', addedAt: '' });
    expect(index.totalFiles).toBe(1);
    expect(index.get('a.txt')).toBeDefined();
  });

  it('upsert remplace une entrée existante (même path)', () => {
    index.upsert({ path: 'a.txt', name: 'a.txt', folder: '.', size: 1, hash: 'h1', source: 'document', addedAt: '' });
    index.upsert({ path: 'a.txt', name: 'a.txt', folder: '.', size: 2, hash: 'h2', source: 'document', addedAt: '' });
    expect(index.totalFiles).toBe(1);
    expect(index.get('a.txt')!.hash).toBe('h2');
  });

  it('remove supprime une entrée par path', () => {
    index.upsert({ path: 'a.txt', name: 'a.txt', folder: '.', size: 1, hash: 'h1', source: 'document', addedAt: '' });
    index.remove('a.txt');
    expect(index.totalFiles).toBe(0);
  });

  it('remove sur un path inexistant ne casse pas', () => {
    index.upsert({ path: 'a.txt', name: 'a.txt', folder: '.', size: 1, hash: 'h1', source: 'document', addedAt: '' });
    index.remove('nonexistent.txt');
    expect(index.totalFiles).toBe(1);
  });

  it('getAll retourne toutes les entrées', () => {
    index.upsert({ path: 'a.txt', name: 'a.txt', folder: '.', size: 1, hash: 'h1', source: 'document', addedAt: '' });
    index.upsert({ path: 'b.txt', name: 'b.txt', folder: '.', size: 2, hash: 'h2', source: 'document', addedAt: '' });
    expect(index.getAll().length).toBe(2);
  });
});

describe('SyncIndex.isStale', () => {
  it('retourne false pour un index récent', () => {
    const index = new SyncIndex({
      version: 1,
      builtAt: new Date().toISOString(),
      totalFiles: 0,
      entries: [],
    });
    expect(index.isStale()).toBe(false);
  });

  it('retourne true pour un index ancien', () => {
    const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const index = new SyncIndex({
      version: 1,
      builtAt: oldDate.toISOString(),
      totalFiles: 0,
      entries: [],
    });
    expect(index.isStale()).toBe(true);
  });

  it('accepte un seuil personnalisé', () => {
    const oldDate = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const index = new SyncIndex({
      version: 1,
      builtAt: oldDate.toISOString(),
      totalFiles: 0,
      entries: [],
    });
    expect(index.isStale(60 * 60 * 1000)).toBe(true);
    expect(index.isStale(3 * 60 * 60 * 1000)).toBe(false);
  });
});

describe('readIndex', () => {
  it('retourne null si aucun index', async () => {
    const result = await readIndex(tmpRoot);
    expect(result).toBeNull();
  });

  it('retourne l\'index si présent et valide', async () => {
    const adapter = new LocalDatabaseAdapter(tmpRoot);
    await adapter.mkdir('system');
    await adapter.writeJSON('system/sync-index.json', {
      version: 1,
      builtAt: new Date().toISOString(),
      entries: [],
    });

    const result = await readIndex(tmpRoot);
    expect(result).not.toBeNull();
  });
});

describe('updateIndexOnWebWrite', () => {
  it('ne fait rien si l\'index est absent', async () => {
    await expect(updateIndexOnWebWrite(tmpRoot, 'upsert', {
      path: 'a.txt', name: 'a.txt', folder: '.', size: 1, hash: 'h1', source: 'document', addedAt: '',
    })).resolves.not.toThrow();
  });

  it('upsert une entrée quand l\'index existe', async () => {
    const adapter = new LocalDatabaseAdapter(tmpRoot);
    await adapter.mkdir('system');
    await adapter.writeJSON('system/sync-index.json', {
      version: 1,
      builtAt: new Date().toISOString(),
      entries: [],
    });

    await updateIndexOnWebWrite(tmpRoot, 'upsert', {
      path: 'a.txt', name: 'a.txt', folder: '.', size: 4, hash: sha256('test'), source: 'document', addedAt: new Date().toISOString(),
    });

    const reloaded = await SyncIndex.load(tmpRoot);
    expect(reloaded!.totalFiles).toBe(1);
    expect(reloaded!.get('a.txt')).toBeDefined();
  });

  it('remove une entrée quand l\'index existe', async () => {
    const adapter = new LocalDatabaseAdapter(tmpRoot);
    await adapter.mkdir('system');
    await adapter.writeJSON('system/sync-index.json', {
      version: 1,
      builtAt: new Date().toISOString(),
      entries: [
        { path: 'a.txt', name: 'a.txt', folder: '.', size: 4, hash: sha256('test'), source: 'document', addedAt: new Date().toISOString() },
      ],
    });

    await updateIndexOnWebWrite(tmpRoot, 'remove', { path: 'a.txt' });

    const reloaded = await SyncIndex.load(tmpRoot);
    expect(reloaded!.totalFiles).toBe(0);
  });
});

describe('getLastVerifyTimestamp / setLastVerifyTimestamp', () => {
  it('retourne 0 si aucun meta', async () => {
    const ts = await getLastVerifyTimestamp(tmpRoot);
    expect(ts).toBe(0);
  });

  it('stocke et récupère un timestamp', async () => {
    const now = Date.now();
    await setLastVerifyTimestamp(tmpRoot, now);
    const ts = await getLastVerifyTimestamp(tmpRoot);
    expect(ts).toBe(now);
  });
});

describe('buildIndexFromWeb', () => {
  it('construit un index à partir de fichiers web', async () => {
    const webFiles = [
      { path: 'Centrale/A0/file1.txt', content: Buffer.from('content1') },
      { path: 'registry/items/item.json', content: Buffer.from('{"key":"value"}') },
    ];
    const web = createMockWebAdapter(webFiles);

    const index = await buildIndexFromWeb(web, tmpRoot);
    expect(index.totalFiles).toBe(2);
    expect(index.get('Centrale/A0/file1.txt')).toBeDefined();
    expect(index.get('registry/items/item.json')).toBeDefined();
  });

  it('met à jour lastVerifiedAt après build', async () => {
    const web = createMockWebAdapter([
      { path: 'Centrale/A0/file1.txt', content: Buffer.from('content1') },
    ]);

    await buildIndexFromWeb(web, tmpRoot);
    const ts = await getLastVerifyTimestamp(tmpRoot);
    expect(ts).toBeGreaterThan(0);
    expect(Date.now() - ts).toBeLessThan(1000);
  });
});

describe('verifyIndexIntegrity', () => {
  it('retourne driftRatio=1 si l\'index est absent', async () => {
    const web = createMockWebAdapter([
      { path: 'Centrale/A0/file1.txt', content: Buffer.from('content1') },
    ]);

    const report = await verifyIndexIntegrity(web, tmpRoot);
    expect(report.inSync).toBe(false);
    expect(report.driftRatio).toBe(1);
    expect(report.indexCount).toBe(0);
    expect(report.webCount).toBe(0);
    expect(report.missingFromIndex).toHaveLength(0);
    expect(report.extraInIndex).toHaveLength(0);
  });

  it('retourne inSync=true si l\'index est complet', async () => {
    const webFiles = [
      { path: 'Centrale/A0/file1.txt', content: Buffer.from('content1') },
      { path: 'registry/items/item.json', content: Buffer.from('{"key":"value"}') },
    ];
    const web = createMockWebAdapter(webFiles);

    await buildIndexFromWeb(web, tmpRoot);

    const report = await verifyIndexIntegrity(web, tmpRoot);
    expect(report.inSync).toBe(true);
    expect(report.driftRatio).toBe(0);
    expect(report.indexCount).toBe(2);
    expect(report.webCount).toBe(2);
  });

  it('détecte les fichiers manquants dans l\'index', async () => {
    const webFiles = [
      { path: 'Centrale/A0/file1.txt', content: Buffer.from('content1') },
      { path: 'registry/items/item.json', content: Buffer.from('{"key":"value"}') },
    ];
    const web = createMockWebAdapter(webFiles);

    const adapter = new LocalDatabaseAdapter(tmpRoot);
    await adapter.mkdir('system');
    await adapter.writeJSON('system/sync-index.json', {
      version: 1,
      builtAt: new Date().toISOString(),
      entries: [
        { path: 'Centrale/A0/file1.txt', name: 'file1.txt', folder: 'Centrale/A0', size: 8, hash: sha256('content1'), source: 'document', addedAt: new Date().toISOString() },
      ],
    });

    const report = await verifyIndexIntegrity(web, tmpRoot);
    expect(report.missingFromIndex).toContain('registry/items/item.json');
    expect(report.extraInIndex).toHaveLength(0);
  });

  it('détecte les fichiers en trop dans l\'index', async () => {
    const webFiles = [
      { path: 'Centrale/A0/file1.txt', content: Buffer.from('content1') },
    ];
    const web = createMockWebAdapter(webFiles);

    const adapter = new LocalDatabaseAdapter(tmpRoot);
    await adapter.mkdir('system');
    await adapter.writeJSON('system/sync-index.json', {
      version: 1,
      builtAt: new Date().toISOString(),
      entries: [
        { path: 'Centrale/A0/file1.txt', name: 'file1.txt', folder: 'Centrale/A0', size: 8, hash: sha256('content1'), source: 'document', addedAt: new Date().toISOString() },
        { path: 'Centrale/A0/ghost.txt', name: 'ghost.txt', folder: 'Centrale/A0', size: 6, hash: sha256('ghost'), source: 'document', addedAt: new Date().toISOString() },
      ],
    });

    const report = await verifyIndexIntegrity(web, tmpRoot);
    expect(report.extraInIndex).toContain('Centrale/A0/ghost.txt');
    expect(report.missingFromIndex).toHaveLength(0);
  });
});

describe('verifyAndRebuildIfNeeded', () => {
  it('ne rebuild pas si driftRatio < seuil', async () => {
    const webFiles = [
      { path: 'Centrale/A0/file1.txt', content: Buffer.from('content1') },
    ];
    const web = createMockWebAdapter(webFiles);

    await buildIndexFromWeb(web, tmpRoot);

    const result = await verifyAndRebuildIfNeeded(web, tmpRoot);
    expect(result.rebuilt).toBe(false);
    expect(result.report.inSync).toBe(true);
  });

  it('rebuild si driftRatio > seuil', async () => {
    const webFiles = [
      { path: 'Centrale/A0/file1.txt', content: Buffer.from('content1') },
      { path: 'registry/items/item.json', content: Buffer.from('{"key":"value"}') },
    ];
    const web = createMockWebAdapter(webFiles);

    const adapter = new LocalDatabaseAdapter(tmpRoot);
    await adapter.mkdir('system');
    await adapter.writeJSON('system/sync-index.json', {
      version: 1,
      builtAt: new Date().toISOString(),
      entries: [
        { path: 'Centrale/A0/file1.txt', name: 'file1.txt', folder: 'Centrale/A0', size: 8, hash: sha256('content1'), source: 'document', addedAt: new Date().toISOString() },
      ],
    });

    const result = await verifyAndRebuildIfNeeded(web, tmpRoot);
    expect(result.rebuilt).toBe(true);
    expect(result.report.driftRatio).toBeGreaterThan(0.05);

    const reloaded = await SyncIndex.load(tmpRoot);
    expect(reloaded!.totalFiles).toBe(2);
  });
});

describe('SyncIndex.save', () => {
  it('persiste l\'index et le recharge', async () => {
    const index = new SyncIndex({
      version: 1,
      builtAt: new Date().toISOString(),
      totalFiles: 1,
      entries: [
        { path: 'a.txt', name: 'a.txt', folder: '.', size: 4, hash: sha256('test'), source: 'document', addedAt: new Date().toISOString() },
      ],
    });

    await index.save(tmpRoot);

    const adapter = new LocalDatabaseAdapter(tmpRoot);
    const raw = await adapter.readJSON<any>('system/sync-index.json');
    expect(raw.version).toBe(1);
    expect(raw.entries).toHaveLength(1);
    expect(raw.entries[0].path).toBe('a.txt');
  });
});
