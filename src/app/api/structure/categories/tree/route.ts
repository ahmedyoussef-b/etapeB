import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, hasPermission, unauthorizedResponse, unauthenticatedResponse } from '@/lib/api/auth-guard';
import { getPrismaClient } from '@/lib/services/db';
import { LocalDatabaseAdapter } from '@/lib/database/local-adapter';
import { WebDatabaseAdapter } from '@/lib/database/web-adapter';
import { TreeNode } from '@/lib/database/structure-types';
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

async function buildExactTreeFromDisk(absDir: string, relPath: string, basePath?: string): Promise<TreeNode> {
  let entries: string[];
  try {
    const base = basePath ? nodePath.resolve(process.cwd(), basePath) : nodePath.resolve(process.cwd(), '.data');
    const localAdapter = new LocalDatabaseAdapter(base);
    entries = await localAdapter.list(relPath);
  } catch {
    return { name: relPath.split('/').pop() || relPath, path: relPath, type: 'directory', children: [], metadata: { type: 'ROOT' } };
  }

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
    }
  }

  children.sort((a, b) => a.name.localeCompare(b.name));

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

    // Build Centrale/ tree
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
        children: [],
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

      // Group by subsystemCode
      const subsystemMap = new Map<string, typeof blockEquipments>();
      for (const equip of blockEquipments) {
        const subsystem = equip.subsystemCode;
        if (subsystem) {
          if (!subsystemMap.has(subsystem)) {
            subsystemMap.set(subsystem, []);
          }
          subsystemMap.get(subsystem)!.push(equip);
        }
      }

      // Separate direct equipments (subsystemCode IS NULL)
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
          children: [],
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
          children: [],
          metadata: {
            type: 'SUBSYSTEM',
            code: subCode,
            libelle: container?.libelle || subCode,
            blocCode: block.code,
            createdAt: container?.createdAt?.toISOString() || block.createdAt.toISOString(),
            updatedAt: container?.updatedAt?.toISOString() || block.updatedAt.toISOString()
          }
        };

        // Add any nested equipment under this subsystem
        const nestedEquips = subsystemMap.get(subCode) || [];
        for (const equip of nestedEquips) {
          const equipNode: TreeNode = {
            name: equip.code,
            path: `Centrale/${block.code}/${subCode}/${equip.code}`,
            type: 'directory',
            children: [],
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

        subsystemNode.children!.sort((a, b) => a.name.localeCompare(b.name));
        blockNode.children!.push(subsystemNode);
      }
    }

    // Sort children of each block
    for (const blockNode of Array.from(blockMap.values())) {
      blockNode.children!.sort((a, b) => a.name.localeCompare(b.name));
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
        console.warn('[CategoryTree] Centrale disk fallback failed:', e);
      }
    }

    // Build Groupes/ tree
    const groupesNode: TreeNode = {
      name: 'Groupes',
      path: 'Groupes',
      type: 'directory',
      children: [],
      metadata: { type: 'ROOT' }
    };

    const groupMap = new Map<string, TreeNode>();
    for (const group of groups) {
      const groupNode: TreeNode = {
        name: group.code,
        path: `Groupes/${group.code}`,
        type: 'directory',
        children: [],
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
      groupesNode.children!.push(groupNode);
    }

    // Add group equipments to their groups
    for (const ge of groupEquipments) {
      const groupNode = groupMap.get(ge.groupeCode || '');
      if (groupNode) {
        const geNode: TreeNode = {
          name: ge.code,
          path: `Groupes/${ge.groupeCode}/${ge.code}`,
          type: 'directory',
          children: [],
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
    for (const groupNode of Array.from(groupMap.values())) {
      groupNode.children!.sort((a, b) => a.name.localeCompare(b.name));
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
        console.warn('[CategoryTree] Groupes disk fallback failed:', e);
      }
    }

    // Build complete tree for all root directories
    const extraDirs = ['bank', 'documents', 'indexes', 'registry', 'ressources humaines', 'system'];
    // Also discover any additional dirs on disk
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
    } catch { /* ignore */ }
    for (const dir of extraDirs) {
      const existing = nodes.find(n => n.name === dir);
      if (existing) continue;

      const fullDir = nodePath.resolve(process.cwd(), repositoryPath || '.data', dir);
      const tree = await buildExactTreeFromDisk(fullDir, dir, repositoryPath || '.data');
      nodes.push(tree);
    }

    // Sort top-level nodes
    nodes.sort((a, b) => a.name.localeCompare(b.name));

    return nodes;
  } catch (error) {
    console.error('[CategoryTree] error building database tree:', error);
    throw error;
  }
}

function filterDirectoriesOnly(nodes: TreeNode[]): TreeNode[] {
  return nodes
    .filter(n => n.type === 'directory')
    .map(n => ({
      name: n.name,
      path: n.path,
      type: 'directory' as const,
      metadata: n.metadata,
      children: n.children ? filterDirectoriesOnly(n.children) : [],
    }));
}

function collectAllPaths(nodes: TreeNode[], acc: { path: string; label: string }[] = []): { path: string; label: string }[] {
  for (const node of nodes) {
    if (node.type === 'directory') {
      acc.push({
        path: node.path,
        label: node.metadata?.libelle ? `${node.name} - ${node.metadata.libelle}` : node.name,
      });
      if (node.children) {
        collectAllPaths(node.children, acc);
      }
    }
  }
  return acc;
}

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return unauthenticatedResponse();
  }
  if (!hasPermission(user.role, 'banque-images:view')) {
    return unauthorizedResponse();
  }

  const url = new URL(request.url);
  const source = url.searchParams.get('source') || 'web';

  try {
    const activeRepo = await getActiveRepository();
    const rawTree = await buildDatabaseTree(activeRepo);
    const directoryTree = filterDirectoriesOnly(rawTree);
    const flatPaths = collectAllPaths(directoryTree);

    return NextResponse.json({
      success: true,
      tree: directoryTree,
      paths: flatPaths,
      categories: flatPaths.map(p => p.path),
      source,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[API /structure/categories/tree] error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      tree: [],
      categories: [],
    }, { status: 500 });
  }
}
