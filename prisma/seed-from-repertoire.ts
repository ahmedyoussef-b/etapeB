// prisma/seed-from-repertoire.ts
import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { promises as fs } from 'node:fs';
import * as fsSync from 'node:fs';
import type { Dirent } from 'node:fs';
import * as nodePath from 'node:path';

// ============================================================
// SEED FILE SYSTEM (in-memory override for bundled .data)
// ============================================================

export interface SeedFile {
  path: string;
  content: string;
  size: number;
}

class MemoryFileSystem {
  private readonly dirs = new Map<string, string[]>();
  private readonly files = new Map<string, SeedFile>();

  constructor(files: SeedFile[]) {
    for (const file of files) {
      this.files.set(file.path, file);
      const parts = file.path.split('/');
      for (let i = 0; i < parts.length - 1; i++) {
        const parentDir = parts.slice(0, i + 1).join('/');
        const childName = parts[i + 1];
        if (!this.dirs.has(parentDir)) {
          this.dirs.set(parentDir, []);
        }
        if (!this.dirs.get(parentDir)!.includes(childName)) {
          this.dirs.get(parentDir)!.push(childName);
        }
      }
    }
  }

  readdir(dirPath: string, options?: { withFileTypes?: boolean }): string[] | Dirent[] {
    const normalized = dirPath.replace(/\\/g, '/').replace(/\/+$/, '');
    const names = this.dirs.has(normalized) ? [...this.dirs.get(normalized)!] : [];
    if (options?.withFileTypes) {
      return names.map(name => ({
        name,
        isDirectory: () => this.isDirectory(`${normalized}/${name}`),
        isFile: () => !this.isDirectory(`${normalized}/${name}`),
        isSymbolicLink: () => false,
        isBlockDevice: () => false,
        isCharacterDevice: () => false,
        isSocket: () => false,
        isFIFO: () => false,
      })) as Dirent[];
    }
    return names;
  }

  isDirectory(path: string): boolean {
    const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');
    return this.dirs.has(normalized);
  }

  readFile(filePath: string): Buffer {
    const normalized = filePath.replace(/\\/g, '/').replace(/^\.\//, '');
    const file = this.files.get(normalized);
    if (file) return Buffer.from(file.content, 'utf-8');
    throw new Error(`File not found in seed: ${filePath}`);
  }

  stat(filePath: string): { size: number; isFile(): boolean; isDirectory(): boolean } {
    const normalized = filePath.replace(/\\/g, '/').replace(/^\.\//, '');
    const file = this.files.get(normalized);
    if (file) {
      return { size: file.size, isFile: () => true, isDirectory: () => false };
    }
    if (this.dirs.has(normalized)) {
      return { size: 0, isFile: () => false, isDirectory: () => true };
    }
    throw new Error(`Path not found in seed: ${filePath}`);
  }

  accessSync(filePath: string): void {
    const normalized = filePath.replace(/\\/g, '/').replace(/^\.\//, '');
    if (this.files.has(normalized)) return;
    throw new Error(`Path not found in seed: ${filePath}`);
  }
}

let _memoryFs: MemoryFileSystem | null = null;

export function setSeedFiles(files: SeedFile[]) {
  _memoryFs = new MemoryFileSystem(files);
}

export function clearSeedFiles() {
  _memoryFs = null;
}

async function _readdir(path: string, options: { withFileTypes: true }): Promise<Dirent[]>;
async function _readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[]>;
async function _readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | Dirent[]> {
  if (_memoryFs) {
    const names = _memoryFs.readdir(path);
    if (options?.withFileTypes) {
      return names.map(name => ({
        name,
        isDirectory: () => _memoryFs!.isDirectory(`${path}/${name}`),
        isFile: () => !_memoryFs!.isDirectory(`${path}/${name}`),
        isSymbolicLink: () => false,
        isBlockDevice: () => false,
        isCharacterDevice: () => false,
        isSocket: () => false,
        isFIFO: () => false,
      })) as Dirent[];
    }
    return names;
  }
  return fs.readdir(path, options as any);
}

async function _readFile(path: string, encoding: 'utf-8' | 'utf8'): Promise<string>;
async function _readFile(path: string, encoding?: string): Promise<any>;
async function _readFile(path: string, encoding?: string): Promise<Buffer | string> {
  if (_memoryFs) {
    const buf = _memoryFs.readFile(path);
    return encoding === 'utf-8' || encoding === 'utf8' ? buf.toString('utf-8') : Buffer.from(buf.buffer as ArrayBuffer, buf.byteOffset, buf.byteLength) as any;
  }
  return fs.readFile(path, encoding as any);
}

async function _stat(path: string): Promise<any> {
  if (_memoryFs) return _memoryFs.stat(path);
  return fs.stat(path);
}

function _accessSync(path: string): void {
  if (_memoryFs) return _memoryFs.accessSync(path);
  return fsSync.accessSync(path);
}

// ============================================================
// TYPES
// ============================================================

interface RepertoireEntry {
  path: string;
  name: string;
  type: 'directory' | 'file';
  size?: number;
  children?: RepertoireEntry[];
}

interface RepertoireRoot {
  path: string;
  name: string;
  type: 'directory';
  children: RepertoireEntry[];
}

interface BlockMeta {
  libelle?: string;
  type?: string;
  
}

interface EquipmentMeta {
  libelle?: string;
  blocCode?: string;
  blockCode?: string;
  type?: string;
  subsystemCode?: string;
  metadata?: Record<string, unknown>;
}

interface GroupMeta {
  libelle?: string;
  code?: string;
}

interface GroupEquipmentMeta {
  libelle?: string;
  blocCode?: string;
  metadata?: Record<string, unknown>;
}

interface UserMeta {
  id?: string;
  email?: string;
  name?: string;
  role?: string;
  blockId?: string;
  team?: string;
  equipe?: string;
  password?: string;
  [key: string]: unknown;
}

interface ProcedureMeta {
  id?: string;
  code?: string;
  title?: string;
  name?: string;
  description?: string;
  category?: string;
  priority?: string;
  status?: string;
  estimatedTimeMinutes?: number;
  steps?: unknown[];
  metadata?: Record<string, unknown>;
  equipmentCode?: string;
  createdById?: string;
  requiredRoles?: string[];
  [key: string]: unknown;
}

interface HumanResourceMeta {
  id?: string;
  name?: string;
  team?: string;
  photoUrl?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

interface TeamMeta {
  id?: string;
  name?: string;
  members?: unknown[];
  leader?: string;
  [key: string]: unknown;
}

// ============================================================
// LOAD DATA
// ============================================================

async function loadRepertoireData(): Promise<RepertoireRoot> {
  const rootDir = nodePath.resolve(process.cwd(), '.data');
  return await buildRepertoireTree(rootDir, '.data');
}

async function buildRepertoireTree(absDir: string, relDir: string): Promise<RepertoireRoot> {
  const entries: RepertoireEntry[] = [];
  let dirents: Dirent[];
  try {
    dirents = (await _readdir(absDir, { withFileTypes: true })) as Dirent[];
  } catch {
    return { path: relDir, name: relDir, type: 'directory', children: [] };
  }
  for (const d of dirents) {
    if (d.name.startsWith('.')) continue;
    if (d.isDirectory()) {
      const child = await buildRepertoireTree(nodePath.join(absDir, d.name), `${relDir}/${d.name}`);
      entries.push(child);
    } else {
      if (d.name === 'data_repertoire.json') continue;
      const stat = await _stat(nodePath.join(absDir, d.name));
      entries.push({ path: `${relDir}/${d.name}`, name: d.name, type: 'file', size: stat.size });
    }
  }
  entries.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type.localeCompare(b.type)));
  return { path: relDir, name: nodePath.basename(relDir), type: 'directory', children: entries };
}

function findChild(children: RepertoireEntry[], name: string): RepertoireEntry | undefined {
  return children.find(c => c.name === name);
}

// ============================================================
// SYNC BLOCKS
// ============================================================

async function syncBlocks(root: RepertoireRoot, prisma: PrismaClient) {
  const centraleDir = findChild(root.children, 'Centrale');
  if (!centraleDir || !centraleDir.children) {
    console.error('❌ Dossier Centrale introuvable dans repertoires-data.json');
    return;
  }

  const blockNames = centraleDir.children
    .filter(c => c.type === 'directory')
    .map(c => c.name);

  console.log(`📦 Synchronisation des blocs: ${blockNames.join(', ')}`);

  for (const blockName of blockNames) {
    const blockDir = centraleDir.children!.find(c => c.name === blockName)!;
    const blockMetaPath = nodePath.join(process.cwd(), '.data', 'Centrale', blockName, '.meta.json');

     let blockLibelle = `Bloc ${blockName}`;
     let blockType = 'centrale';
     try {
       const metaRaw = await _readFile(blockMetaPath, 'utf-8');
       let content = metaRaw;
       if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
       const meta = JSON.parse(content) as BlockMeta;
       if (meta.libelle) blockLibelle = meta.libelle;
       if (meta.type) blockType = meta.type.toUpperCase();
     } catch {
       // Ignorer — utiliser la valeur par défaut
     }

     await prisma.block.upsert({
       where: { code: blockName },
       update: { libelle: blockLibelle, type: blockType },
       create: {
         code: blockName,
         libelle: blockLibelle,
         type: blockType,
         syncState: 'local_only'
       }
     });

    const equipments = blockDir.children?.filter(c => c.type === 'directory') ?? [];
    console.log(`  🔧 Bloc ${blockName}: ${equipments.length} entrées`);

    for (const eq of equipments) {
      const eqMetaPath = nodePath.join(process.cwd(), '.data', 'Centrale', blockName, eq.name, '.meta.json');
      let eqLibelle = eq.name;
      let eqType = 'sous_centrale';
      let eqMetadata: Prisma.InputJsonValue | (typeof Prisma.JsonNull) = Prisma.JsonNull;

      try {
        const metaRaw = await _readFile(eqMetaPath, 'utf-8');
        let content = metaRaw;
        if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
        const meta = JSON.parse(content) as EquipmentMeta;
        if (meta.libelle) eqLibelle = meta.libelle;
        if (meta.type) eqType = meta.type.toUpperCase();
        if (meta.metadata) {
          eqMetadata = meta.metadata as Prisma.InputJsonValue;
        } else {
          const rest = Object.fromEntries(
            Object.entries(meta as Record<string, unknown>).filter(([k]) => k !== 'id' && k !== 'type' && k !== 'subsystemCode')
          );
          eqMetadata = Object.keys(rest).length > 0 ? (rest as Prisma.InputJsonObject) : Prisma.JsonNull;
        }
      } catch {
        // Ignorer — utiliser les valeurs par défaut
      }

      // If it's a subsystem, create it AND process nested equipment
      if (eqType === 'SUBSYSTEM' || eqType === 'SOUS_CENTRALE') {
        const subsystemName = eq.name;
        console.log(`    ⚙️ Subsystem ${subsystemName} — synchronisation des équipements imbriqués`);

        // Create/update the subsystem itself as an Equipment record
        const existingSubsystemList = await prisma.equipment.findMany({
          where: { code: subsystemName, blocCode: blockName, subsystemCode: null },
          take: 1
        });
        const existingSubsystem = existingSubsystemList[0] || null;
        if (existingSubsystem) {
          await prisma.equipment.update({
            where: { id: existingSubsystem.id },
            data: {
              libelle: eqLibelle,
              type: eqType,
              blocCode: blockName,
              subsystemCode: null,
              syncState: 'local_only',
              metadata: eqMetadata
            }
          });
        } else {
          await prisma.equipment.create({
            data: {
              code: subsystemName,
              libelle: eqLibelle,
              type: eqType,
              blocCode: blockName,
              subsystemCode: null,
              syncState: 'local_only',
              metadata: eqMetadata
            }
          });
        }

        // Process nested equipment (only directories with .meta.json)
        const nestedEquipments = eq.children?.filter(c => {
          if (c.type !== 'directory') return false;
          const metaPath = nodePath.join(process.cwd(), '.data', 'Centrale', blockName, subsystemName, c.name, '.meta.json');
          try {
            _accessSync(metaPath);
            return true;
          } catch {
            return false;
          }
        }) ?? [];
        for (const nestedEq of nestedEquipments) {
          const nestedMetaPath = nodePath.join(process.cwd(), '.data', 'Centrale', blockName, subsystemName, nestedEq.name, '.meta.json');
          let nestedLibelle = nestedEq.name;
          let nestedType = 'EQUIPMENT';
          let nestedMetadata: Prisma.InputJsonValue | (typeof Prisma.JsonNull) = Prisma.JsonNull;

          try {
            const metaRaw = await _readFile(nestedMetaPath, 'utf-8');
            let content = metaRaw;
            if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
            const meta = JSON.parse(content) as EquipmentMeta;
            if (meta.libelle) nestedLibelle = meta.libelle;
            if (meta.type) nestedType = meta.type.toUpperCase();
            if (meta.metadata) {
              nestedMetadata = meta.metadata as Prisma.InputJsonValue;
            } else {
              const rest = Object.fromEntries(
                Object.entries(meta as Record<string, unknown>).filter(([k]) => k !== 'id')
              );
              nestedMetadata = Object.keys(rest).length > 0 ? (rest as Prisma.InputJsonObject) : Prisma.JsonNull;
            }
          } catch {
            // Ignorer — utiliser les valeurs par défaut
          }

          const existingNestedList = await prisma.equipment.findMany({
            where: { code: nestedEq.name, blocCode: blockName, subsystemCode: subsystemName },
            take: 1
          });
          const existingNested = existingNestedList[0] || null;
          if (existingNested) {
            await prisma.equipment.update({
              where: { id: existingNested.id },
              data: {
                libelle: nestedLibelle,
                type: nestedType,
                blocCode: blockName,
                subsystemCode: subsystemName,
                syncState: 'local_only',
                metadata: nestedMetadata
              }
            });
          } else {
            await prisma.equipment.create({
              data: {
                code: nestedEq.name,
                libelle: nestedLibelle,
                type: nestedType,
                blocCode: blockName,
                subsystemCode: subsystemName,
                syncState: 'local_only',
                metadata: nestedMetadata
              }
            });
          }
        }
        console.log(`    ⏭️ ${subsystemName} — ${nestedEquipments.length} équipement(s) imbriqué(s)`);
        continue;
      }

      console.log(`  📝 Création équipement: ${eq.name} (${eqType})`);
      // Upsert equipment (subsystemCode=null means direct under block)
      const existingEqList = await prisma.equipment.findMany({
        where: { code: eq.name, blocCode: blockName, subsystemCode: null },
        take: 1
      });
      const existingEq = existingEqList[0] || null;
      if (existingEq) {
        await prisma.equipment.update({
          where: { id: existingEq.id },
          data: {
            libelle: eqLibelle,
            type: eqType,
            blocCode: blockName,
            subsystemCode: null,
            syncState: 'local_only',
            metadata: eqMetadata
          }
        });
      } else {
        await prisma.equipment.create({
          data: {
            code: eq.name,
            libelle: eqLibelle,
            type: eqType,
            blocCode: blockName,
            subsystemCode: null,
            syncState: 'local_only',
            metadata: eqMetadata
          }
        });
      }
    }
  }

  console.log(`✅ ${blockNames.length} blocs synchronisés`);
}

// ============================================================
// SYNC GROUPS
// ============================================================

async function syncGroups(root: RepertoireRoot, prisma: PrismaClient) {
  const groupDir = findChild(root.children, 'Groupes');
  if (!groupDir || !groupDir.children) {
    console.error('❌ Dossier Groupes introuvable dans repertoires-data.json');
    return;
  }

  const groups = groupDir.children.filter(c => c.type === 'directory');
  console.log(`👥 Synchronisation des groupes: ${groups.map(g => g.name).join(', ')}`);

  for (const group of groups) {
    const groupMetaPath = nodePath.join(process.cwd(), '.data', 'Groupes', group.name, '.meta.json');
    let groupLibelle = group.name;

    try {
       const metaRaw = await _readFile(groupMetaPath, 'utf-8');
       let content = metaRaw;
       if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
       const meta = JSON.parse(content) as GroupMeta;
       if (meta.libelle) groupLibelle = meta.libelle;
     } catch {
      const existingByLibelleList = await prisma.group.findMany({ where: { libelle: group.name }, take: 1 });
      const existingByLibelle = existingByLibelleList[0] || null;
      if (existingByLibelle) groupLibelle = existingByLibelle.libelle;
    }

    const groupCode = toGroupCode(groupLibelle);

    await prisma.group.upsert({
      where: { code: groupCode },
      update: { libelle: groupLibelle },
      create: {
        code: groupCode,
        libelle: groupLibelle,
        type: 'groupe',
        syncState: 'local_only'
      }
    });

    const groupEquipments = group.children?.filter(c => c.type === 'directory') ?? [];

    for (const geq of groupEquipments) {
      const geqMetaPath = nodePath.join(process.cwd(), '.data', 'Groupes', group.name, geq.name, '.meta.json');
      let geqLibelle = geq.name;
      let geqMetadata: Prisma.InputJsonValue | (typeof Prisma.JsonNull) = Prisma.JsonNull;
      let blocCode: string | null = null;

      try {
        const metaRaw = await _readFile(geqMetaPath, 'utf-8');
        let content = metaRaw;
        if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
        const meta = JSON.parse(content) as GroupEquipmentMeta;
        if (meta.libelle) geqLibelle = meta.libelle;
        if (meta.blocCode) blocCode = meta.blocCode;
        if (meta.metadata) {
          geqMetadata = meta.metadata as Prisma.InputJsonValue;
        } else {
          const rest = Object.fromEntries(
            Object.entries(meta as Record<string, unknown>).filter(([k]) => k !== 'id')
          );
          geqMetadata = Object.keys(rest).length > 0 ? (rest as Prisma.InputJsonValue) : Prisma.JsonNull;
        }
      } catch {
        // Ignorer — utiliser les valeurs par défaut
      }

      await prisma.groupEquipment.upsert({
        where: { code_groupeCode: { code: geq.name, groupeCode: groupCode } },
        update: {
          libelle: geqLibelle,
          groupeCode: groupCode,
          blocCode,
          metadata: geqMetadata
        },
        create: {
          code: geq.name,
          libelle: geqLibelle,
          type: 'groupe',
          groupeCode: groupCode,
          blocCode,
          syncState: 'local_only',
          metadata: geqMetadata
        }
      });
    }
  }

  console.log(`✅ ${groups.length} groupes synchronisés`);
}

function toGroupCode(libelle: string): string {
  return libelle.replace(/\s/g, '_').toUpperCase();
}

// ============================================================
// DEDUPE GROUPS
// ============================================================

async function dedupeGroups(prisma: PrismaClient) {
  const groups = await prisma.group.findMany({
    select: { id: true, code: true, libelle: true }
  });

  const byLibelle = new Map<string, { code: string; id: string; libelle: string }[]>();
  for (const g of groups) {
    const arr = byLibelle.get(g.libelle) ?? [];
    arr.push(g);
    byLibelle.set(g.libelle, arr);
  }

  let removed = 0;
  // ✅ Correction : Array.from pour l'itération
  const entries = Array.from(byLibelle.entries());
  for (const [libelle, rows] of entries) {
    if (rows.length <= 1) continue;

    const canonicalCode = toGroupCode(libelle);
    let keep = rows.find(r => r.code === canonicalCode);
    if (!keep) {
      keep = rows[0];
      await prisma.group.update({ where: { id: keep.id }, data: { code: canonicalCode } });
    }

    const orphans = rows.filter(r => r.id !== keep!.id);
    if (orphans.length) {
      const orphanCodes = orphans.map(o => o.code);

      const orphanGeqs = await prisma.groupEquipment.findMany({
        where: { groupeCode: { in: orphanCodes } },
        select: { code: true, groupeCode: true },
      });
      const orphanGeqCodes = orphanGeqs.map(g => g.code);

      const existingCanonicalGeqs = await prisma.groupEquipment.findMany({
        where: {
          groupeCode: canonicalCode,
          code: { in: orphanGeqCodes },
        },
        select: { id: true },
      });
      if (existingCanonicalGeqs.length) {
        await prisma.groupEquipment.deleteMany({
          where: { id: { in: existingCanonicalGeqs.map(g => g.id) } },
        });
      }

      await prisma.groupEquipment.updateMany({
        where: { groupeCode: { in: orphanCodes } },
        data: { groupeCode: canonicalCode }
      });
      await prisma.equipment.updateMany({
        where: { parentId: { in: orphanCodes } },
        data: { parentId: null }
      });
      await prisma.group.deleteMany({ where: { id: { in: orphans.map(o => o.id) } } });
      removed += orphans.length;
    }
  }

  if (removed) console.log(`🔍 Groupes dédupliqués : ${removed} doublons supprimés`);
}

// ============================================================
// SYNC DOCUMENTS
// ============================================================

async function syncDocumentsRecursive(dir: RepertoireEntry, prefix: string, prisma: PrismaClient) {
  if (!dir.children) return;

  for (const child of dir.children) {
    if (child.type === 'file' && !child.name.startsWith('.')) {
      const filePath = nodePath.join(process.cwd(), '.data', prefix, child.name);
      const relativePath = `${prefix}/${child.name}`;

      try {
        const data = await _readFile(filePath);
        const mimeType = getMimeType(child.name);

        await prisma.document.upsert({
          where: { path: relativePath },
          update: {
            filename: child.name,
            size: child.size ?? data.length,
            mimeType,
            data
          },
          create: {
            filename: child.name,
            path: relativePath,
            mimeType,
            size: child.size ?? data.length,
            data
          }
        });
      } catch (err) {
        console.warn(`  ⚠️ Impossible de lire ${filePath}:`, err);
      }
    } else if (child.type === 'directory') {
      await syncDocumentsRecursive(child, `${prefix}/${child.name}`, prisma);
    }
  }
}

async function syncDocuments(root: RepertoireRoot, prisma: PrismaClient) {
  console.log('📄 Synchronisation des documents...');

  const documentDirs = [
    { dir: findChild(root.children, 'bank'), prefix: 'bank' },
    { dir: findChild(root.children, 'documents'), prefix: 'documents' },
    { dir: findChild(root.children, 'system'), prefix: 'system' }
  ];

  for (const { dir, prefix } of documentDirs) {
    if (!dir || !dir.children) continue;

    if (prefix === 'system') {
      await syncDocumentsRecursive(dir, prefix, prisma);
    } else {
      for (const file of dir.children) {
        if (file.type !== 'file') continue;

        const filePath = nodePath.join(process.cwd(), '.data', prefix, file.name);
        const relativePath = `${prefix}/${file.name}`;

        try {
          const data = await _readFile(filePath);
          const mimeType = getMimeType(file.name);

          await prisma.document.upsert({
            where: { path: relativePath },
            update: {
              filename: file.name,
              size: file.size ?? data.length,
              mimeType,
              data
            },
            create: {
              filename: file.name,
              path: relativePath,
              mimeType,
              size: file.size ?? data.length,
              data
            }
          });
        } catch (err) {
          console.warn(`  ⚠️ Impossible de lire ${filePath}:`, err);
        }
      }
    }
  }

  await syncBinaryFiles(root, prisma);

  console.log('✅ Documents synchronisés');
}

const BINARY_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp',
  'pdf', 'txt', 'csv', 'xlsx', 'doc', 'docx', 'pptx',
  'zip', 'tar', 'gz', '7z',
  'mp3', 'mp4', 'avi', 'mov', 'wav', 'flac', 'mkv'
]);

const BINARY_DIRECTORIES = new Set([
  'registry/items',
  'registry/ressources humaines',
  'ressources humaines'
]);

async function syncBinaryFiles(root: RepertoireRoot, prisma: PrismaClient) {
  console.log('🖼️ Synchronisation des fichiers binaires...');

  const walk = async (dir: RepertoireEntry, prefix: string) => {
    if (!dir.children) return;

    for (const child of dir.children) {
      const fullPrefix = prefix ? `${prefix}/${child.name}` : child.name;

      if (child.type === 'file' && !child.name.startsWith('.')) {
        const ext = child.name.split('.').pop()?.toLowerCase();
        if (!ext || !BINARY_EXTENSIONS.has(ext)) continue;

        const filePath = nodePath.join(process.cwd(), '.data', fullPrefix);
        const relativePath = fullPrefix;

        try {
          const data = await _readFile(filePath);
          const mimeType = getMimeType(child.name);

          await prisma.document.upsert({
            where: { path: relativePath },
            update: {
              filename: child.name,
              size: child.size ?? data.length,
              mimeType,
              data
            },
            create: {
              filename: child.name,
              path: relativePath,
              mimeType,
              size: child.size ?? data.length,
              data
            }
          });
        } catch (err) {
          console.warn(`  ⚠️ Impossible de lire ${filePath}:`, err);
        }
      } else if (child.type === 'directory') {
        await walk(child, fullPrefix);
      }
    }
  };

  const shouldScan = (entry: RepertoireEntry, prefix: string): boolean => {
    if (prefix === '') return true;
    return Array.from(BINARY_DIRECTORIES).some(dir => prefix === dir || prefix.startsWith(`${dir}/`));
  };

  const scan = async (entry: RepertoireEntry, prefix: string) => {
    if (!shouldScan(entry, prefix)) return;
    await walk(entry, prefix);
  };

  await scan(root, '');

  console.log('✅ Fichiers binaires synchronisés');
}

function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'pdf':
      return 'application/pdf';
    case 'txt':
      return 'text/plain';
    case 'csv':
      return 'text/csv';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'doc':
      return 'application/msword';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    default:
      return 'application/octet-stream';
  }
}

// ============================================================
// SYNC MIRROR REPERTOIRE
// ============================================================

async function syncMirrorRepertoire(root: RepertoireRoot, prisma: PrismaClient) {
  console.log('🪞 Synchronisation du mirror_repertoire...');

  const centraleDir = findChild(root.children, 'Centrale');
  const blocks = centraleDir?.children?.filter(c => c.type === 'directory').map(c => c.name) ?? [];

  const groupDir = findChild(root.children, 'Groupes');
  const groups = groupDir?.children?.filter(c => c.type === 'directory').map(c => c.name) ?? [];

  await prisma.mirrorRepertoire.upsert({
    where: { id: 'mirror' },
    update: {
      blocks: blocks as Prisma.InputJsonValue,
      groups: groups as Prisma.InputJsonValue,
      lastSynced: new Date()
    },
    create: {
      id: 'mirror',
      version: '1.0.0',
      structure: 'industrial',
      blocks: blocks as Prisma.InputJsonValue,
      groups: groups as Prisma.InputJsonValue,
      lastSynced: new Date()
    }
  });

  console.log('✅ Mirror repertoire synchronisé');
}

// ============================================================
// SYNC INDEXES
// ============================================================

async function syncIndexes(root: RepertoireRoot, prisma: PrismaClient) {
  console.log('📊 Synchronisation des indexes...');

  // Determine which index files exist in .data/indexes/
  const indexesDir = findChild(root.children, 'indexes');
  const dataIndexFiles = indexesDir?.children?.filter(c => c.type === 'file').map(c => c.name.replace('.json', '')) ?? [];
  const desiredTypes = new Set(dataIndexFiles);

  // Internal indexes (always kept)
  const blockRecords = await prisma.block.findMany();
  await prisma.indexRecord.upsert({
    where: { type: 'blocks' },
    update: {
      data: { items: blockRecords.map(b => ({ id: b.code, name: b.libelle, code: b.code })), total: blockRecords.length } as Prisma.InputJsonValue,
      total: blockRecords.length
    },
    create: {
      type: 'blocks',
      data: { items: blockRecords.map(b => ({ id: b.code, name: b.libelle, code: b.code })), total: blockRecords.length } as Prisma.InputJsonValue,
      total: blockRecords.length
    }
  });

  const equipmentRecords = await prisma.equipment.findMany();
  await prisma.indexRecord.upsert({
    where: { type: 'equipment' },
    update: {
      data: { items: equipmentRecords.map(e => ({ id: `${e.blocCode}/${e.subsystemCode ?? ''}/${e.code}`.replace(/\/+$/, '').replace(/\/\//g, '/'), name: e.libelle, code: e.code, block: e.blocCode, subsystem: e.subsystemCode ?? null, type: e.type })), total: equipmentRecords.length } as Prisma.InputJsonValue,
      total: equipmentRecords.length
    },
    create: {
      type: 'equipment',
       data: { items: equipmentRecords.map(e => ({ id: `${e.blocCode}/${e.subsystemCode ?? ''}/${e.code}`.replace(/\/+$/, '').replace(/\/\//g, '/'), name: e.libelle, code: e.code, block: e.blocCode, subsystem: e.subsystemCode ?? null, type: e.type })), total: equipmentRecords.length } as Prisma.InputJsonValue,
      total: equipmentRecords.length
    }
  });

  const groupRecords = await prisma.group.findMany();
  await prisma.indexRecord.upsert({
    where: { type: 'groups' },
    update: {
      data: { items: groupRecords.map(g => ({ id: g.code, name: g.libelle, code: g.code })), total: groupRecords.length } as Prisma.InputJsonValue,
      total: groupRecords.length
    },
    create: {
      type: 'groups',
      data: { items: groupRecords.map(g => ({ id: g.code, name: g.libelle, code: g.code })), total: groupRecords.length } as Prisma.InputJsonValue,
      total: groupRecords.length
    }
  });

  const groupEquipmentRecords = await prisma.groupEquipment.findMany();
  await prisma.indexRecord.upsert({
    where: { type: 'group_equipments' },
    update: {
      data: { items: groupEquipmentRecords.map(ge => ({ id: ge.code, name: ge.libelle, code: ge.code, group: ge.groupeCode })), total: groupEquipmentRecords.length } as Prisma.InputJsonValue,
      total: groupEquipmentRecords.length
    },
    create: {
      type: 'group_equipments',
      data: { items: groupEquipmentRecords.map(ge => ({ id: ge.code, name: ge.libelle, code: ge.code, group: ge.groupeCode })), total: groupEquipmentRecords.length } as Prisma.InputJsonValue,
      total: groupEquipmentRecords.length
    }
  });

  // Visible indexes (only those that exist in .data/indexes/)
  for (const type of ['procedures', 'teams', 'users']) {
    if (desiredTypes.has(type)) {
      await prisma.indexRecord.upsert({
        where: { type },
        update: { data: { items: [], total: 0 } as Prisma.InputJsonValue, total: 0 },
        create: { type, data: { items: [], total: 0 } as Prisma.InputJsonValue, total: 0 }
      });
    }
  }

  // Remove stale visible indexes that no longer exist in .data
  const staleTypes = ['procedures', 'teams', 'users', 'blocks', 'equipment', 'groups', 'group_equipments']
    .filter(t => !desiredTypes.has(t) && !['blocks', 'equipment', 'groups', 'group_equipments'].includes(t));
  for (const type of staleTypes) {
    await prisma.indexRecord.delete({ where: { type } }).catch(() => {});
  }

  console.log('✅ Indexes synchronisés');
}

// ============================================================
// SYNC REGISTRY
// ============================================================

async function syncRegistry(root: RepertoireRoot, prisma: PrismaClient) {
  console.log('🗂️ Synchronisation de registry/...');

  const registryDir = findChild(root.children, 'registry');
  if (!registryDir || !registryDir.children) {
    console.log('ℹ️ Dossier registry/ absent');
    return;
  }

  // --- registry/items/{userId}/{userId}.json ---
  const itemsDir = findChild(registryDir.children, 'items');
  if (itemsDir?.children) {
    for (const entry of itemsDir.children) {
      // Skip Q/R files (JSON arrays of {question, answer}) — handled by syncQr()
      if (entry.type === 'file') {
        const filePath = nodePath.join(process.cwd(), '.data', 'registry', 'items', entry.name);
        let parsed: unknown = null;
        try {
          const raw = await _readFile(filePath, 'utf-8');
          let content = raw;
          if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
          parsed = JSON.parse(content);
        } catch {}

        if (Array.isArray(parsed)) continue; // Q/R file, skip
        if (parsed && typeof parsed === 'object' && 'email' in parsed) {
          // Fichier JSON direct : le traiter comme un dossier singleton
          const userIdDir = entry.name.replace(/\.json$/, '');
          const meta = parsed as UserMeta;
          const data: Prisma.InputJsonValue = Object.fromEntries(
            Object.entries(meta).filter(([k]) => !['id', 'password', 'code', 'syncState', 'equipe', 'photo'].includes(k))
          ) as Prisma.InputJsonObject;
          const team = meta.equipe || meta.team || null;
          const email = meta.email ?? `${userIdDir}@unknown.local`;
          const name = meta.name ?? userIdDir;
          await prisma.user.upsert({
            where: { id: userIdDir },
            update: { ...data, id: userIdDir, email, name, team: team as string | null },
            create: { id: userIdDir, email, name, team: team as string | null, role: 'RONDIER', ...data }
          });
        }
        continue;
      }

      const userIdDir = entry.name;
      const userDirPath = nodePath.join(process.cwd(), '.data', 'registry', 'items', userIdDir);
      const jsonName = `${userIdDir}.json`;
      const metaPath = nodePath.join(userDirPath, jsonName);
      let meta: UserMeta = {};
      try {
        const raw = await _readFile(metaPath, 'utf-8');
        let content = raw;
        if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
        meta = JSON.parse(content) as UserMeta;
      } catch {
        // Ignorer
      }

      const data: Prisma.InputJsonValue = Object.fromEntries(
        Object.entries(meta).filter(([k]) => !['id', 'password', 'code', 'syncState', 'equipe', 'photo'].includes(k))
      ) as Prisma.InputJsonObject;

      const team = meta.equipe || meta.team || null;
      const email = meta.email ?? `${userIdDir}@unknown.local`;
      const name = meta.name ?? userIdDir;

      await prisma.user.upsert({
        where: { id: userIdDir },
        update: { ...data, id: userIdDir, email, name, team: team as string | null },
        create: { id: userIdDir, email, name, team: team as string | null, role: 'RONDIER', ...data }
      });
    }
  }

  // --- registry/procedures/{id}/procedure.json ---
  const proceduresDir = findChild(registryDir.children, 'procedures');
  if (proceduresDir?.children) {
    for (const procDir of proceduresDir.children.filter(c => c.type === 'directory').map(c => c.name)) {
      const procPath = nodePath.join(process.cwd(), '.data', 'registry', 'procedures', procDir, 'procedure.json');
      let meta: ProcedureMeta = {};
      try {
        const raw = await _readFile(procPath, 'utf-8');
        let content = raw;
        if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
        meta = JSON.parse(content) as ProcedureMeta;
      } catch {
        // Ignorer
      }

      const data: Prisma.InputJsonValue = Object.fromEntries(
        Object.entries(meta).filter(([k]) => !['id', 'name', 'type', 'syncState'].includes(k))
      ) as Prisma.InputJsonObject;

      await prisma.procedure.upsert({
        where: { id: procDir },
        update: { ...data, id: procDir, code: meta.code ?? procDir, title: meta.name ?? meta.title ?? procDir },
        create: { id: procDir, code: meta.code ?? procDir, title: meta.name ?? meta.title ?? procDir, category: meta.category ?? 'default', priority: meta.priority ?? 'normal', ...data }
      });
    }
  }

  // --- registry/ressources humaines/equipe {X}/{name}.json ---
  const hrDir = findChild(registryDir.children, 'ressources humaines');
  if (hrDir?.children) {
    for (const teamDir of hrDir.children.filter(c => c.type === 'directory').map(c => c.name)) {
      const teamPath = nodePath.join(process.cwd(), '.data', 'registry', 'ressources humaines', teamDir);
      const teamName = teamDir.replace('equipe ', '').trim();
      const entries = await fs.readdir(teamPath).catch(() => []);
      for (const file of entries) {
        if (!file.endsWith('.json')) continue;
        const memberPath = nodePath.join(teamPath, file);
        let meta: HumanResourceMeta = {};
        try {
          const raw = await _readFile(memberPath, 'utf-8');
          let content = raw;
          if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
          meta = JSON.parse(content) as HumanResourceMeta;
        } catch {
          // Ignorer
        }

        const name = file.replace('.json', '');
        const { photo, photoUrl, ...rest } = meta;
        const metadata = Object.fromEntries(
          Object.entries(rest).filter(([k]) => k !== 'id' && k !== 'name' && k !== 'team')
        ) as Prisma.InputJsonObject;

        const photoValue = (photoUrl ?? photo ?? null) as string | null;
        const metadataValue = Object.keys(metadata).length > 0 ? metadata : undefined;

        await prisma.humanResource.upsert({
          where: { id: `${teamName}-${name}` },
          update: { name, team: teamName, photoUrl: photoValue, metadata: metadataValue },
          create: { id: `${teamName}-${name}`, name, team: teamName, photoUrl: photoValue, metadata: metadataValue }
        });
      }
    }
  }

  console.log('✅ registry/ synchronisé');
}

// ============================================================
// SYNC Q/R
// ============================================================

async function syncQr(root: RepertoireRoot, prisma: PrismaClient) {
  console.log('❓ Synchronisation des Q/R...');

  const registryDir = findChild(root.children, 'registry');
  if (!registryDir?.children) {
    console.log('ℹ️ Dossier registry/ absent');
    return;
  }

  const itemsDir = findChild(registryDir.children, 'items');
  if (!itemsDir?.children) {
    console.log('ℹ️ Dossier registry/items/ absent');
    return;
  }

  let totalQr = 0;
  for (const entry of itemsDir.children) {
    if (entry.type !== 'file' || !entry.name.endsWith('.json')) continue;

    const filePath = nodePath.join(process.cwd(), '.data', 'registry', 'items', entry.name);
    try {
      const raw = await _readFile(filePath, 'utf-8');
      let content = raw;
      if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
      const parsed = JSON.parse(content);

      if (!Array.isArray(parsed)) continue;

      await prisma.indexRecord.upsert({
        where: { type: 'qr' },
        update: {
          data: { items: parsed, total: parsed.length } as Prisma.InputJsonValue,
          total: parsed.length
        },
        create: {
          type: 'qr',
          data: { items: parsed, total: parsed.length } as Prisma.InputJsonValue,
          total: parsed.length
        }
      });

      totalQr += parsed.length;
      console.log(`  📝 ${entry.name} : ${parsed.length} Q/R`);
    } catch (err) {
      console.warn(`  ⚠️ Impossible de lire ${filePath}:`, err);
    }
  }

  console.log(`✅ ${totalQr} Q/R synchronisées`);
}

// ============================================================
// SYNC RESSOURCES HUMAINES
// ============================================================

async function syncRessourcesHumaines(root: RepertoireRoot, prisma: PrismaClient) {
  console.log('👷 Synchronisation de ressources humaines/...');

  const rhRoot = findChild(root.children, 'ressources humaines');
  if (!rhRoot?.children) {
    console.log('ℹ️ Dossier ressources humaines/ absent');
    return;
  }

  for (const teamDir of rhRoot.children.filter(c => c.type === 'directory').map(c => c.name)) {
    const teamPath = nodePath.join(process.cwd(), '.data', 'ressources humaines', teamDir);
    const teamName = teamDir.replace('equipe ', '').trim();
    const entries = await fs.readdir(teamPath).catch(() => []);
    for (const file of entries) {
      if (!file.endsWith('.json')) continue;
      const memberPath = nodePath.join(teamPath, file);
      let meta: HumanResourceMeta = {};
      try {
        const raw = await _readFile(memberPath, 'utf-8');
        let content = raw;
        if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
        meta = JSON.parse(content) as HumanResourceMeta;
      } catch {
        // Ignorer
      }

        const name = file.replace('.json', '');
        const { photo, photoUrl, ...rest } = meta;
        const metadata = Object.fromEntries(
          Object.entries(rest).filter(([k]) => k !== 'id' && k !== 'name' && k !== 'team')
        ) as Prisma.InputJsonObject;

        const photoValue = (photoUrl ?? photo ?? null) as string | null;
        const metadataValue = Object.keys(metadata).length > 0 ? metadata : undefined;

        await prisma.humanResource.upsert({
          where: { id: `${teamName}-${name}` },
          update: { name, team: teamName, photoUrl: photoValue, metadata: metadataValue },
          create: { id: `${teamName}-${name}`, name, team: teamName, photoUrl: photoValue, metadata: metadataValue }
        });
    }
  }

  console.log('✅ ressources humaines/ synchronisé');
}

// ============================================================
// SYNC DATA
// ============================================================

async function syncData(root: RepertoireRoot, prisma: PrismaClient) {
  console.log('📁 Synchronisation de data/...');

  const dataDir = findChild(root.children, 'data');
  if (!dataDir?.children) {
    console.log('ℹ️ Dossier data/ absent');
    return;
  }

  // --- data/users/{id}/profile.json ---
  const usersDir = findChild(dataDir.children, 'users');
  if (usersDir?.children) {
    for (const userId of usersDir.children.filter(c => c.type === 'directory').map(c => c.name)) {
      const profilePath = nodePath.join(process.cwd(), '.data', 'data', 'users', userId, 'profile.json');
      let meta: UserMeta = {};
      try {
        const raw = await _readFile(profilePath, 'utf-8');
        let content = raw;
        if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
        meta = JSON.parse(content) as UserMeta;
      } catch {
        // Ignorer
      }

      const data: Prisma.InputJsonValue = Object.fromEntries(
        Object.entries(meta).filter(([k]) => k !== 'id' && k !== 'password')
      ) as Prisma.InputJsonObject;

      await prisma.user.upsert({
        where: { id: userId },
        update: { ...data, id: userId },
        create: { id: userId, email: meta.email ?? `${userId}@unknown.local`, name: meta.name ?? userId, role: 'RONDIER', ...data }
      });
    }
  }

  // --- data/teams/{id}/info.json ---
  const teamsDir = findChild(dataDir.children, 'teams');
  if (teamsDir?.children) {
    for (const teamId of teamsDir.children.filter(c => c.type === 'directory').map(c => c.name)) {
      const infoPath = nodePath.join(process.cwd(), '.data', 'data', 'teams', teamId, 'info.json');
      let meta: TeamMeta = {};
      try {
        const raw = await _readFile(infoPath, 'utf-8');
        let content = raw;
        if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
        meta = JSON.parse(content) as TeamMeta;
      } catch {
        // Ignorer
      }

      const data: Prisma.InputJsonValue = Object.fromEntries(
        Object.entries(meta).filter(([k]) => k !== 'id' && k !== 'name')
      ) as Prisma.InputJsonObject;

      await prisma.team.upsert({
        where: { id: teamId },
        update: { name: meta.name ?? teamId, ...data },
        create: { id: teamId, name: meta.name ?? teamId, ...data }
      });
    }
  }

  // --- data/procedures/{id}/metadata.json + steps.json ---
  const proceduresDir = findChild(dataDir.children, 'procedures');
  if (proceduresDir?.children) {
    for (const procId of proceduresDir.children.filter(c => c.type === 'directory').map(c => c.name)) {
      const metaPath = nodePath.join(process.cwd(), '.data', 'data', 'procedures', procId, 'metadata.json');
      const stepsPath = nodePath.join(process.cwd(), '.data', 'data', 'procedures', procId, 'steps.json');
      let meta: ProcedureMeta = {};
      let steps: unknown = null;
      try {
        const raw = await _readFile(metaPath, 'utf-8');
        let content = raw;
        if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
        meta = JSON.parse(content) as ProcedureMeta;
      } catch {
        // Ignorer
      }
      try {
        const raw = await _readFile(stepsPath, 'utf-8');
        let content = raw;
        if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
        steps = JSON.parse(content);
      } catch {
        // Ignorer
      }

      const data: Prisma.InputJsonValue = Object.fromEntries(
        Object.entries(meta).filter(([k]) => k !== 'id')
      ) as Prisma.InputJsonObject;

      await prisma.procedure.upsert({
        where: { id: procId },
        update: { ...data, steps: steps as Prisma.InputJsonValue },
        create: { id: procId, code: meta.code ?? procId, title: meta.title ?? procId, category: meta.category ?? 'default', priority: meta.priority ?? 'normal', steps: steps as Prisma.InputJsonValue, ...data }
      });
    }
  }

  console.log('✅ data/ synchronisé');
}

// ============================================================
// SYNC FROM REPERTOIRE
// ============================================================

export async function syncFromRepertoire(prisma: PrismaClient, seedFiles?: SeedFile[]) {
  if (seedFiles) {
    setSeedFiles(seedFiles);
  }
  try {
    console.log('Synchronisation BDD depuis .data/...\n');
    const root = await loadRepertoireData();

    await syncBlocks(root, prisma);
    console.log('');

    await dedupeGroups(prisma);
    await syncGroups(root, prisma);
    console.log('');

    await syncDocuments(root, prisma);
    console.log('');

    await syncMirrorRepertoire(root, prisma);
    console.log('');

    await syncIndexes(root, prisma);
    console.log('');

    await syncRegistry(root, prisma);
    console.log('');

    await syncQr(root, prisma);
    console.log('');

    await syncRessourcesHumaines(root, prisma);
    console.log('');

    await syncData(root, prisma);
    console.log('');

    const stats = {
      blocks: await prisma.block.count(),
      equipment: await prisma.equipment.count(),
      groups: await prisma.group.count(),
      groupEquipments: await prisma.groupEquipment.count(),
      documents: await prisma.document.count(),
      users: await prisma.user.count(),
      procedures: await prisma.procedure.count(),
      humanResources: await prisma.humanResource.count(),
      teams: await prisma.team.count()
    };

    console.log('📊 Statistiques finales:');
    console.log(`   - Blocs: ${stats.blocks}`);
    console.log(`   - Équipements: ${stats.equipment}`);
    console.log(`   - Groupes: ${stats.groups}`);
    console.log(`   - Équipements de groupe: ${stats.groupEquipments}`);
    console.log(`   - Documents: ${stats.documents}`);
    console.log(`   - Utilisateurs: ${stats.users}`);
    console.log(`   - Procédures: ${stats.procedures}`);
    console.log(`   - Ressources humaines: ${stats.humanResources}`);
    console.log(`   - Équipes: ${stats.teams}`);

    console.log('\n🎉 Synchronisation terminée avec succès !');
  } finally {
    if (seedFiles) {
      clearSeedFiles();
    }
  }
}