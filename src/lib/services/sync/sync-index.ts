import { LocalDatabaseAdapter } from '@/lib/database/local-adapter';
import { WebDatabaseAdapter } from '@/lib/database/web-adapter';
import { SyncService } from './sync.service';
import { createHash } from 'crypto';

export interface SyncIndexEntry {
  path: string;
  name: string;
  folder: string;
  size: number;
  hash: string;
  source: 'document' | 'adapter';
  addedAt: string;
}

export interface SyncIndexData {
  version: number;
  builtAt: string;
  totalFiles: number;
  entries: SyncIndexEntry[];
}

export interface IntegrityReport {
  inSync: boolean;
  indexCount: number;
  webCount: number;
  missingFromIndex: string[];
  extraInIndex: string[];
  driftRatio: number;
  builtAt: string;
}

interface SyncIndexMeta {
  lastVerifiedAt: string;
}

const INDEX_VERSION = 1;
const INDEX_PATH = 'system/sync-index.json';
const INDEX_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const INDEX_META_PATH = 'system/sync-index-meta.json';
const DRIFT_THRESHOLD = 0.05;

export class SyncIndex {
  private data: SyncIndexData;

  constructor(data: SyncIndexData) {
    this.data = data;
  }

  static async load(storageRoot: string): Promise<SyncIndex | null> {
    try {
      const adapter = new LocalDatabaseAdapter(storageRoot);
      const raw = await adapter.readJSON<SyncIndexData>(INDEX_PATH);
      if (!raw || typeof raw !== 'object') return null;
      if (raw.version !== INDEX_VERSION) return null;
      if (!Array.isArray(raw.entries)) return null;
      for (const entry of raw.entries) {
        if (!entry.path || !entry.hash || entry.size == null || !entry.addedAt) {
          return null;
        }
      }
      return new SyncIndex(raw);
    } catch {
      return null;
    }
  }

  async save(storageRoot: string): Promise<void> {
    const adapter = new LocalDatabaseAdapter(storageRoot);
    await adapter.mkdir('system');
    await adapter.writeJSON(INDEX_PATH, this.data);
  }

  upsert(entry: SyncIndexEntry): void {
    const idx = this.data.entries.findIndex(e => e.path === entry.path);
    if (idx >= 0) {
      this.data.entries[idx] = entry;
    } else {
      this.data.entries.push(entry);
    }
  }

  remove(path: string): void {
    this.data.entries = this.data.entries.filter(e => e.path !== path);
  }

  getAll(): SyncIndexEntry[] {
    return this.data.entries;
  }

  get(path: string): SyncIndexEntry | undefined {
    return this.data.entries.find(e => e.path === path);
  }

  isStale(maxAgeMs: number = INDEX_MAX_AGE_MS): boolean {
    const builtAt = new Date(this.data.builtAt).getTime();
    return Date.now() - builtAt > maxAgeMs;
  }

  getBuiltAt(): string {
    return this.data.builtAt;
  }

  get totalFiles(): number {
    return this.data.entries.length;
  }
}

export function sha256(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

export async function buildIndexFromWeb(
  webAdapter: WebDatabaseAdapter,
  storageRoot: string,
): Promise<SyncIndex> {
  const localAdapter = new LocalDatabaseAdapter(storageRoot);
  const syncService = new SyncService(localAdapter, webAdapter);
  const webFiles = await syncService.scanWebFiles([
    'Centrale',
    'Groupes',
    'bank',
    'documents',
    'registry',
    'ressources humaines',
    'data',
  ]);

  const entries: SyncIndexEntry[] = webFiles.map(file => ({
    path: file.path,
    name: file.name,
    folder: file.folder,
    size: file.data.length,
    hash: sha256(file.data),
    source: 'document' as const,
    addedAt: new Date().toISOString(),
  }));

  const data: SyncIndexData = {
    version: INDEX_VERSION,
    builtAt: new Date().toISOString(),
    totalFiles: entries.length,
    entries,
  };

  const index = new SyncIndex(data);
  await index.save(storageRoot);
  await setLastVerifyTimestamp(storageRoot, Date.now());
  return index;
}

export async function readIndex(storageRoot: string): Promise<SyncIndex | null> {
  const index = await SyncIndex.load(storageRoot);
  if (index && index.isStale()) {
    console.warn('[SyncIndex] Index is stale, consider rebuilding');
  }
  return index;
}

export function resolveStorageRoot(): string {
  return new LocalDatabaseAdapter('.data').getBasePath();
}

export async function updateIndexOnWebWrite(
  storageRoot: string,
  operation: 'upsert' | 'remove',
  entry: SyncIndexEntry | { path: string },
): Promise<void> {
  const index = await SyncIndex.load(storageRoot);
  if (!index) {
    console.warn('[SyncIndex] Index absent, skipping update');
    return;
  }

  if (operation === 'upsert') {
    index.upsert(entry as SyncIndexEntry);
  } else {
    index.remove((entry as { path: string }).path);
  }

  await index.save(storageRoot);
}

const SCAN_PATHS = [
  'Centrale',
  'Groupes',
  'bank',
  'documents',
  'registry',
  'ressources humaines',
  'data',
];

export async function verifyIndexIntegrity(
  webAdapter: WebDatabaseAdapter,
  storageRoot: string,
): Promise<IntegrityReport> {
  const index = await SyncIndex.load(storageRoot);
  if (!index) {
    return {
      inSync: false,
      indexCount: 0,
      webCount: 0,
      missingFromIndex: [],
      extraInIndex: [],
      driftRatio: 1,
      builtAt: '',
    };
  }

  const localAdapter = new LocalDatabaseAdapter(storageRoot);
  const syncService = new SyncService(localAdapter, webAdapter);
  const webFiles = await syncService.scanWebFiles(SCAN_PATHS);

  const indexPaths = new Set(index.getAll().map(e => e.path));
  const webPaths = new Set(webFiles.map(f => f.path));

  const missingFromIndex = Array.from(webPaths).filter(p => !indexPaths.has(p));
  const extraInIndex = Array.from(indexPaths).filter(p => !webPaths.has(p));

  const driftRatio =
    (missingFromIndex.length + extraInIndex.length) /
    Math.max(indexPaths.size, webPaths.size, 1);

  return {
    inSync: driftRatio < 0.01,
    indexCount: indexPaths.size,
    webCount: webPaths.size,
    missingFromIndex,
    extraInIndex,
    driftRatio,
    builtAt: index.getBuiltAt(),
  };
}

export async function verifyAndRebuildIfNeeded(
  webAdapter: WebDatabaseAdapter,
  storageRoot: string,
): Promise<{ rebuilt: boolean; report: IntegrityReport }> {
  const report = await verifyIndexIntegrity(webAdapter, storageRoot);

  if (report.driftRatio > DRIFT_THRESHOLD) {
    console.warn(
      `[SyncIndex] Drift detected (${(report.driftRatio * 100).toFixed(1)}%), rebuilding...`,
    );
    await buildIndexFromWeb(webAdapter, storageRoot);
    await setLastVerifyTimestamp(storageRoot, Date.now());
    return { rebuilt: true, report };
  }

  await setLastVerifyTimestamp(storageRoot, Date.now());
  return { rebuilt: false, report };
}

async function getMeta(storageRoot: string): Promise<SyncIndexMeta | null> {
  try {
    const adapter = new LocalDatabaseAdapter(storageRoot);
    return await adapter.readJSON<SyncIndexMeta>(INDEX_META_PATH);
  } catch {
    return null;
  }
}

async function setMeta(storageRoot: string, meta: SyncIndexMeta): Promise<void> {
  const adapter = new LocalDatabaseAdapter(storageRoot);
  await adapter.mkdir('system');
  await adapter.writeJSON(INDEX_META_PATH, meta);
}

export async function getLastVerifyTimestamp(storageRoot: string): Promise<number> {
  const meta = await getMeta(storageRoot);
  return meta ? new Date(meta.lastVerifiedAt).getTime() : 0;
}

export async function setLastVerifyTimestamp(storageRoot: string, timestamp: number): Promise<void> {
  await setMeta(storageRoot, { lastVerifiedAt: new Date(timestamp).toISOString() });
}

// TODO: admin endpoint `/api/admin/sync-index` (GET=verify, POST=rebuild)
// Requires authOptions + WebDatabaseAdapter creation from env.
