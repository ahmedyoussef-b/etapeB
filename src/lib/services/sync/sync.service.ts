import { LocalDatabaseAdapter } from '@/lib/database/local-adapter';
import { WebDatabaseAdapter } from '@/lib/database/web-adapter';
import { UnifiedDatabaseService, BlockMeta, EquipmentMeta, GroupMeta, GroupEquipmentMeta, Procedure, User, Team } from '@/lib/database/unified-database.service';
import { getPrismaClient } from '@/lib/services/db';
import * as nodePath from 'node:path';
import { promises as fs } from 'node:fs';
import { createHash } from 'crypto';
import { readIndex, buildIndexFromWeb } from './sync-index';

export type EntityType = 'blocks' | 'equipments' | 'groups' | 'groupEquipments' | 'procedures' | 'users' | 'teams';

export interface SyncOptions {
  force?: boolean;
  batchSize?: number;
  dryRun?: boolean;
  entityTypes?: EntityType[];
}

export interface SyncResult {
  success: boolean;
  imported: Record<EntityType, number>;
  updated: Record<EntityType, number>;
  failed: number;
  errors: { type: string; id: string; error: string }[];
  timestamp: string;
  duration: number;
}

interface SyncLogEntry {
  id: string;
  timestamp: string;
  duration: number;
  success: boolean;
  imported: Record<EntityType, number>;
  updated: Record<EntityType, number>;
  failed: number;
  errors: number;
}

interface SyncFileLogEntry {
  id: string;
  timestamp: string;
  copied: number;
  deduplicated: number;
  errors: number;
  total: number;
  purged: number;
}

interface SyncManifest {
  version: string;
  lastSynced?: string;
  stats?: {
    imported: Record<EntityType, number>;
    updated: Record<EntityType, number>;
    failed: number;
  };
}

const DEFAULT_ENTITIES: EntityType[] = ['blocks', 'equipments', 'groups', 'groupEquipments', 'procedures'];
const SYNC_ORDER: EntityType[] = ['blocks', 'groups', 'equipments', 'groupEquipments', 'procedures', 'users', 'teams'];

const emptyCounts = (): Record<EntityType, number> => ({
  blocks: 0,
  equipments: 0,
  groups: 0,
  groupEquipments: 0,
  procedures: 0,
  users: 0,
  teams: 0
});

function sha256(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

export class SyncService {
  private localAdapter: LocalDatabaseAdapter;
  private webAdapter: WebDatabaseAdapter;
  private localService: UnifiedDatabaseService;
  private webService: UnifiedDatabaseService;

  constructor(localAdapter: LocalDatabaseAdapter, webAdapter: WebDatabaseAdapter) {
    this.localAdapter = localAdapter;
    this.webAdapter = webAdapter;
    this.localService = new UnifiedDatabaseService(localAdapter);
    this.webService = new UnifiedDatabaseService(webAdapter);
  }

  async syncFromWeb(options: SyncOptions = {}): Promise<SyncResult> {
    const { force = false, batchSize = 50, dryRun = false, entityTypes = DEFAULT_ENTITIES } = options;
    const startTime = Date.now();

    const result: SyncResult = {
      success: true,
      imported: emptyCounts(),
      updated: emptyCounts(),
      failed: 0,
      errors: [],
      timestamp: new Date().toISOString(),
      duration: 0
    };

    try {
      const webAvailable = await this.webAdapter.ping();
      if (!webAvailable) {
        throw new Error('BDD Web inaccessible');
      }

      const localManifest = await this.getLocalManifest();
      const lastSyncDate = localManifest?.lastSynced ? new Date(localManifest.lastSynced) : null;

      for (const type of SYNC_ORDER) {
        if (!entityTypes.includes(type)) continue;
        await this.syncEntityType(type, result, force, lastSyncDate, batchSize, dryRun);
      }

      if (!dryRun) {
        await this.updateManifest(result);
      }

      await this.logSync(result);
      result.duration = Date.now() - startTime;
      return result;
    } catch (error) {
      result.success = false;
      result.errors.push({
        type: 'sync',
        id: 'global',
        error: error instanceof Error ? error.message : String(error)
      });
      result.duration = Date.now() - startTime;
      return result;
    }
  }

  private async syncEntityType(
    type: EntityType,
    result: SyncResult,
    force: boolean,
    lastSyncDate: Date | null,
    batchSize: number,
    dryRun: boolean
  ): Promise<void> {
    try {
      const webItems = await this.fetchWebItems(type);
      if (webItems.length === 0) return;

      const getItemTimestamp = (item: BlockMeta | EquipmentMeta | GroupMeta | { group: string; equipment: GroupEquipmentMeta } | Procedure | User | Team): number => {
        if ('updatedAt' in item) return new Date(item.updatedAt).getTime();
        if ('createdAt' in item) return new Date(item.createdAt).getTime();
        return 0;
      };

      const itemsToSync = (!force && lastSyncDate)
        ? webItems.filter(item => getItemTimestamp(item) > lastSyncDate.getTime())
        : webItems;

      if (itemsToSync.length === 0) return;

      for (let i = 0; i < itemsToSync.length; i += batchSize) {
        const batch = itemsToSync.slice(i, i + batchSize);
        for (const item of batch) {
          try {
            const exists = !dryRun ? await this.entityExists(type, item) : false;
            if (!dryRun) {
              await this.importEntity(type, item);
            }
            if (exists) {
              result.updated[type]++;
            } else {
              result.imported[type]++;
            }
          } catch (error) {
            result.failed++;
            result.errors.push({
              type,
              id: this.getId(item),
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      }
    } catch (error) {
      result.errors.push({
        type,
        id: 'batch',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async fetchWebItems(type: EntityType): Promise<BlockMeta[] | EquipmentMeta[] | GroupMeta[] | { group: string; equipment: GroupEquipmentMeta }[] | Procedure[] | User[] | Team[]> {
    switch (type) {
      case 'blocks':
        return await this.webService.listBlocks();
      case 'equipments':
        return await this.webService.listEquipment();
      case 'groups':
        return await this.webService.listGroups();
      case 'groupEquipments':
        return await this.webService.listGroupEquipments();
      case 'procedures':
        return await this.webService.listProcedures();
      case 'users':
        return await this.webService.listUsers();
      case 'teams':
        return await this.webService.listTeams();
    }
  }

  private async importEntity(type: EntityType, data: unknown): Promise<void> {
    switch (type) {
      case 'blocks':
        await this.localService.upsertBlock(data as Omit<BlockMeta, 'type'>);
        return;
      case 'equipments': {
        const equipData = data as Omit<EquipmentMeta, 'type'> & { block: string };
        if (!equipData.block) throw new Error('Équipement sans bloc');
        await this.localService.upsertEquipment({ ...equipData, block: equipData.block });
        return;
      }
      case 'groups':
        await this.localService.upsertGroup(data as Omit<GroupMeta, 'type'>);
        return;
      case 'groupEquipments': {
        const geData = data as { group: string } & Omit<GroupEquipmentMeta, 'type'>;
        await this.localService.upsertGroupEquipment(geData.group, { ...geData, parentId: geData.parentId || geData.group });
        return;
      }
      case 'procedures':
        await this.localService.upsertProcedure(data as Omit<Procedure, 'createdAt' | 'updatedAt'> & { createdAt?: string; updatedAt?: string });
        return;
      case 'users':
        await this.localService.upsertUser(data as Omit<User, 'createdAt'> & { id: string; createdAt?: string });
        return;
      case 'teams':
        await this.localService.upsertTeam(data as Omit<Team, 'createdAt'> & { id: string; createdAt?: string });
        return;
    }
  }

  private async entityExists(type: EntityType, data: unknown): Promise<boolean> {
    try {
      switch (type) {
        case 'blocks':
          return !!(await this.localService.getBlock((data as BlockMeta).code));
        case 'equipments':
          const equipData = data as Omit<EquipmentMeta, 'type'> & { block: string };
          return !!(await this.localService.getEquipment(equipData.block, equipData.code));
        case 'groups':
          return !!(await this.localService.getGroup((data as GroupMeta).code));
        case 'procedures':
          return !!(await this.localService.getProcedure((data as Procedure).id));
        case 'users':
          return !!(await this.localService.getUser((data as User).id));
        case 'teams':
          return !!(await this.localService.getTeam((data as Team).id));
        case 'groupEquipments':
          return false;
      }
    } catch {
      return false;
    }
  }

  private getId(item: BlockMeta | EquipmentMeta | GroupMeta | { group: string; equipment: GroupEquipmentMeta } | Procedure | User | Team): string {
    if ('id' in item) return item.id;
    if ('code' in item) return (item as BlockMeta | EquipmentMeta | GroupMeta).code;
    if ('group' in item) {
      const ge = item as { group: string; equipment: GroupEquipmentMeta };
      return ge.group || ge.equipment.code || 'unknown';
    }
    return 'unknown';
  }

  private async getLocalManifest(): Promise<SyncManifest | null> {
    try {
      return await this.localAdapter.readJSON('mirror_repertoire.json');
    } catch {
      return null;
    }
  }

  private async updateManifest(result: SyncResult): Promise<void> {
    const manifest = {
      version: '1.0.0',
      lastSynced: result.timestamp,
      stats: {
        imported: result.imported,
        updated: result.updated,
        failed: result.failed
      }
    };
    await this.localAdapter.writeJSON('mirror_repertoire.json', manifest);
  }

  private async logSync(result: SyncResult): Promise<void> {
    const logEntry: SyncLogEntry = {
      id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      timestamp: result.timestamp,
      duration: result.duration,
      success: result.success,
      imported: result.imported,
      updated: result.updated,
      failed: result.failed,
      errors: result.errors.length
    };

    try {
      const existing = await this.localAdapter.readJSON<{ syncs: SyncLogEntry[] }>('system/sync-log.json') || { syncs: [] as SyncLogEntry[] };
      existing.syncs.push(logEntry);
      if (existing.syncs.length > 100) {
        existing.syncs = existing.syncs.slice(-100);
      }
      await this.localAdapter.writeJSON('system/sync-log.json', existing);
    } catch (error) {
      console.warn('⚠️ Impossible de journaliser la sync:', error);
    }
  }

  async getSyncStatus(): Promise<{
    lastSync: string | null;
    totalImported: number;
    lastSyncDuration: number;
  }> {
    try {
      const manifest = await this.getLocalManifest();
      const logs = await this.localAdapter.readJSON<{ syncs: SyncLogEntry[] }>('system/sync-log.json') || { syncs: [] as SyncLogEntry[] };
      const lastLog = logs.syncs[logs.syncs.length - 1] || null;

      let totalImported = 0;
      if (lastLog?.imported) {
        for (const v of Object.values(lastLog.imported)) totalImported += v as number;
      }

      return {
        lastSync: manifest?.lastSynced || null,
        totalImported,
        lastSyncDuration: lastLog?.duration || 0
      };
    } catch {
      return { lastSync: null, totalImported: 0, lastSyncDuration: 0 };
    }
  }

  async syncAll(options: SyncOptions = {}): Promise<{ success: boolean; dataResult: SyncResult; fileResult: SyncFilesResult }> {
    const dataResult = await this.syncFromWeb(options);
    const fileResult = await this.syncFiles();
    return {
      success: dataResult.success && fileResult.success,
      dataResult,
      fileResult
    };
  }

  async syncFiles(): Promise<SyncFilesResult> {
    const startTime = Date.now();
    const result: SyncFilesResult = {
      success: true,
      results: [],
      total: 0,
      copied: 0,
      deduplicated: 0,
      errors: 0,
      purged: 0
    };

    try {
      const storageRoot = this.localAdapter.getBasePath();
      const index = await readIndex(storageRoot);
      let webFiles: { path: string; name: string; folder: string; data: Buffer }[];

      if (index && !index.isStale()) {
        console.log(`[SyncFiles] Using index (${index.totalFiles} entries, built ${index.getBuiltAt()})`);
        webFiles = [];
        for (const entry of index.getAll()) {
          try {
            const data = await this.webAdapter.read(entry.path);
            webFiles.push({
              path: entry.path,
              name: entry.name,
              folder: entry.folder,
              data: Buffer.isBuffer(data) ? data : Buffer.from(data),
            });
          } catch (err) {
            console.warn(`[SyncFiles] Failed to read indexed file: ${entry.path}`, err);
          }
        }
        result.total = webFiles.length;
      } else {
        console.log(`[SyncFiles] Index missing or stale, falling back to scanWebFiles()`);
        webFiles = await this.scanWebFiles(['Centrale', 'Groupes', 'bank', 'documents', 'registry', 'ressources humaines', 'data']);
        result.total = webFiles.length;

        try {
          await buildIndexFromWeb(this.webAdapter, storageRoot);
          console.log('[SyncFiles] Index rebuilt after fallback scan');
        } catch (err) {
          console.warn('[SyncFiles] Failed to rebuild index after fallback:', err);
        }
      }

      for (const webFile of webFiles) {
        try {
          const localFilePath = webFile.path;
          const existsInLocal = await this.localAdapter.exists(localFilePath);

          if (!existsInLocal) {
            // Fichier absent du Local : copier directement
            await this.localAdapter.mkdir(webFile.folder);
            const originalHash = sha256(webFile.data);
            await this.localAdapter.write(localFilePath, webFile.data);
            const written = await this.localAdapter.read(localFilePath);
            if (sha256(written) !== originalHash) {
              console.error(`[SyncFiles] Hash mismatch after write: ${localFilePath}`);
              result.errors++;
              result.results.push({
                success: false,
                sourcePath: webFile.path,
                targetPath: localFilePath,
                action: 'error',
                message: 'Hash mismatch après écriture'
              });
              continue;
            }
            await this.webAdapter.delete(webFile.path);
            result.copied++;
            result.results.push({
              success: true,
              sourcePath: webFile.path,
              targetPath: localFilePath,
              action: 'copied',
              message: 'Fichier copié avec succès'
            });
          } else {
            // Fichier déjà présent dans le Local : déduplication par répertoire
            const baseName = webFile.name.replace(/\.[^.]+$/, '');
            const extension = webFile.name.includes('.') ? webFile.name.split('.').pop()! : '';
            const dedupFolder = `${webFile.folder}/${baseName}_duplicates`;
            await this.localAdapter.mkdir(dedupFolder);

            // Déplacer l'ancien fichier existant vers le dossier de déduplication
            let existingName = '';
            const existingData = await this.localAdapter.read(localFilePath);
            existingName = extension ? `${baseName}_v1.${extension}` : `${baseName}_v1`;
            const existingHash = sha256(existingData);
            await this.localAdapter.write(`${dedupFolder}/${existingName}`, existingData);
            const writtenV1 = await this.localAdapter.read(`${dedupFolder}/${existingName}`);
            if (sha256(writtenV1) !== existingHash) {
              console.error(`[SyncFiles] Hash mismatch after write: ${dedupFolder}/${existingName}`);
              result.errors++;
              result.results.push({
                success: false,
                sourcePath: webFile.path,
                targetPath: `${dedupFolder}/${existingName}`,
                action: 'error',
                message: 'Hash mismatch après écriture (v1)'
              });
              continue;
            }
            await this.localAdapter.delete(localFilePath);

            // Copier le nouveau fichier depuis le Web
            const newName = extension ? `${baseName}_v2.${extension}` : `${baseName}_v2`;
            const newHash = sha256(webFile.data);
            await this.localAdapter.write(`${dedupFolder}/${newName}`, webFile.data);
            const writtenV2 = await this.localAdapter.read(`${dedupFolder}/${newName}`);
            if (sha256(writtenV2) !== newHash) {
              console.error(`[SyncFiles] Hash mismatch after write: ${dedupFolder}/${newName}`);
              result.errors++;
              result.results.push({
                success: false,
                sourcePath: webFile.path,
                targetPath: `${dedupFolder}/${newName}`,
                action: 'error',
                message: 'Hash mismatch après écriture (v2)'
              });
              continue;
            }
            await this.webAdapter.delete(webFile.path);

            // Écrire un manifest des versions
            const manifest = {
              originalName: webFile.name,
              createdAt: new Date().toISOString(),
              versions: [
                { name: existingName, source: 'local', date: new Date().toISOString() },
                { name: newName, source: 'web', date: new Date().toISOString() }
              ],
              deduplicated: true
            };
            await this.localAdapter.writeJSON(`${dedupFolder}/manifest.json`, manifest);

            result.deduplicated++;
            result.results.push({
              success: true,
              sourcePath: webFile.path,
              targetPath: dedupFolder,
              action: 'deduplicated',
              message: `Fichier dédupliqué dans ${dedupFolder}`,
              targetFiles: [existingName, newName]
            });
          }
        } catch (error) {
          result.errors++;
          result.results.push({
            success: false,
            sourcePath: webFile.path,
            targetPath: webFile.path,
            action: 'error',
            message: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Purger les fichiers du Web qui ont été copiés ou dédupliqués
      result.purged = result.copied + result.deduplicated;

      await this.logFileSync({
        copied: result.copied,
        deduplicated: result.deduplicated,
        errors: result.errors,
        total: result.total,
        purged: result.purged
      });

      result.duration = Date.now() - startTime;
      return result;
    } catch (error) {
      return {
        success: false,
        results: [],
        total: 0,
        copied: 0,
        deduplicated: 0,
        errors: 1,
        purged: 0,
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async scanWebPathRecursive(
    basePath: string,
    currentPath: string,
    files: { path: string; name: string; folder: string; data: Buffer }[]
  ): Promise<void> {
    let items: string[] = [];
    try {
      items = await this.webAdapter.list(currentPath);
    } catch {
      // Not a directory — try reading as a file
      try {
        const data = await this.webAdapter.read(currentPath);
        if (data && data.length > 0) {
          const name = currentPath.split('/').pop() || currentPath;
          const folder = currentPath.slice(0, currentPath.length - name.length - 1) || basePath;
          files.push({ path: currentPath, name, folder, data });
        }
      } catch {}
      return;
    }

    if (items.length === 0) {
      // Empty directory — try reading as a file (edge case)
      try {
        const data = await this.webAdapter.read(currentPath);
        if (data && data.length > 0) {
          const name = currentPath.split('/').pop() || currentPath;
          const folder = currentPath.slice(0, currentPath.length - name.length - 1) || basePath;
          files.push({ path: currentPath, name, folder, data });
        }
      } catch {}
      return;
    }

    for (const item of items) {
      if (item.startsWith('.') && !item.endsWith('.meta.json')) continue;
      const childPath = `${currentPath}/${item}`;
      await this.scanWebPathRecursive(basePath, childPath, files);
    }
  }

  async scanWebFiles(scanPaths: string[]): Promise<{ path: string; name: string; folder: string; data: Buffer }[]> {
    const files: { path: string; name: string; folder: string; data: Buffer }[] = [];

    // 1. Direct Prisma Document scan for all uploaded/versioned files
    try {
      const prisma = getPrismaClient();
      const allDocs = await prisma.document.findMany({
        select: { id: true, path: true, filename: true, data: true }
      });
      for (const doc of allDocs) {
        if (!doc.path || !doc.data) continue;
        if (files.some(f => f.path === doc.path)) continue;

        const lastSlash = doc.path.lastIndexOf('/');
        const folder = lastSlash > 0 ? doc.path.substring(0, lastSlash) : '.';
        const name = doc.filename || (lastSlash >= 0 ? doc.path.substring(lastSlash + 1) : doc.path);
        files.push({
          path: doc.path,
          name,
          folder,
          data: Buffer.from(doc.data)
        });
      }
    } catch (err) {
      console.warn('[SyncService] scanWebFiles prisma document scan:', err);
    }

    // 2. Also scan webAdapter paths recursively
    for (const basePath of scanPaths) {
      try {
        await this.scanWebPathRecursive(basePath, basePath, files);
      } catch {
        continue;
      }
    }

    return files;
  }


  private async processFileSync(webFile: { path: string; name: string; folder: string; data: Buffer }): Promise<SyncFileResult> {
    const { path: sourcePath, name: fileName, folder: folderPath, data } = webFile;
    const localFilePath = `${folderPath}/${fileName}`;

    const existsInLocal = await this.localAdapter.exists(localFilePath);

    if (!existsInLocal) {
      await this.localAdapter.mkdir(folderPath);
      await this.localAdapter.write(localFilePath, data);
      await this.webAdapter.delete(sourcePath);
      return { success: true, sourcePath, targetPath: localFilePath, action: 'copied', message: 'Fichier copié avec succès' };
    }

    const baseName = fileName.replace(/\.[^.]+$/, '');
    const extension = fileName.includes('.') ? fileName.split('.').pop()! : '';
    const dedupFolder = `${folderPath}/${baseName}_duplicates`;
    await this.localAdapter.mkdir(dedupFolder);

    let existingName = '';
    try {
      const existingData = await this.localAdapter.read(localFilePath);
      existingName = `${baseName}_v1.${extension}`;
      await this.localAdapter.write(`${dedupFolder}/${existingName}`, existingData);
      await this.localAdapter.delete(localFilePath);
    } catch {}

    const newName = `${baseName}_v2.${extension}`;
    await this.localAdapter.write(`${dedupFolder}/${newName}`, data);
    await this.webAdapter.delete(sourcePath);

    const manifest = {
      originalName: fileName,
      createdAt: new Date().toISOString(),
      versions: [
        { name: existingName, source: 'local', date: new Date().toISOString() },
        { name: newName, source: 'web', date: new Date().toISOString() }
      ],
      deduplicated: true
    };
    await this.localAdapter.writeJSON(`${dedupFolder}/manifest.json`, manifest);

    return {
      success: true,
      sourcePath,
      targetPath: dedupFolder,
      action: 'deduplicated',
      message: `Fichier dédupliqué dans ${dedupFolder}`,
      targetFiles: [existingName, newName].filter(Boolean)
    };
  }

  private async logFileSync(stats: { copied: number; deduplicated: number; errors: number; total: number; purged: number }): Promise<void> {
    const entry: SyncFileLogEntry = {
      id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      timestamp: new Date().toISOString(),
      ...stats
    };
    try {
      const existing = await this.localAdapter.readJSON<{ fileSyncs: SyncFileLogEntry[] }>('system/sync-files-log.json') || { fileSyncs: [] as SyncFileLogEntry[] };
      existing.fileSyncs.push(entry);
      if (existing.fileSyncs.length > 100) existing.fileSyncs = existing.fileSyncs.slice(-100);
      await this.localAdapter.writeJSON('system/sync-files-log.json', existing);
    } catch (error) {
      // Silently ignore write failures (e.g. read-only .data/ reference)
      console.warn('⚠️ Impossible de journaliser la sync fichiers:', error instanceof Error ? error.message : error);
    }
  }
}

export interface SyncFileResult {
  success: boolean;
  sourcePath: string;
  targetPath: string;
  action: 'copied' | 'deduplicated' | 'skipped' | 'error';
  message: string;
  targetFiles?: string[];
}

export interface SyncFilesResult {
  success: boolean;
  results: SyncFileResult[];
  total: number;
  copied: number;
  deduplicated: number;
  errors: number;
  purged: number;
  message?: string;
  duration?: number;
}