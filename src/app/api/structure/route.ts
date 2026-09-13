export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { LocalDatabaseAdapter } from '@/lib/database/local-adapter';
import { WebDatabaseAdapter } from '@/lib/database/web-adapter';
import { getAuthenticatedUser, hasPermission, unauthorizedResponse, unauthenticatedResponse } from '@/lib/api/auth-guard';
import { TreeNode, detectEntryType, isVisibleEntry } from '@/lib/database/structure-types';
import { getPrismaClient } from '@/lib/services/db';
import * as nodePath from 'node:path';
import { promises as fs } from 'node:fs';

const REPO_CONFIG_FILE = nodePath.join(process.cwd(), 'repository-config.json');

async function getActiveRepository(): Promise<string> {
  try {
    const raw = await fs.readFile(REPO_CONFIG_FILE, 'utf-8');
    const config = JSON.parse(raw) as { activeRepository?: string };
    const active = config.activeRepository || '.data';
    if (active === '.data') return '.data';
    return active.startsWith('repositories/') ? active : `repositories/${active}`;
  } catch {
    return '.data';
  }
}

interface DatabaseAdapter {
  list: (path: string) => Promise<string[]>;
  read: (path: string) => Promise<Buffer>;
  readJSON?: (path: string) => Promise<unknown>;
}

function mapWebPathToAdapter(path: string): string {
  if (path === '.data' || path === '.data/') return '.';
  if (path.startsWith('.data/')) return path.slice(6);
  return path;
}

function mapAdapterPathToWeb(path: string): string {
  if (path === '.' || path === '') return '.data';
  return `.data/${path}`;
}

async function buildExactTree(adapter: DatabaseAdapter, relativePath = '.'): Promise<TreeNode[]> {
  const entries = await adapter.list(relativePath || '.');
  const visibleEntries = entries.filter(isVisibleEntry);
  const nodes: TreeNode[] = [];

  for (const entry of visibleEntries) {
    const fullPath = relativePath === '.' || !relativePath ? entry : `${relativePath}/${entry}`;
    const entryType = await detectEntryType(adapter, fullPath);

    if (entryType === 'file') {
      nodes.push({ name: entry, path: fullPath, type: 'file', metadata: undefined });
      continue;
    }

    nodes.push({
      name: entry,
      path: fullPath,
      type: 'directory',
      children: await buildExactTree(adapter, fullPath),
      metadata: undefined
    });
  }

  nodes.sort((a, b) => {
    if (a.type === 'directory' && b.type === 'file') return -1;
    if (a.type === 'file' && b.type === 'directory') return 1;
    return a.name.localeCompare(b.name);
  });

  return nodes;
}

async function buildExactTreeFromDisk(absDir: string, relPath: string, basePath?: string): Promise<TreeNode> {
  let entries: string[];
  try {
    const base = basePath ? nodePath.resolve(process.cwd(), basePath) : nodePath.resolve(process.cwd(), '.data');
    const localAdapter = new LocalDatabaseAdapter(base);
    entries = await localAdapter.list(relPath);
  } catch {
    return { name: relPath.split('/').pop() || relPath, path: relPath, type: 'directory', children: [], metadata: { type: 'ROOT' } };
  }

  // Filtre local : on masque seulement les fichiers mirror, pas le dossier system
  const visibleEntries = entries.filter(name => {
    if (name === 'mirror_repertoire.json' || name === 'mirror.json') return false;
    return name.endsWith('.meta.json') || !name.startsWith('.');
  });
  const children: TreeNode[] = [];

  for (const entry of visibleEntries) {
    const fullPath = relPath ? `${relPath}/${entry}` : entry;
    const absEntryPath = nodePath.join(absDir, entry);

    let isDir = false;
    try {
      const s = await fs.stat(absEntryPath);
      isDir = s.isDirectory();
    } catch {
      isDir = false;
    }

    if (isDir) {
      children.push(await buildExactTreeFromDisk(absEntryPath, fullPath, basePath));
    } else {
      children.push({ name: entry, path: fullPath, type: 'file', metadata: undefined });
    }
  }

  children.sort((a, b) => {
    if (a.type === 'directory' && b.type === 'file') return -1;
    if (a.type === 'file' && b.type === 'directory') return 1;
    return a.name.localeCompare(b.name);
  });

  return {
    name: relPath.split('/').pop() || relPath,
    path: relPath,
    type: 'directory',
    children,
    metadata: { type: 'ROOT' }
  };
}

async function buildDatabaseTree(
    repositoryPath: string = '.data',
    webAdapter?: WebDatabaseAdapter
  ): Promise<TreeNode[]> {
    const prisma = getPrismaClient();

    try {
      const [blocks, equipments, groups, groupEquipments] = await Promise.all([
        prisma.block.findMany({ orderBy: { code: 'asc' } }),
        prisma.equipment.findMany({ orderBy: { code: 'asc' } }),
        prisma.group.findMany({ orderBy: { code: 'asc' } }),
        prisma.groupEquipment.findMany({ orderBy: { code: 'asc' } }),
      ]);

      const nodes: TreeNode[] = [];

      // ── Centrale/ ──────────────────────────────────────────────────────────
      const centraleNode: TreeNode = {
        name: 'Centrale',
        path: 'Centrale',
        type: 'directory',
        children: [],
        metadata: { type: 'ROOT' }
      };

      const blockMap = new Map<string, TreeNode>();
      for (const block of blocks) {
        const blockNode: TreeNode = {
          name: block.code,
          path: `Centrale/${block.code}`,
          type: 'directory',
          children: [
            {
              name: '.meta.json',
              path: `Centrale/${block.code}/.meta.json`,
              type: 'file',
              metadata: {
                type: 'BLOCK',
                id: block.id,
                code: block.code,
                libelle: block.libelle,
                createdAt: block.createdAt.toISOString(),
                updatedAt: block.updatedAt.toISOString()
              }
            }
          ],
          metadata: {
            type: 'BLOCK',
            id: block.id,
            code: block.code,
            libelle: block.libelle,
            createdAt: block.createdAt.toISOString(),
            updatedAt: block.updatedAt.toISOString()
          }
        };
        blockMap.set(block.code, blockNode);
        centraleNode.children!.push(blockNode);
      }

      // Add equipments to their blocks, organized by subsystem
      for (const block of blocks) {
        const blockNode = blockMap.get(block.code)!;
        const blockEquipments = equipments.filter(e => e.blocCode === block.code);

        // Map: subsystemCode -> [equipments with that subsystemCode]
        const subsystemMap = new Map<string, typeof blockEquipments>();
        for (const equip of blockEquipments) {
          const subsystem = equip.subsystemCode;
          if (subsystem) {
            if (!subsystemMap.has(subsystem)) subsystemMap.set(subsystem, []);
            subsystemMap.get(subsystem)!.push(equip);
          }
        }

        // Direct equipments (subsystemCode IS NULL)
        const directEquipments = blockEquipments.filter(e => !e.subsystemCode);
        const subsystemContainers = directEquipments.filter(e => e.type === 'SOUS_CENTRALE' || e.type === 'SUBSYSTEM');

        // Collect ALL unique subsystem codes: from subsystemMap keys + explicit container records
        const allSubsystemCodes = new Set<string>();
        for (const subCode of Array.from(subsystemMap.keys())) {
          if (subCode) allSubsystemCodes.add(subCode);
        }
        for (const container of subsystemContainers) {
          if (container.code) allSubsystemCodes.add(container.code);
        }

        // Regular leaf equipments: direct, not a subsystem container, not a subsystem code itself
        const regularEquipments = directEquipments.filter(
          e => !allSubsystemCodes.has(e.code) && e.type !== 'SOUS_CENTRALE' && e.type !== 'SUBSYSTEM'
        );

        // Add regular equipments (leaf directory nodes)
        for (const equip of regularEquipments) {
          const equipNode: TreeNode = {
            name: equip.code,
            path: `Centrale/${block.code}/${equip.code}`,
            type: 'directory',
            children: [
              {
                name: '.meta.json',
                path: `Centrale/${block.code}/${equip.code}/.meta.json`,
                type: 'file',
                metadata: {
                  type: 'EQUIPMENT',
                  id: equip.id,
                  code: equip.code,
                  libelle: equip.libelle,
                  blocCode: equip.blocCode,
                  subsystemCode: equip.subsystemCode,
                  createdAt: equip.createdAt.toISOString(),
                  updatedAt: equip.updatedAt.toISOString()
                }
              }
            ],
            metadata: {
              type: 'EQUIPMENT',
              id: equip.id,
              code: equip.code,
              libelle: equip.libelle,
              blocCode: equip.blocCode,
              subsystemCode: equip.subsystemCode,
              createdAt: equip.createdAt.toISOString(),
              updatedAt: equip.updatedAt.toISOString()
            }
          };
          blockNode.children!.push(equipNode);
        }

        // Add ALL subsystem containers (iterate allSubsystemCodes so nothing is missed)
        for (const subCode of Array.from(allSubsystemCodes).sort()) {
          const container = directEquipments.find(e => e.code === subCode);
          const subsystemNode: TreeNode = {
            name: subCode,
            path: `Centrale/${block.code}/${subCode}`,
            type: 'directory',
            children: [
              {
                name: '.meta.json',
                path: `Centrale/${block.code}/${subCode}/.meta.json`,
                type: 'file',
                metadata: {
                  type: 'SUBSYSTEM',
                  code: subCode,
                  libelle: container?.libelle || subCode,
                  blocCode: block.code,
                  createdAt: container?.createdAt?.toISOString() || block.createdAt.toISOString(),
                  updatedAt: container?.updatedAt?.toISOString() || block.updatedAt.toISOString()
                }
              }
            ],
            metadata: {
              type: 'SUBSYSTEM',
              code: subCode,
              libelle: container?.libelle || subCode,
              blocCode: block.code,
              createdAt: container?.createdAt?.toISOString() || block.createdAt.toISOString(),
              updatedAt: container?.updatedAt?.toISOString() || block.updatedAt.toISOString()
            }
          };

          // Add nested equipment under this subsystem
          const nestedEquips = subsystemMap.get(subCode) || [];
          for (const equip of nestedEquips) {
            const equipNode: TreeNode = {
              name: equip.code,
              path: `Centrale/${block.code}/${subCode}/${equip.code}`,
              type: 'directory',
              children: [
                {
                  name: '.meta.json',
                  path: `Centrale/${block.code}/${subCode}/${equip.code}/.meta.json`,
                  type: 'file',
                  metadata: {
                    type: 'EQUIPMENT',
                    id: equip.id,
                    code: equip.code,
                    libelle: equip.libelle,
                    blocCode: equip.blocCode,
                    subsystemCode: equip.subsystemCode,
                    createdAt: equip.createdAt.toISOString(),
                    updatedAt: equip.updatedAt.toISOString()
                  }
                }
              ],
              metadata: {
                type: 'EQUIPMENT',
                id: equip.id,
                code: equip.code,
                libelle: equip.libelle,
                blocCode: equip.blocCode,
                subsystemCode: equip.subsystemCode,
                createdAt: equip.createdAt.toISOString(),
                updatedAt: equip.updatedAt.toISOString()
              }
            };
            subsystemNode.children!.push(equipNode);
          }

          // Sort subsystem children: dirs first, then alpha
          subsystemNode.children!.sort((a, b) => {
            if (a.type === 'file' && b.type !== 'file') return 1;
            if (a.type !== 'file' && b.type === 'file') return -1;
            return a.name.localeCompare(b.name);
          });

          blockNode.children!.push(subsystemNode);
        }
      }

      // Sort children of each block
      for (const blockNode of Array.from(blockMap.values())) {
        blockNode.children!.sort((a, b) => {
          if (a.type === 'file' && b.type !== 'file') return 1;
          if (a.type !== 'file' && b.type === 'file') return -1;
          return a.name.localeCompare(b.name);
        });
      }

      nodes.push(centraleNode);

      if (centraleNode.children!.length === 0) {
        try {
          const fullCentrale = nodePath.resolve(process.cwd(), repositoryPath || '.data', 'Centrale');
          const diskCentrale = await buildExactTreeFromDisk(fullCentrale, 'Centrale', repositoryPath || '.data');
          if (diskCentrale.children && diskCentrale.children.length > 0) {
            centraleNode.children = diskCentrale.children;
          }
        } catch (e) {
          console.warn('[buildDatabaseTree] Centrale disk fallback failed:', e);
        }
      }

      // ── Groupes/ ───────────────────────────────────────────────────────────
      const groupesNode: TreeNode = {
        name: 'Groupes',
        path: 'Groupes',
        type: 'directory',
        children: [],
        metadata: { type: 'ROOT' }
      };

      // Map by both code AND libelle so groupEquipments referencing either key resolve correctly
      const groupMap = new Map<string, TreeNode>();
      const groupNodeSet = new Set<TreeNode>();

      for (const group of groups) {
        const groupNode: TreeNode = {
          name: group.code,
          path: `Groupes/${group.code}`,
          type: 'directory',
          children: [
            {
              name: '.meta.json',
              path: `Groupes/${group.code}/.meta.json`,
              type: 'file',
              metadata: {
                type: 'GROUP',
                id: group.id,
                code: group.code,
                libelle: group.libelle,
                createdAt: group.createdAt.toISOString(),
                updatedAt: group.updatedAt.toISOString()
              }
            }
          ],
          metadata: {
            type: 'GROUP',
            id: group.id,
            code: group.code,
            libelle: group.libelle,
            createdAt: group.createdAt.toISOString(),
            updatedAt: group.updatedAt.toISOString()
          }
        };
        groupMap.set(group.code, groupNode);
        if (group.libelle && group.libelle !== group.code) {
          groupMap.set(group.libelle, groupNode);
        }
        groupNodeSet.add(groupNode);
        groupesNode.children!.push(groupNode);
      }

      // Add group equipments to their groups
      for (const ge of groupEquipments) {
        let groupNode = groupMap.get(ge.groupeCode || '');
        if (!groupNode && ge.groupeCode) {
          // Try case-insensitive fallback
          for (const [key, node] of Array.from(groupMap.entries())) {
            if (key.toLowerCase() === ge.groupeCode.toLowerCase()) {
              groupNode = node;
              break;
            }
          }
        }
        if (!groupNode && ge.groupeCode) {
          // Auto-create orphan group node so no equipment is lost
          const orphan: TreeNode = {
            name: ge.groupeCode,
            path: `Groupes/${ge.groupeCode}`,
            type: 'directory',
            children: [],
            metadata: { type: 'GROUP', code: ge.groupeCode, libelle: ge.groupeCode }
          };
          groupMap.set(ge.groupeCode, orphan);
          groupNodeSet.add(orphan);
          groupesNode.children!.push(orphan);
          groupNode = orphan;
        }

        if (groupNode) {
          const geNode: TreeNode = {
            name: ge.code,
            path: `${groupNode.path}/${ge.code}`,
            type: 'directory',
            children: [
              {
                name: '.meta.json',
                path: `${groupNode.path}/${ge.code}/.meta.json`,
                type: 'file',
                metadata: {
                  type: 'GROUP_EQUIPMENT',
                  id: ge.id,
                  code: ge.code,
                  libelle: ge.libelle,
                  groupName: ge.groupeCode,
                  createdAt: ge.createdAt.toISOString(),
                  updatedAt: ge.updatedAt.toISOString()
                }
              }
            ],
            metadata: {
              type: 'GROUP_EQUIPMENT',
              id: ge.id,
              code: ge.code,
              libelle: ge.libelle,
              groupName: ge.groupeCode,
              createdAt: ge.createdAt.toISOString(),
              updatedAt: ge.updatedAt.toISOString()
            }
          };
          groupNode.children!.push(geNode);
        }
      }

      // Sort children of each group
      for (const groupNode of Array.from(groupNodeSet)) {
        groupNode.children!.sort((a: TreeNode, b: TreeNode) => {
          if (a.type === 'file' && b.type !== 'file') return 1;
          if (a.type !== 'file' && b.type === 'file') return -1;
          return a.name.localeCompare(b.name);
        });
      }

      nodes.push(groupesNode);

      if (groupesNode.children!.length === 0) {
        try {
          const fullGroupes = nodePath.resolve(process.cwd(), repositoryPath || '.data', 'Groupes');
          const diskGroupes = await buildExactTreeFromDisk(fullGroupes, 'Groupes', repositoryPath || '.data');
          if (diskGroupes.children && diskGroupes.children.length > 0) {
            groupesNode.children = diskGroupes.children;
          }
        } catch (e) {
          console.warn('[buildDatabaseTree] Groupes disk fallback failed:', e);
        }
      }

      // ── Extra root directories ─────────────────────────────────────────────
      // All 6 known dirs + any additional directories found on disk
      const extraDirs = ['bank', 'documents', 'indexes', 'registry', 'ressources humaines', 'system'];

      try {
        const repoBase = nodePath.resolve(process.cwd(), repositoryPath || '.data');
        const diskEntries = await fs.readdir(repoBase, { withFileTypes: true });
        for (const entry of diskEntries) {
          if (
            entry.isDirectory() &&
            !entry.name.startsWith('.') &&
            entry.name !== 'Centrale' &&
            entry.name !== 'Groupes' &&
            !extraDirs.includes(entry.name)
          ) {
            extraDirs.push(entry.name);
          }
        }
      } catch (e) {
        console.warn('[buildDatabaseTree] error reading disk entries:', e);
      }

      for (const dir of extraDirs) {
        if (nodes.find(n => n.name === dir)) continue;

        const dirPath = dir;
        const fullDir = nodePath.resolve(process.cwd(), repositoryPath || '.data', dir);

        try {
          const tree = await buildExactTreeFromDisk(fullDir, dirPath, repositoryPath || '.data');
          nodes.push(tree);
        } catch (e) {
          console.warn(`[buildDatabaseTree] failed to build tree for ${dir}:`, e);
          nodes.push({ name: dir, path: dir, type: 'directory', children: [] });
        }
      }

      // ── Attach uploaded documents from prisma.document ────────────────────
      try {
        const allDocuments = await prisma.document.findMany({
          select: {
            id: true,
            filename: true,
            path: true,
            mimeType: true,
            size: true,
            createdAt: true,
            updatedAt: true,
            metadata: true,
          }
        });
        attachDocumentsToTree(nodes, allDocuments);
      } catch (docErr) {
        console.warn('[buildDatabaseTree] warning loading documents:', docErr);
      }

      // Sort top-level nodes alphabetically
      nodes.sort((a, b) => a.name.localeCompare(b.name));

      console.log('[buildDatabaseTree] blocks:', blocks.length, 'equipments:', equipments.length, 'groups:', groups.length, 'groupEquipments:', groupEquipments.length);
      console.log('[buildDatabaseTree] centraleNode.children:', centraleNode.children?.length);
      console.log('[buildDatabaseTree] groupesNode.children:', groupesNode.children?.length);
      console.log('[buildDatabaseTree] top-level nodes:', nodes.map(n => n.name));

      return nodes;
    } catch (error) {
      console.error('[buildDatabaseTree] error:', error);
      throw error;
    }
  }

function attachDocumentsToTree(
  nodes: TreeNode[],
  documents: Array<{
    id: string;
    filename: string;
    path: string | null;
    mimeType: string | null;
    size: number | null;
    createdAt: Date;
    updatedAt: Date;
    metadata: any;
  }>
) {
  const dirMap = new Map<string, TreeNode>();
  const collectDirs = (list: TreeNode[]) => {
    for (const n of list) {
      if (n.type === 'directory') {
        dirMap.set(n.path, n);
        if (n.children) collectDirs(n.children);
      }
    }
  };
  collectDirs(nodes);

  for (const doc of documents) {
    if (!doc.path) continue;
    if (doc.filename === '.meta.json' || doc.path.endsWith('/.meta.json')) continue;

    const lastSlash = doc.path.lastIndexOf('/');
    const parentPath = lastSlash > 0 ? doc.path.substring(0, lastSlash) : '';
    const fileName = doc.filename || (lastSlash >= 0 ? doc.path.substring(lastSlash + 1) : doc.path);

    const fileNode: TreeNode = {
      name: fileName,
      path: doc.path,
      type: 'file',
      size: doc.size || undefined,
      metadata: {
        id: doc.id,
        mimeType: doc.mimeType || undefined,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
        type: doc.mimeType?.startsWith('image/') ? 'image' : doc.mimeType?.startsWith('video/') ? 'video' : 'file',
        ...(typeof doc.metadata === 'object' && doc.metadata !== null ? doc.metadata : {})
      }
    };

    if (parentPath && dirMap.has(parentPath)) {
      const parentNode = dirMap.get(parentPath)!;
      if (!parentNode.children) parentNode.children = [];
      if (!parentNode.children.some(c => c.path === doc.path)) {
        parentNode.children.push(fileNode);
      }
    } else if (parentPath) {
      const parts = parentPath.split('/');
      let currentPath = '';
      let currentChildren = nodes;
      for (const part of parts) {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        let existingDir = dirMap.get(currentPath);
        if (!existingDir) {
          existingDir = { name: part, path: currentPath, type: 'directory', children: [] };
          dirMap.set(currentPath, existingDir);
          currentChildren.push(existingDir);
        }
        if (!existingDir.children) existingDir.children = [];
        currentChildren = existingDir.children;
      }
      if (!currentChildren.some(c => c.path === doc.path)) {
        currentChildren.push(fileNode);
      }
    } else {
      if (!nodes.some(n => n.path === doc.path)) {
        nodes.push(fileNode);
      }
    }
  }

  const sortTree = (list: TreeNode[]) => {
    list.sort((a, b) => {
      if (a.type === 'directory' && b.type === 'file') return -1;
      if (a.type === 'file' && b.type === 'directory') return 1;
      return a.name.localeCompare(b.name);
    });
    for (const n of list) {
      if (n.children && n.children.length > 0) sortTree(n.children);
    }
  };
  sortTree(nodes);
}

async function buildTreeForSource(source: string, adapter: DatabaseAdapter, relativePath: string): Promise<TreeNode[]> {
  const actualPath = source === 'web' ? mapWebPathToAdapter(relativePath) : relativePath;
  const tree = await buildExactTree(adapter, actualPath);
  if (source === 'web') {
    return tree.map(node => ({ ...node, path: mapAdapterPathToWeb(node.path) }));
  }
  return tree;
}

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthenticatedResponse();
  if (!hasPermission(user.role, 'settings:*')) return unauthorizedResponse();

  try {
    const url = new URL(request.url);
    const source = url.searchParams.get('source') || 'local';
    const path = url.searchParams.get('path') || '';

    let adapter: DatabaseAdapter | undefined;
    const sourceUsed = source;
    let adapterPath: string | undefined;

    if (source === 'web') {
      adapterPath = '.';
      const webUrl = process.env.WEB_API_URL;
      const apiKey = process.env.WEB_API_KEY;
      const databaseUrl = process.env.DATABASE_URL || process.env.DATABASE_URL_NEON || '';
      if (webUrl || databaseUrl) {
        try {
          const webAdapter = new WebDatabaseAdapter(webUrl || '', apiKey || '', !webUrl, databaseUrl);
          adapter = webAdapter;
          const activeRepo = await getActiveRepository();
          const tree = await buildDatabaseTree(activeRepo, webAdapter);
          console.log('[API /structure] web source returned', tree.length, 'top-level nodes');
          console.log('[API /structure] web tree:', JSON.stringify(tree.map(n => ({ name: n.name, children: n.children?.length }))));

          if (path) {
            const findNode = (nodes: TreeNode[], targetPath: string): TreeNode | null => {
              for (const n of nodes) {
                if (n.path === targetPath) return n;
                if (n.children) {
                  const found = findNode(n.children, targetPath);
                  if (found) return found;
                }
              }
              return null;
            };
            const found = findNode(tree, path);
            if (!found) {
              return NextResponse.json({ success: false, error: 'Chemin introuvable', available: false }, { status: 404 });
            }
            return NextResponse.json({
              success: true,
              data: found.children ?? [],
              source: 'web',
              sourceUsed: 'web',
              path,
              available: true
            }, { headers: { 'Cache-Control': 'no-store' } });
          }

          return NextResponse.json({
            success: true,
            data: tree,
            source: 'web',
            sourceUsed: 'web',
            root: '',
            available: true
          }, { headers: { 'Cache-Control': 'no-store' } });
        } catch {
          return NextResponse.json({
            success: false,
            error: 'Base de donnees web non disponible',
            available: false
          }, { status: 503 });
        }
      } else {
        return NextResponse.json({
          success: false,
          error: 'BDD Web non configurée (WEB_API_URL ou DATABASE_URL requis)',
          available: false
        }, { status: 503 });
      }
    } else {
      const repoParam = request.nextUrl.searchParams.get('repository');
      const activeRepo = repoParam || await getActiveRepository();
      adapterPath = activeRepo;
      if (!adapterPath.startsWith('repositories/') && adapterPath !== '.data') {
        adapterPath = nodePath.join('repositories', adapterPath);
      }
      adapter = new LocalDatabaseAdapter(adapterPath);
    }

    if (!path) {
      const structure = await buildTreeForSource(source, adapter!, '.');
      return NextResponse.json({
        success: true,
        data: structure,
        source,
        sourceUsed,
        root: source === 'local' ? (adapterPath || '.data') : '.data/',
        available: true
      }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const actualPath = source === 'web' ? mapWebPathToAdapter(path) : path;
    if (!adapter) {
      return NextResponse.json({ success: false, error: 'Source non configurée', available: false }, { status: 500 });
    }
    let items: string[];
    try {
      items = await adapter.list(actualPath);
    } catch (err) {
      const error = err as { code?: string };
      if (error && (error.code === 'LIST_ERROR' || error.code === 'ENOTDIR')) {
        try {
          if (!adapter.readJSON) {
            return NextResponse.json({ success: false, error: 'Chemin inaccessible', available: false }, { status: 404 });
          }
          const data = await adapter.readJSON(actualPath);
          return NextResponse.json({
            success: true,
            data: [{
              name: actualPath.split('/').pop() || actualPath,
              path: source === 'web' ? mapAdapterPathToWeb(actualPath) : actualPath,
              type: 'file',
              metadata: data || undefined
            }],
            source,
            sourceUsed,
            path: source === 'web' ? mapAdapterPathToWeb(actualPath) : actualPath,
            available: true
          });
        } catch {
          return NextResponse.json({ success: false, error: 'Chemin inaccessible', available: false }, { status: 404 });
        }
      }
      throw err;
    }

    const nodes: TreeNode[] = [];
    for (const item of items.filter(isVisibleEntry)) {
      const adapterFullPath = actualPath ? `${actualPath}/${item}` : item;
      const itemType = await detectEntryType(adapter, adapterFullPath);

      if (itemType === 'file') {
        nodes.push({
          name: item,
          path: source === 'web' ? mapAdapterPathToWeb(adapterFullPath) : adapterFullPath,
          type: 'file'
        });
        continue;
      }

      nodes.push({
        name: item,
        path: source === 'web' ? mapAdapterPathToWeb(adapterFullPath) : adapterFullPath,
        type: 'directory',
        children: await buildTreeForSource(source, adapter, adapterFullPath)
      });
    }

    nodes.sort((a, b) => {
      if (a.type === 'directory' && b.type === 'file') return -1;
      if (a.type === 'file' && b.type === 'directory') return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      success: true,
      data: nodes,
      source,
      sourceUsed,
      path: source === 'web' ? mapAdapterPathToWeb(actualPath) : (actualPath || '.data/'),
      available: true
    }, { headers: { 'Cache-Control': 'no-store' } });

  } catch (error) {
    console.error('Erreur structure:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      available: false
    }, { status: 500 });
  }
}
