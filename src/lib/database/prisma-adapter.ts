// src/lib/database/prisma-adapter.ts

import { PrismaClient } from '@prisma/client';
import { getPrismaClient, resolveDatabaseUrl } from './connection-manager';
import { StorageAdapter, StorageError } from './storage-adapter';

function isPrismaKnownError(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === code;
}

// ============================================================
// 1. UTILITAIRE : Détection des chemins mappés
// ============================================================
function isMappedJsonPath(path: string): boolean {
  const parts = path.split('/').filter(p => p);
  if (parts.length === 0) return false;
  const last = parts[parts.length - 1];

   // Centrale/{block}/.meta.json ou Centrale/{block}/{equip}/.meta.json ou Centrale/{block}/{subsystem}/{equip}/.meta.json
   if (parts[0] === 'Centrale' && (parts.length === 3 || parts.length === 4 || parts.length === 5) && last === '.meta.json') return true;

   // Groupes/.meta.json ou Groupes/{group}/.meta.json ou Groupes/{group}/{equip}/.meta.json
   if (parts[0] === 'Groupes' && (parts.length === 2 || parts.length === 3 || parts.length === 4) && last === '.meta.json') return true;

  // indexs/{type}.json
  if (parts[0] === 'indexes' && parts.length === 2 && last.endsWith('.json')) return true;

  // Fichiers racine
  if (path === 'data_repertoire.json') return true;

  // data/procedures/{id}/metadata.json ou steps.json
  if (parts[0] === 'data' && parts.length === 4 && last.endsWith('.json')) return true;

  // registry/items/{userId}
  if (parts[0] === 'registry' && parts[1] === 'items' && parts.length === 3) return true;

  // registry/procedures/{id}/procedure.json
  if (parts[0] === 'registry' && parts[1] === 'procedures' && parts.length === 4 && last === 'procedure.json') return true;

  // registry/ressources humaines/equipe {X}/{name}.json
  if (parts[0] === 'registry' && parts[1] === 'ressources humaines' && parts.length === 4 && last.endsWith('.json')) return true;

  // ressources humaines/equipe {X}/{name}.json
  if (parts[0] === 'ressources humaines' && parts.length === 3 && last.endsWith('.json')) return true;

  // system/{file}.json
  if (parts[0] === 'system' && parts.length === 2) return true;

  return false;
}

// ============================================================
// 2. CLASSE PRINCIPALE
// ============================================================

export class PrismaAdapter implements StorageAdapter {
  private prisma: PrismaClient;

  constructor(databaseUrl?: string) {
    const url = resolveDatabaseUrl(databaseUrl);
    const client = getPrismaClient(url);
    if (!client) {
      throw new Error('Prisma client is not available. DATABASE_URL is not configured.');
    }
    this.prisma = client;
  }

  private getPrisma(): PrismaClient {
    return this.prisma;
  }

  // ============================================================
  // 3. LIST (Arborescence complète)
  // ============================================================
  async list(path: string): Promise<string[]> {
    const parts = path.split('/').filter(p => p);

    // --- RACINE ---
    if (parts.length === 0 || path === '' || path === '.') {
      const root: string[] = [
        'bank', 'documents', 'system'
      ];

      const blockCount = await this.getPrisma().block.count();
      if (blockCount > 0) root.push('Centrale');

      const groupCount = await this.getPrisma().group.count();
      if (groupCount > 0) root.push('Groupes');

      const userCount = await this.getPrisma().user.count();
      const procedureCount = await this.getPrisma().procedure.count();
      const hrCount = await this.getPrisma().humanResource.count();
      if ((userCount + procedureCount + hrCount) > 0) root.push('registry');

      const mirrorRep = await this.getPrisma().mirrorRepertoire.findUnique({
        where: { id: 'mirror' },
        select: { id: true }
      });
      if (mirrorRep) root.push('mirror_repertoire.json');

      const dataRep = await this.getPrisma().document.findFirst({
        where: { path: 'data_repertoire.json' },
        select: { id: true }
      });
      if (dataRep) root.push('data_repertoire.json');

      const indexCount = await this.getPrisma().indexRecord.count();
      if (indexCount > 0) root.push('indexes');

      console.log('[PrismaAdapter] list root', { blockCount, groupCount, userCount, procedureCount, hrCount, indexCount, mirrorRep: !!mirrorRep, dataRep: !!dataRep, root: root.sort() });
      return root.sort();
    }

    // --- Centrale ---
    const getDirectDocs = async (prefix: string): Promise<string[]> => {
      const docs = await this.getPrisma().document.findMany({
        where: { path: { startsWith: `${prefix}/` } },
        select: { path: true }
      });
      const entries = new Set<string>();
      for (const d of docs) {
        if (!d.path) continue;
        const rel = d.path.slice(prefix.length + 1);
        const child = rel.split('/')[0];
        if (child && child !== '.meta.json') entries.add(child);
      }
      return Array.from(entries);
    };

    // --- Centrale ---
    if (parts[0] === 'Centrale') {
       if (parts.length === 1) {
         const blocks = await this.getPrisma().block.findMany({ orderBy: { code: 'asc' } });
         const docEntries = await getDirectDocs('Centrale');
         console.log('[PrismaAdapter] list Centrale root', { count: blocks.length, codes: blocks.map(b => b.code) });
         return Array.from(new Set([...blocks.map(b => b.code), ...docEntries])).sort();
       }
       if (parts.length === 2) {
         // Equipment + subsystems directly under the block (subsystemCode IS NULL)
         const equipments = await this.getPrisma().equipment.findMany({
           where: { blocCode: parts[1], subsystemCode: null },
           orderBy: { code: 'asc' }
         });
         const docEntries = await getDirectDocs(path);
         console.log('[PrismaAdapter] list Centrale block', { block: parts[1], count: equipments.length, codes: equipments.map(e => e.code) });
         return Array.from(new Set(['.meta.json', ...equipments.map(e => e.code), ...docEntries]));
       }
       if (parts.length === 3) {
           if (parts[2] === '.meta.json') return [];
            // Centrale/{block}/{name} — name is a subsystem or direct equipment
            // If there are child equipment with subsystemCode=name, it's a subsystem
            const subEquipments = await this.getPrisma().equipment.findMany({
              where: { blocCode: parts[1], subsystemCode: parts[2] },
              orderBy: { code: 'asc' }
            });
            const docEntries = await getDirectDocs(path);
            const children = ['.meta.json'];
            if (subEquipments.length > 0) {
               children.push(...subEquipments.map(e => e.code));
            }
            return Array.from(new Set([...children, ...docEntries]));
       }
       if (parts.length >= 4) {
         if (parts[parts.length - 1] === '.meta.json') return [];
         const docEntries = await getDirectDocs(path);
         return Array.from(new Set(['.meta.json', ...docEntries]));
       }
    }

    // --- Groupes ---
    if (parts[0] === 'Groupes') {
       if (parts.length === 1) {
          const groups = await this.getPrisma().group.findMany({ orderBy: { libelle: 'asc' } });
          const seen = new Set<string>();
          const unique: string[] = [];
          for (const g of groups) {
            if (seen.has(g.libelle)) continue;
            seen.add(g.libelle);
            unique.push(g.libelle);
          }
          const docEntries = await getDirectDocs('Groupes');
          return Array.from(new Set(['.meta.json', ...unique, ...docEntries]));
        }
       if (parts.length === 2) {
         const group = await this.getPrisma().group.findFirst({ where: { libelle: parts[1] } });
         const docEntries = await getDirectDocs(path);
         if (group) {
           const equipments = await this.getPrisma().groupEquipment.findMany({
             where: { groupeCode: group.code },
             orderBy: { code: 'asc' }
           });
           return Array.from(new Set(['.meta.json', ...equipments.map(e => e.code), ...docEntries]));
         }
         return Array.from(new Set(['.meta.json', ...docEntries]));
       }
      if (parts.length >= 3) {
        if (parts[parts.length - 1] === '.meta.json') return [];
        const docEntries = await getDirectDocs(path);
        return Array.from(new Set(['.meta.json', ...docEntries]));
      }
    }

    // --- registry ---
    if (parts[0] === 'registry') {
      if (parts.length === 1) {
        return ['items', 'procedures', 'ressources humaines'];
      }
      if (parts[1] === 'items' && parts.length === 2) {
        const users = await this.getPrisma().user.findMany({ select: { id: true } });
        const userEntries = users.map(u => u.id);
        // Q/R files are stored as Document rows under registry/items/{baseName}/...
        // Separate flat files (registry/items/qa_export.json) from directories
        // (registry/items/qa_export/qa_export_v1.json).
        const qrDocs = await this.getPrisma().document.findMany({
          where: { path: { startsWith: 'registry/items/' } },
          select: { path: true }
        });
        const dirNames = new Set<string>();
        const flatFiles = new Set<string>();
        for (const d of qrDocs) {
          const relative = d.path!.slice('registry/items/'.length);
          const components = relative.split('/');
          if (components.length === 1) {
            // Flat file directly under registry/items/
            flatFiles.add(components[0]);
          } else if (components.length > 1) {
            // Directory: registry/items/{dirName}/...
            dirNames.add(components[0]);
          }
        }
        const allEntries = userEntries.slice();
        dirNames.forEach(name => allEntries.push(name));
        // Include flat files only when no directory with the same base name exists
        flatFiles.forEach(name => {
          const baseName = name.replace(/\.json$/, '');
          if (!dirNames.has(baseName)) {
            allEntries.push(name);
          }
        });
        return Array.from(new Set(allEntries)).sort();
      }
      if (parts[1] === 'items' && parts.length === 3) {
        const prefix = `registry/items/${parts[2]}/`;
        // Check if it's a Q/R directory (any document path starts with the prefix)
        const doc = await this.getPrisma().document.findFirst({
          where: { path: { startsWith: prefix } },
          select: { path: true }
        });
        if (doc) {
          // List the files inside this Q/R directory
          const docs = await this.getPrisma().document.findMany({
            where: { path: { startsWith: prefix } },
            select: { filename: true }
          });
          return this.filterKeep(docs.map(d => d.filename).sort());
        }
        // Check if it's a direct file at registry/items/{name} (legacy single-file Q/R)
        const directDoc = await this.getPrisma().document.findUnique({
          where: { path: `registry/items/${parts[2]}` },
          select: { filename: true }
        });
        if (directDoc) return [];
        const user = await this.getPrisma().user.findUnique({ where: { id: parts[2] } });
        if (!user) return [];
        return [`${parts[2]}.json`, `${parts[2]}.jpg`];
      }
      if (parts[1] === 'procedures' && parts.length === 2) {
        const procedures = await this.getPrisma().procedure.findMany({ select: { code: true, id: true } });
        const procCodes = procedures.map(p => p.code || p.id);
        const procDocs = await this.getPrisma().document.findMany({
          where: { path: { startsWith: 'registry/procedures/' } },
          select: { path: true }
        });
        const docCodes = new Set<string>();
        for (const d of procDocs) {
          const rel = d.path!.slice('registry/procedures/'.length);
          const firstPart = rel.split('/')[0];
          if (firstPart) docCodes.add(firstPart);
        }
        return Array.from(new Set(procCodes.concat(Array.from(docCodes)))).sort();
      }
      if (parts[1] === 'procedures' && parts.length === 3) {
        const procCode = parts[2];
        const docs = await this.getPrisma().document.findMany({
          where: { path: { startsWith: `registry/procedures/${procCode}/` } },
          select: { filename: true }
        });
        const filenames = docs.map(d => d.filename).filter(Boolean);
        if (filenames.length > 0) return Array.from(new Set(filenames)).sort();
        return ['procedure.json'];
      }
      if (parts[1] === 'ressources humaines' && parts.length === 2) {
        const hrs = await this.getPrisma().humanResource.findMany();
        const teamNames = hrs.map(h => h.team).filter((v, i, a) => a.indexOf(v) === i);
        return teamNames.map(t => `equipe ${t}`);
      }
      if (parts[1] === 'ressources humaines' && parts.length === 3) {
        const teamName = parts[2].replace('equipe ', '');
        const members = await this.getPrisma().humanResource.findMany({
          where: { team: teamName }
        });
        const files: string[] = [];
        for (const m of members) {
          files.push(`${m.name}.json`);
          files.push(`${m.name}.jpg`);
        }
        return files;
      }
    }

    // --- documents / bank ---
    if (parts[0] === 'documents' || parts[0] === 'bank') {
      const prefix = `${parts.join('/')}/`;
      const docs = await this.getPrisma().document.findMany({
        where: { path: { startsWith: prefix } },
        select: { path: true }
      });
      const children = new Set<string>();
      for (const doc of docs) {
        if (!doc.path) continue;
        const relativePath = doc.path.slice(prefix.length);
        const child = relativePath.split('/')[0];
        if (child) children.add(child);
      }
      return Array.from(children).sort();
    }

     // --- system ---
      if (parts[0] === 'system') {
        if (parts.length === 1) {
          const snapshots = await this.getPrisma().document.count({
            where: { path: { startsWith: 'system/snapshots/' } }
          });
          const sysFiles = await this.getPrisma().document.count({
            where: { AND: [
              { path: { startsWith: 'system/' } },
              { path: { not: { startsWith: 'system/snapshots/' } } }
            ] }
          });
          const children = (snapshots > 0 ? ['snapshots'] : []);
          if (sysFiles > 0) children.push('sync-files-log.json', 'sync-log.json');
          return children;
        }
        if (parts.length === 2 && parts[1] === 'snapshots') {
          const docs = await this.getPrisma().document.findMany({
            where: { path: { startsWith: 'system/snapshots/' } },
            select: { path: true }
          });
          return this.filterKeep(docs.map(d => d.path!.split('/').pop()!).sort());
        }
       if (parts.length === 2) {
         return ['.meta.json'];
       }
     }

     // --- indexes ---
     if (parts[0] === 'indexes' && parts.length === 1) {
       const visibleTypes = ['procedures', 'teams', 'users'];
       const indexes = await this.getPrisma().indexRecord.findMany({
         where: { type: { in: visibleTypes } },
         select: { type: true }
       });
       return indexes.map(i => `${i.type}.json`);
     }

     // --- data_repertoire.json / mirror_repertoire.json ---
     if (parts.length === 1 && (parts[0] === 'data_repertoire.json' || parts[0] === 'mirror_repertoire.json')) {
       const exists = await this.getPrisma().document.findFirst({
         where: { path: parts[0] },
         select: { id: true }
       });
       if (exists) return [];
       if (parts[0] === 'mirror_repertoire.json') {
         const mirror = await this.getPrisma().mirrorRepertoire.findUnique({ where: { id: 'mirror' }, select: { id: true } });
         if (mirror) return [];
       }
       return [];
     }

     // --- ressources humaines ---
     if (parts[0] === 'ressources humaines') {
       if (parts.length === 1) {
         const hrs = await this.getPrisma().humanResource.findMany();
         const teamNames = hrs.map(h => h.team).filter((v, i, a) => a.indexOf(v) === i);
         return teamNames.map(t => `equipe ${t}`);
       }
       if (parts.length === 2) {
         const teamName = parts[1].replace(/^equipe\s+/i, '');
         const members = await this.getPrisma().humanResource.findMany({
           where: { team: teamName }
         });
         const files: string[] = [];
         for (const m of members) {
           files.push(`${m.name}.json`);
           files.push(`${m.name}.jpg`);
         }
         return files;
       }
     }

    // --- data ---
    if (parts[0] === 'data') {
      if (parts.length === 1) {
        return ['procedures', 'system', 'teams', 'users'];
      }
      if (parts[1] === 'procedures' && parts.length === 2) {
        const procedures = await this.getPrisma().procedure.findMany({ select: { id: true } });
        return procedures.map(p => p.id);
      }
      if (parts[1] === 'procedures' && parts.length === 3) {
        return ['metadata.json', 'steps.json'];
      }
      if (parts[1] === 'users' && parts.length === 2) {
        const users = await this.getPrisma().user.findMany({ select: { id: true } });
        return users.map(u => u.id);
      }
      if (parts[1] === 'users' && parts.length === 3) {
        return ['profile.json'];
      }
      if (parts[1] === 'teams' && parts.length === 2) {
        const teams = await this.getPrisma().team.findMany({ select: { id: true } });
        return teams.map(t => t.id);
      }
      if (parts[1] === 'teams' && parts.length === 3) {
        return ['info.json'];
      }
      if (parts[1] === 'system' && parts.length === 2) {
        return ['bootstrap-manifest.json'];
      }
    }

    const directDocs = await getDirectDocs(path);
    if (directDocs.length > 0) {
      return directDocs.sort();
    }

    return [];
  }

  // ============================================================
  // 4. READ (avec throw NOT_FOUND)
  // ============================================================

  private async buildDataRepertoireTree(): Promise<Record<string, unknown>[]> {
    const p = this.getPrisma();

    const blocks = await p.block.findMany({ orderBy: { code: 'asc' } });
    const centraleChildren = await Promise.all(blocks.map(async (b: { code: string }) => {
      // Subsystems (type=SUBSYSTEM, subsystemCode=null) and direct equipment (subsystemCode=null)
      const equipments = await p.equipment.findMany({
        where: { blocCode: b.code, subsystemCode: null },
        orderBy: { code: 'asc' }
      });
      const equipmentEntries = await Promise.all(equipments.map(async (e: { code: string; type: string }) => {
        // If it's a subsystem, include nested equipment
        if (e.type === 'SUBSYSTEM') {
          const nestedEqs = await p.equipment.findMany({
            where: { blocCode: b.code, subsystemCode: e.code },
            orderBy: { code: 'asc' }
          });
          return {
            name: e.code,
            type: 'directory',
            children: [
              { name: '.meta.json', type: 'file' },
              ...nestedEqs.map((ne: { code: string }) => ({
                name: ne.code,
                type: 'directory',
                children: [{ name: '.meta.json', type: 'file' }]
              }))
            ]
          };
        }
        // Direct equipment
        return {
          name: e.code,
          type: 'directory',
          children: [{ name: '.meta.json', type: 'file' }]
        };
      }));
      return {
        name: b.code,
        type: 'directory',
        children: [
          { name: '.meta.json', type: 'file' },
          ...equipmentEntries
        ]
      };
    }));

    const groups = await p.group.findMany({ orderBy: { libelle: 'asc' } });
    const groupesChildren = await Promise.all(groups.map(async (g: { code: string; libelle: string }) => {
      const eqs = await p.groupEquipment.findMany({
        where: { groupeCode: g.code },
        orderBy: { code: 'asc' }
      });
      return {
        name: g.libelle,
        type: 'directory',
        children: [
          { name: '.meta.json', type: 'file' },
          ...eqs.map((e: { code: string }) => ({
            name: e.code,
            type: 'directory',
            children: [{ name: '.meta.json', type: 'file' }]
          }))
        ]
      };
    }));

    const docChildren = async (prefix: string) => {
      const docs = await p.document.findMany({ where: { path: { startsWith: prefix } } });
      return docs.map(d => ({ name: d.filename, type: 'file', size: d.size ?? null }));
    };

    return [
      { name: 'bank', type: 'directory', children: await docChildren('bank/') },
      { name: 'Centrale', type: 'directory', children: centraleChildren },
      { name: 'data_repertoire.json', type: 'file' },
      { name: 'documents', type: 'directory', children: await docChildren('documents/') },
      { name: 'Groupes', type: 'directory', children: groupesChildren },
      { name: 'mirror_repertoire.json', type: 'file' },
      { name: 'registry', type: 'directory', children: [] as unknown[] },
      { name: 'system', type: 'directory', children: [] as unknown[] },
      { name: 'indexes', type: 'directory', children: [] as unknown[] }
    ];
  }

  // Normalize type field from DB format to .data format (BLOCK, EQUIPMENT, SUBSYSTEM, GROUP, ROOT)
  private normalizeMetaType<T>(obj: T | null): T | null {
    if (!obj || typeof obj !== 'object') return obj;
    const rec = obj as Record<string, unknown>;
    if (rec.type !== undefined) {
      const typeMap: Record<string, string> = {
        'centrale': 'BLOCK',
        'sous_centrale': 'EQUIPMENT',
        'equipment': 'EQUIPMENT',
        'subsystem': 'SUBSYSTEM',
        'groupe': 'GROUP',
        'group': 'GROUP'
      };
      rec.type = typeMap[String(rec.type)] || rec.type;
    }
    return obj;
  }

  async read(path: string): Promise<Buffer> {
    // Chemin mappé → lire via readJSON
    if (isMappedJsonPath(path)) {
      const data = await this.readJSON(path);
      if (data === null) {
        throw new StorageError('NOT_FOUND', `Fichier non trouvé: ${path}`, path);
      }
      return Buffer.from(JSON.stringify(data, null, 2));
    }

    // Q/R files are stored as Document rows under registry/items/{baseName}/{filename}
    // When the caller requests registry/items/{baseName}.json, look for the directory
    // and return the latest Q/R data file (e.g. qa_export_v1.json), skipping manifest.json.
    const parts = path.split('/').filter(p => p);
    if (parts.length === 3 && parts[0] === 'registry' && parts[1] === 'items' && parts[2].endsWith('.json')) {
      // 1. Try exact Document path (flat file from first upload)
      const exactDoc = await this.getPrisma().document.findUnique({
        where: { path },
        select: { data: true }
      });
      if (exactDoc && exactDoc.data) {
        return Buffer.from(exactDoc.data);
      }
      // 2. Try versioned directory: registry/items/{baseName}/{baseName}_vN.json
      const baseName = parts[2].replace(/\.json$/, '');
      const dirPrefix = `registry/items/${baseName}/`;
      const docs = await this.getPrisma().document.findMany({
        where: { path: { startsWith: dirPrefix } },
        select: { path: true, data: true }
      });
      // Prefer the Q/R data file (matches {baseName}_vN.json), skip manifest.json
      const escapedBase = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const versionPattern = new RegExp(`^${escapedBase}_v\\d+\\.json$`);
      const sorted = [...docs].sort((a, b) => (b.path || '').localeCompare(a.path || ''));
      const qrFile = sorted.find(d => d.path && versionPattern.test(d.path));
      const fallback = sorted.find(d => d.path && !d.path.endsWith('manifest.json'));
      const chosen = qrFile || fallback || sorted[0];
      if (chosen && chosen.data) {
        return Buffer.from(chosen.data);
      }
    }

    // Document stocké en BDD (exact match — non-registry path)
    const doc = await this.getPrisma().document.findUnique({ where: { path } });
    if (doc && doc.data) {
      return Buffer.from(doc.data);
    }

    throw new StorageError('NOT_FOUND', `Fichier non trouvé: ${path}`, path);
  }

  // ============================================================
  // 5. READ JSON (Arborescence complète)
  // ============================================================
  async readJSON<T = unknown>(path: string): Promise<T | null> {
    const parts = path.split('/').filter(p => p);

       // --- .meta.json ---
       if (path.endsWith('.meta.json')) {
        // Centrale/{block}/.meta.json
        if (parts.length === 3 && parts[0] === 'Centrale') {
          const block = await this.getPrisma().block.findUnique({
            where: { code: parts[1] }
          });
          return this.normalizeMetaType(block) as T || null;
        }
        // Centrale/{block}/{subsystem}/.meta.json ou Centrale/{block}/{equip}/.meta.json
        if (parts.length === 4 && parts[0] === 'Centrale') {
          // Both subsystems and direct equipment are stored as Equipment with subsystemCode=null
          const equipment = await this.getPrisma().equipment.findFirst({
            where: { code: parts[2], blocCode: parts[1], subsystemCode: null }
          });
          return this.normalizeMetaType(equipment) as T || null;
        }
        // Centrale/{block}/{subsystem}/{equip}/.meta.json
        if (parts.length === 5 && parts[0] === 'Centrale') {
          const equipment = await this.getPrisma().equipment.findFirst({
            where: { code: parts[3], blocCode: parts[1], subsystemCode: parts[2] }
          });
          return this.normalizeMetaType(equipment) as T || null;
        }
        // Groupes/.meta.json (root Groupes metadata)
        if (parts.length === 2 && parts[0] === 'Groupes') {
          const group = await this.getPrisma().group.findFirst({
            where: { libelle: 'Groupes' }
          });
          if (group) {
            (group as Record<string, unknown>).type = 'ROOT';
          }
          return this.normalizeMetaType(group) as T || null;
        }
        // Groupes/{group}/.meta.json
        if (parts.length === 3 && parts[0] === 'Groupes') {
          const group = await this.getPrisma().group.findFirst({
            where: { libelle: parts[1] }
          });
          return this.normalizeMetaType(group) as T || null;
        }
       // Groupes/{group}/{equip}/.meta.json
       if (parts.length === 4 && parts[0] === 'Groupes') {
         const group = await this.getPrisma().group.findFirst({
           where: { libelle: parts[1] }
         });
         if (!group) return null;
         const groupEquipment = await this.getPrisma().groupEquipment.findFirst({
           where: { code: parts[2], groupeCode: group.code }
         });
         return this.normalizeMetaType(groupEquipment) as T || null;
       }
    }

    // --- data_repertoire.json ---
    if (path === 'data_repertoire.json') {
      return (await this.buildDataRepertoireTree()) as T;
    }

    // --- mirror_repertoire.json ---
    if (path === 'mirror_repertoire.json') {
      return (await this.getPrisma().mirrorRepertoire.findUnique({
        where: { id: 'mirror' }
      })) as T || null;
    }

    // --- data/ ---
    if (parts[0] === 'data') {
      // data/procedures/{id}/metadata.json
      if (parts.length === 4 && parts[1] === 'procedures' && parts[3] === 'metadata.json') {
        return (await this.getPrisma().procedure.findUnique({
          where: { id: parts[2] }
        })) as T || null;
      }
      // data/procedures/{id}/steps.json
      if (parts.length === 4 && parts[1] === 'procedures' && parts[3] === 'steps.json') {
        const proc = await this.getPrisma().procedure.findUnique({
          where: { id: parts[2] }
        });
        return proc?.steps as T || null;
      }
      // data/users/{id}/profile.json
      if (parts.length === 4 && parts[1] === 'users' && parts[3] === 'profile.json') {
        return (await this.getPrisma().user.findUnique({
          where: { id: parts[2] }
        })) as T || null;
      }
      // data/teams/{id}/info.json
      if (parts.length === 4 && parts[1] === 'teams' && parts[3] === 'info.json') {
        return (await this.getPrisma().team.findUnique({
          where: { id: parts[2] }
        })) as T || null;
      }
    }

    // --- registry ---
    // registry/procedures/{id}/procedure.json
    if (parts.length === 4 && parts[0] === 'registry' && parts[1] === 'procedures' && parts[3] === 'procedure.json') {
      return (await this.getPrisma().procedure.findUnique({
        where: { id: parts[2] }
      })) as T || null;
    }
    // registry/items/{baseName}/{filename} — Q/R files stored as Document rows
    if (parts.length === 4 && parts[0] === 'registry' && parts[1] === 'items') {
      const docPath = `registry/items/${parts[2]}/${parts[3]}`;
      const doc = await this.getPrisma().document.findUnique({
        where: { path: docPath },
        select: { data: true }
      });
      if (doc?.data) {
        try {
          return JSON.parse(Buffer.from(doc.data).toString('utf-8')) as T;
        } catch {
          return { raw: Buffer.from(doc.data).toString('utf-8') } as T;
        }
      }
      return null;
    }
    // registry/items/{baseName}.json — Q/R file stored as Document (flat or versioned)
    if (parts.length === 3 && parts[0] === 'registry' && parts[1] === 'items' && parts[2].endsWith('.json')) {
      const requestPath = `registry/items/${parts[2]}`;
      // 1. Try exact Document path (flat file from first upload)
      const exactDoc = await this.getPrisma().document.findUnique({
        where: { path: requestPath },
        select: { data: true }
      });
      if (exactDoc?.data) {
        try {
          return JSON.parse(Buffer.from(exactDoc.data).toString('utf-8')) as T;
        } catch {
          return { raw: Buffer.from(exactDoc.data).toString('utf-8') } as T;
        }
      }
      // 2. Try versioned directory: registry/items/{baseName}/{baseName}_vN.json
      const baseName = parts[2].replace(/\.json$/, '');
      const dirPrefix = `registry/items/${baseName}/`;
      const docs = await this.getPrisma().document.findMany({
        where: { path: { startsWith: dirPrefix } },
        select: { path: true, data: true }
      });
      // Prefer the Q/R data file (matches {baseName}_vN.json), skip manifest.json
      const escapedBase = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const versionPattern = new RegExp(`^${escapedBase}_v\\d+\\.json$`);
      const sorted = [...docs].sort((a, b) => (b.path || '').localeCompare(a.path || ''));
      const qrFile = sorted.find(d => d.path && versionPattern.test(d.path));
      const fallback = sorted.find(d => d.path && !d.path.endsWith('manifest.json'));
      const chosen = qrFile || fallback || sorted[0];
      if (chosen?.data) {
        try {
          return JSON.parse(Buffer.from(chosen.data).toString('utf-8')) as T;
        } catch {
          return { raw: Buffer.from(chosen.data).toString('utf-8') } as T;
        }
      }
      return null;
    }
    // registry/items/{userId} — legacy single-file Q/R or User record
    if (parts.length === 3 && parts[0] === 'registry' && parts[1] === 'items') {
      // Check if it's a Q/R file stored as Document first (legacy flat path)
      const doc = await this.getPrisma().document.findUnique({
        where: { path: `registry/items/${parts[2]}` },
        select: { data: true }
      });
      if (doc?.data) {
        try {
          return JSON.parse(Buffer.from(doc.data).toString('utf-8')) as T;
        } catch {
          return null;
        }
      }
      return (await this.getPrisma().user.findUnique({
        where: { id: parts[2] }
      })) as T || null;
    }
    // registry/ressources humaines/equipe {X}/{name}.json
    if (parts.length === 4 && parts[0] === 'registry' && parts[1] === 'ressources humaines') {
      const teamName = parts[2].replace('equipe ', '');
      const memberName = parts[3].replace('.json', '');
      return (await this.getPrisma().humanResource.findFirst({
        where: { team: teamName, name: memberName }
      })) as T || null;
    }

    // --- ressources humaines/equipe {X}/{name}.json ---
    if (parts.length === 3 && parts[0] === 'ressources humaines') {
      const teamName = parts[1].replace('equipe ', '');
      const memberName = parts[2].replace('.json', '');
      return (await this.getPrisma().humanResource.findFirst({
        where: { team: teamName, name: memberName }
      })) as T || null;
    }

    // --- documents / bank ---
    if (parts[0] === 'documents' || parts[0] === 'bank') {
      const doc = await this.getPrisma().document.findUnique({ where: { path } });
      if (doc?.data) {
        try {
          return JSON.parse(Buffer.from(doc.data).toString('utf-8')) as T;
        } catch {
          return { raw: Buffer.from(doc.data).toString('utf-8') } as T;
        }
      }
      return null;
    }

    return null;
  }

  // ============================================================
  // 6. WRITE (avec conversion Buffer → Uint8Array)
  // ============================================================
  async write(path: string, data: Buffer): Promise<void> {
    // Si chemin mappé → parser JSON et appeler writeJSON
    if (isMappedJsonPath(path)) {
      let json: unknown;
      try {
        json = JSON.parse(data.toString('utf-8'));
      } catch {
        throw new StorageError('INVALID_JSON', `JSON invalide pour ${path}`, path);
      }
      await this.writeJSON(path, json);
      return;
    }

    // Sinon → stocker comme document
    const filename = path.split('/').pop() || path;
    // Conversion Buffer → Uint8Array (correction TS2322)
    const bytes = new Uint8Array(data.byteLength);
    bytes.set(data);

    await this.getPrisma().document.upsert({
      where: { path },
      update: {
        filename,
        data: bytes,
        size: data.length,
        updatedAt: new Date()
      },
      create: {
        filename,
        path,
        data: bytes,
        size: data.length
      }
    });
  }

// ============================================================
// 7. WRITE JSON (Arborescence complète)
// ============================================================
async writeJSON<T = unknown>(path: string, data: T): Promise<void> {
  const parts = path.split('/').filter(p => p);
  const rawJson = JSON.parse(JSON.stringify(data));

  // Normalisation : les .meta.json utilisent parfois "blockCode" (faute historique),
  // le schéma Prisma n'accepte que "blocCode". On harmonise avant tout upsert.
  const json = rawJson && typeof rawJson === 'object' && !Array.isArray(rawJson)
    ? (() => {
        const normalized = { ...(rawJson as Record<string, unknown>) };
        if (!('blocCode' in normalized) && 'blockCode' in normalized) {
          normalized.blocCode = normalized.blockCode;
        }
        delete normalized.blockCode;
        return normalized;
      })()
    : rawJson;

   // --- .meta.json ---
     if (path.endsWith('.meta.json')) {
       // Centrale/{block}/.meta.json
       if (parts.length === 3 && parts[0] === 'Centrale') {
         await this.getPrisma().block.upsert({
           where: { code: parts[1] },
           update: { ...json, updatedAt: new Date() },
           create: { code: parts[1], ...json }
         });
         return;
       }
       // Centrale/{block}/{subsystem}/.meta.json ou Centrale/{block}/{equip}/.meta.json
       if (parts.length === 4 && parts[0] === 'Centrale') {
         const existing = await this.getPrisma().equipment.findFirst({
           where: { code: parts[2], blocCode: parts[1], subsystemCode: null }
         });
         if (existing) {
           await this.getPrisma().equipment.update({
             where: { id: existing.id },
             data: { ...json, blocCode: parts[1], subsystemCode: null, updatedAt: new Date() }
           });
         } else {
           await this.getPrisma().equipment.create({
             data: { code: parts[2], blocCode: parts[1], subsystemCode: null, ...json }
           });
         }
         return;
       }
       // Centrale/{block}/{subsystem}/{equip}/.meta.json
       if (parts.length === 5 && parts[0] === 'Centrale') {
         const existing = await this.getPrisma().equipment.findFirst({
           where: { code: parts[3], blocCode: parts[1], subsystemCode: parts[2] }
         });
         if (existing) {
           await this.getPrisma().equipment.update({
             where: { id: existing.id },
             data: { ...json, blocCode: parts[1], subsystemCode: parts[2], updatedAt: new Date() }
           });
         } else {
           await this.getPrisma().equipment.create({
             data: { code: parts[3], blocCode: parts[1], subsystemCode: parts[2], ...json }
           });
         }
         return;
        }
       // Groupes/.meta.json (root Groupes metadata)
       if (parts.length === 2 && parts[0] === 'Groupes') {
         await this.getPrisma().group.upsert({
           where: { code: 'Groupes' },
           update: { ...json, code: 'Groupes' },
           create: { code: 'Groupes', ...json }
         });
         return;
       }
       // Groupes/{group}/.meta.json
       if (parts.length === 3 && parts[0] === 'Groupes') {
         const code = parts[1].replace(/\s/g, '_').toUpperCase();
         await this.getPrisma().group.upsert({
           where: { code },
           update: { ...json, libelle: parts[1] },
           create: { code, libelle: parts[1], ...json }
         });
         return;
       }
      // Groupes/{group}/{equip}/.meta.json
      if (parts.length === 4 && parts[0] === 'Groupes') {
        const group = await this.getPrisma().group.findFirst({
          where: { libelle: parts[1] }
        });
        if (!group) return;
        await this.getPrisma().groupEquipment.upsert({
          where: { code_groupeCode: { code: parts[2], groupeCode: group.code } },
          update: { ...json, groupeCode: group.code },
          create: { code: parts[2], groupeCode: group.code, ...json }
        });
        return;
      }
    }

    // --- mirror_repertoire.json ---
    if (path === 'mirror_repertoire.json') {
      await this.getPrisma().mirrorRepertoire.upsert({
        where: { id: 'mirror' },
        update: json,
        create: { id: 'mirror', ...json }
      });
      return;
    }

    // --- data/procedures/{id}/metadata.json ---
    if (parts.length === 4 && parts[0] === 'data' && parts[1] === 'procedures' && parts[3] === 'metadata.json') {
      await this.getPrisma().procedure.upsert({
        where: { id: parts[2] },
        update: json,
        create: { id: parts[2], ...json }
      });
      return;
    }

    // --- data/procedures/{id}/steps.json ---
    if (parts.length === 4 && parts[0] === 'data' && parts[1] === 'procedures' && parts[3] === 'steps.json') {
      await this.getPrisma().procedure.upsert({
        where: { id: parts[2] },
        update: { steps: json },
        create: {
          id: parts[2],
          code: parts[2],
          title: parts[2],
          category: 'default',
          priority: 'normal',
          steps: json
        }
      });
      return;
    }

    // --- data/users/{id}/profile.json ---
    if (parts.length === 4 && parts[0] === 'data' && parts[1] === 'users' && parts[3] === 'profile.json') {
      await this.getPrisma().user.upsert({
        where: { id: parts[2] },
        update: json,
        create: { id: parts[2], ...json }
      });
      return;
    }

    // --- data/teams/{id}/info.json ---
    if (parts.length === 4 && parts[0] === 'data' && parts[1] === 'teams' && parts[3] === 'info.json') {
      await this.getPrisma().team.upsert({
        where: { id: parts[2] },
        update: json,
        create: { id: parts[2], ...json }
      });
      return;
    }

    // --- registry/procedures/{id}/procedure.json ---
    if (parts.length === 4 && parts[0] === 'registry' && parts[1] === 'procedures' && parts[3] === 'procedure.json') {
      await this.getPrisma().procedure.upsert({
        where: { id: parts[2] },
        update: json,
        create: { id: parts[2], ...json }
      });
      return;
    }

    // --- registry/items/{userId} ---
    // Q/R files (JSON arrays) are stored as Document, not User
    if (parts.length === 3 && parts[0] === 'registry' && parts[1] === 'items' && Array.isArray(json)) {
      const content = JSON.stringify(json, null, 2);
      const bytes = new Uint8Array(Buffer.from(content, 'utf-8').byteLength);
      bytes.set(Buffer.from(content, 'utf-8'));
      await this.getPrisma().document.upsert({
        where: { path: `registry/items/${parts[2]}` },
        update: { filename: parts[2], data: bytes, size: bytes.length, updatedAt: new Date() },
        create: { filename: parts[2], path: `registry/items/${parts[2]}`, data: bytes, size: bytes.length }
      });
      return;
    }
    if (parts.length === 3 && parts[0] === 'registry' && parts[1] === 'items') {
      await this.getPrisma().user.upsert({
        where: { id: parts[2] },
        update: json,
        create: { id: parts[2], ...json }
      });
      return;
    }

    // --- registry/ressources humaines/equipe {X}/{name}.json ---
    if (parts.length === 4 && parts[0] === 'registry' && parts[1] === 'ressources humaines') {
      const teamName = parts[2].replace('equipe ', '');
      const memberName = parts[3].replace('.json', '');
      await this.getPrisma().humanResource.upsert({
        where: { id: `${teamName}-${memberName}` },
        update: { ...json, team: teamName },
        create: {
          id: `${teamName}-${memberName}`,
          name: memberName,
          team: teamName,
          ...json
        }
      });
      return;
    }

    // --- ressources humaines/equipe {X}/{name}.json ---
    if (parts.length === 3 && parts[0] === 'ressources humaines') {
      const teamName = parts[1].replace('equipe ', '');
      const memberName = parts[2].replace('.json', '');
      await this.getPrisma().humanResource.upsert({
        where: { id: `${teamName}-${memberName}` },
        update: { ...json, team: teamName },
        create: {
          id: `${teamName}-${memberName}`,
          name: memberName,
          team: teamName,
          ...json
        }
      });
      return;
    }

    // --- indexs/{type}.json ---
    if (parts.length === 2 && parts[0] === 'indexes') {
      const type = parts[1].replace('.json', '');
      await this.getPrisma().indexRecord.upsert({
        where: { type },
        update: { data: json, total: json.total || 0 },
        create: { type, data: json, total: json.total || 0 }
      });
      return;
    }

    // --- Fallback : stocker comme document ---
    await this.write(path, Buffer.from(JSON.stringify(json, null, 2), 'utf-8'));
  }

  // ============================================================
  // 8. EXISTS
  // ============================================================
  async exists(path: string): Promise<boolean> {
    const parts = path.split('/').filter(p => p);
    if (parts.length === 0) return false;

    const prisma = this.getPrisma();

    // --- 1. Centrale ---
    if (parts[0] === 'Centrale') {
      if (parts.length === 1) {
        return (await prisma.block.count()) > 0;
      }
      if (parts.length === 2) {
        const block = await prisma.block.findUnique({ where: { code: parts[1] }, select: { id: true } });
        return !!block;
      }
      if (parts.length === 3) {
        if (parts[2] === '.meta.json') {
          const block = await prisma.block.findUnique({ where: { code: parts[1] }, select: { id: true } });
          return !!block;
        }
        const eq = await prisma.equipment.findFirst({
          where: { code: parts[2], blocCode: parts[1], subsystemCode: null },
          select: { id: true }
        });
        return !!eq;
      }
      if (parts.length === 4) {
        if (parts[3] === '.meta.json') {
          const eq = await prisma.equipment.findFirst({
            where: { code: parts[2], blocCode: parts[1], subsystemCode: null },
            select: { id: true }
          });
          return !!eq;
        }
        const eq = await prisma.equipment.findFirst({
          where: { code: parts[3], blocCode: parts[1], subsystemCode: parts[2] },
          select: { id: true }
        });
        return !!eq;
      }
      if (parts.length === 5 && parts[4] === '.meta.json') {
        const eq = await prisma.equipment.findFirst({
          where: { code: parts[3], blocCode: parts[1], subsystemCode: parts[2] },
          select: { id: true }
        });
        return !!eq;
      }
    }

    // --- 2. Groupes ---
    if (parts[0] === 'Groupes') {
      if (parts.length === 1) {
        return (await prisma.group.count()) > 0;
      }
      if (parts.length === 2) {
        const group = await prisma.group.findFirst({ where: { libelle: parts[1] }, select: { id: true } });
        return !!group;
      }
      if (parts.length === 3) {
        if (parts[2] === '.meta.json') {
          const group = await prisma.group.findFirst({ where: { libelle: parts[1] }, select: { id: true } });
          return !!group;
        }
        const group = await prisma.group.findFirst({ where: { libelle: parts[1] }, select: { code: true } });
        if (!group) return false;
        const ge = await prisma.groupEquipment.findFirst({
          where: { code: parts[2], groupeCode: group.code },
          select: { id: true }
        });
        return !!ge;
      }
      if (parts.length === 4 && parts[3] === '.meta.json') {
        const group = await prisma.group.findFirst({ where: { libelle: parts[1] }, select: { code: true } });
        if (!group) return false;
        const ge = await prisma.groupEquipment.findFirst({
          where: { code: parts[2], groupeCode: group.code },
          select: { id: true }
        });
        return !!ge;
      }
    }

    // --- 3. Registry ---
    if (parts[0] === 'registry') {
      if (parts.length === 1) {
        const u = await prisma.user.count();
        const p = await prisma.procedure.count();
        const h = await prisma.humanResource.count();
        return (u + p + h) > 0;
      }
      if (parts[1] === 'items') {
        if (parts.length === 2) {
          const userCount = await prisma.user.count();
          const docCount = await prisma.document.count({
            where: { path: { startsWith: 'registry/items/' } }
          });
          return (userCount + docCount) > 0;
        }
        const rawName = parts[2];
        const userId = rawName.replace(/\.json$/, '');
        // Q/R files are stored as Document rows under registry/items/{baseName}/{filename}
        // The baseName is the filename without extension (e.g. qa_export from qa_export.json)
        const baseName = rawName.replace(/\.json$/, '');
        // Check for a Q/R directory (any document path starts with the prefix)
        const dirPrefix = `registry/items/${baseName}/`;
        const dirDoc = await prisma.document.findFirst({
          where: { path: { startsWith: dirPrefix } },
          select: { id: true }
        });
        if (dirDoc) return true;
        // Check for a legacy direct file at registry/items/{rawName}
        const directDoc = await prisma.document.findUnique({
          where: { path: `registry/items/${rawName}` }, select: { id: true }
        });
        if (directDoc) return true;
        return !!(await prisma.user.findUnique({ where: { id: userId }, select: { id: true } }));
      }
      if (parts[1] === 'procedures') {
        if (parts.length === 2) return (await prisma.procedure.count()) > 0;
        const procId = parts[2];
        return !!(await prisma.procedure.findUnique({ where: { id: procId }, select: { id: true } }));
      }
      if (parts[1] === 'ressources humaines') {
        if (parts.length === 2) return (await prisma.humanResource.count()) > 0;
        if (parts.length === 3) {
          const teamName = parts[2].replace(/^equipe\s+/i, '');
          return (await prisma.humanResource.count({ where: { team: teamName } })) > 0;
        }
        if (parts.length === 4) {
          const teamName = parts[2].replace(/^equipe\s+/i, '');
          const memberName = parts[3].replace(/\.json$/, '').replace(/\.jpg$/, '');
          const hr = await prisma.humanResource.findFirst({ where: { team: teamName, name: memberName }, select: { id: true } });
          return !!hr;
        }
      }
    }

    // --- 4. Ressources Humaines ---
    if (parts[0] === 'ressources humaines') {
      if (parts.length === 1) return (await prisma.humanResource.count()) > 0;
      if (parts.length === 2) {
        const teamName = parts[1].replace(/^equipe\s+/i, '');
        return (await prisma.humanResource.count({ where: { team: teamName } })) > 0;
      }
      if (parts.length === 3) {
        const teamName = parts[1].replace(/^equipe\s+/i, '');
        const memberName = parts[2].replace(/\.json$/, '').replace(/\.jpg$/, '');
        const hr = await prisma.humanResource.findFirst({ where: { team: teamName, name: memberName }, select: { id: true } });
        return !!hr;
      }
    }

    // --- 5. Data ---
    if (parts[0] === 'data') {
      if (parts.length >= 3 && parts[1] === 'procedures') {
        return !!(await prisma.procedure.findUnique({ where: { id: parts[2] }, select: { id: true } }));
      }
      if (parts.length >= 3 && parts[1] === 'users') {
        return !!(await prisma.user.findUnique({ where: { id: parts[2] }, select: { id: true } }));
      }
      if (parts.length >= 3 && parts[1] === 'teams') {
        return !!(await prisma.team.findUnique({ where: { id: parts[2] }, select: { id: true } }));
      }
    }

    // --- 6. Indexes ---
    if (parts[0] === 'indexes') {
      if (parts.length === 1) return (await prisma.indexRecord.count()) > 0;
      if (parts.length === 2) {
        const type = parts[1].replace(/\.json$/, '');
        const idx = await prisma.indexRecord.findUnique({ where: { type }, select: { type: true } });
        return !!idx;
      }
    }

    // --- 7. Mirror repertoire / Data repertoire ---
    if (parts[0] === 'mirror_repertoire.json') {
      const mirror = await prisma.mirrorRepertoire.findUnique({ where: { id: 'mirror' }, select: { id: true } });
      if (mirror) return true;
    }

    // --- 8. Documents / Bank / System / General Document ---
    const doc = await prisma.document.findUnique({ where: { path }, select: { id: true } });
    if (doc) return true;

    const count = await prisma.document.count({
      where: { path: { startsWith: `${path}/` } }
    });
    if (count > 0) return true;

    if (path === 'bank' || path === 'documents' || path === 'system') {
      return true;
    }

    return false;
  }

  // ============================================================
  // 9. MKDIR (sentinelle .keep)
  // ============================================================
  async mkdir(path: string): Promise<void> {
    const keepPath = `${path}/.keep`;
    await this.getPrisma().document.upsert({
      where: { path: keepPath },
      update: { updatedAt: new Date() },
      create: {
        path: keepPath,
        filename: '.keep',
        mimeType: 'application/x-directory-placeholder',
        size: 0,
        data: Buffer.alloc(0)
      }
    });
  }

  // ============================================================
  // 9b. FILTRE SENTINELLES
  // ============================================================
  private filterKeep(names: string[]): string[] {
    return names.filter(n => n !== '.keep');
  }

  // ============================================================
  // 10. DELETE
  // ============================================================
  async delete(path: string): Promise<void> {
    const parts = path.split('/').filter(p => p);
    if (parts.length === 0) return;

    const prisma = this.getPrisma();

    // --- 1. Centrale / Blocks / Equipments / Subsystems ---
    if (parts[0] === 'Centrale') {
      // 1A. Centrale root
      if (parts.length === 1) {
        console.log('[prisma-adapter] delete Centrale root');
        await prisma.$transaction(async (tx) => {
          await tx.equipment.deleteMany({});
          await tx.block.deleteMany({});
        });
        return;
      }

      // 1B. Centrale/{block} OR Centrale/{block}/.meta.json
      if (parts.length === 2 || (parts.length === 3 && parts[2] === '.meta.json')) {
        const blocCode = parts[1];
        console.log('[prisma-adapter] delete block', { blocCode });
        await prisma.$transaction(async (tx) => {
          await tx.equipment.deleteMany({ where: { blocCode } });
          await tx.block.deleteMany({ where: { code: blocCode } });
        });
        return;
      }

      // 1C. Centrale/{block}/{equipOrSubsystem} OR Centrale/{block}/{equipOrSubsystem}/.meta.json
      if (parts.length === 3 || (parts.length === 4 && parts[3] === '.meta.json')) {
        const blocCode = parts[1];
        const name = parts[2];
        console.log('[prisma-adapter] delete equipment/subsystem', { blocCode, name });
        await prisma.$transaction(async (tx) => {
          await tx.equipment.deleteMany({
            where: { blocCode, subsystemCode: name }
          });
          await tx.equipment.deleteMany({
            where: { blocCode, code: name, subsystemCode: null }
          });
        });
        return;
      }

      // 1D. Centrale/{block}/{subsystem}/{equip} OR Centrale/{block}/{subsystem}/{equip}/.meta.json
      if (parts.length === 4 || (parts.length === 5 && parts[4] === '.meta.json')) {
        const blocCode = parts[1];
        const subsystemCode = parts[2];
        const equipCode = parts[3];
        console.log('[prisma-adapter] delete nested equipment', { blocCode, subsystemCode, equipCode });
        await prisma.equipment.deleteMany({
          where: { blocCode, subsystemCode, code: equipCode }
        });
        return;
      }
    }

    // --- 2. Groupes / Groups / GroupEquipments ---
    if (parts[0] === 'Groupes') {
      // 2A. Groupes root
      if (parts.length === 1) {
        console.log('[prisma-adapter] delete Groupes root');
        await prisma.$transaction(async (tx) => {
          await tx.groupEquipment.deleteMany({});
          await tx.group.deleteMany({});
        });
        return;
      }

      // 2B. Groupes/{group} OR Groupes/{group}/.meta.json
      if (parts.length === 2 || (parts.length === 3 && parts[2] === '.meta.json')) {
        const groupLibelle = parts[1];
        console.log('[prisma-adapter] delete group', { groupLibelle });
        await prisma.$transaction(async (tx) => {
          const group = await tx.group.findFirst({ where: { libelle: groupLibelle } });
          if (!group) return;
          await tx.groupEquipment.deleteMany({ where: { groupeCode: group.code } });
          await tx.group.deleteMany({ where: { code: group.code } });
        });
        return;
      }

      // 2C. Groupes/{group}/{equip} OR Groupes/{group}/{equip}/.meta.json
      if (parts.length === 3 || (parts.length === 4 && parts[3] === '.meta.json')) {
        const groupLibelle = parts[1];
        const equipCode = parts[2];
        console.log('[prisma-adapter] delete group equipment', { groupLibelle, equipCode });
        await prisma.$transaction(async (tx) => {
          const group = await tx.group.findFirst({ where: { libelle: groupLibelle } });
          if (!group) return;
          await tx.groupEquipment.deleteMany({
            where: { code: equipCode, groupeCode: group.code }
          });
        });
        return;
      }
    }

    // --- 3. Registry ---
    if (parts[0] === 'registry') {
      if (parts.length === 1) {
        console.log('[prisma-adapter] delete registry root');
        await prisma.$transaction(async (tx) => {
          await tx.humanResource.deleteMany({});
          await tx.procedure.deleteMany({});
          await tx.user.deleteMany({});
        });
        return;
      }
      if (parts[1] === 'items') {
        if (parts.length === 2) {
          // Delete both User rows AND Document rows (Q/R files like qa_export.json)
          await prisma.user.deleteMany({});
          await prisma.document.deleteMany({
            where: { path: { startsWith: 'registry/items/' } }
          });
        } else if (parts.length >= 3) {
          const rawName = parts[2];
          const userId = rawName.replace(/\.json$/, '');
          // Q/R files are stored as Document rows under registry/items/{baseName}/{filename}
          // Delete the entire Q/R directory first (all documents with that prefix)
          const dirPrefix = `registry/items/${rawName}/`;
          const deletedDirDocs = await prisma.document.deleteMany({
            where: { path: { startsWith: dirPrefix } }
          });
          if (deletedDirDocs.count > 0) {
            return;
          }
          // Check for a legacy direct file at registry/items/{rawName}
          const deletedDirectDoc = await prisma.document.deleteMany({
            where: { path: `registry/items/${rawName}` }
          });
          if (deletedDirectDoc.count > 0) {
            return;
          }
          // Fall back to User deletion
          await prisma.user.deleteMany({ where: { id: userId } });
        }
        return;
      }
      if (parts[1] === 'procedures') {
        if (parts.length === 2) {
          await prisma.procedure.deleteMany({});
          await prisma.document.deleteMany({
            where: { path: { startsWith: 'registry/procedures' } }
          });
        } else if (parts.length >= 3) {
          const rawCode = parts[2].replace(/\.json$/, '');
          await prisma.procedure.deleteMany({
            where: { OR: [{ code: rawCode }, { id: rawCode }] }
          });
          await prisma.document.deleteMany({
            where: {
              OR: [
                { path: path },
                { path: `registry/procedures/${rawCode}` },
                { path: { startsWith: `registry/procedures/${rawCode}/` } },
                { path: { startsWith: `registry/procedures/${rawCode}` } }
              ]
            }
          });
        }
        return;
      }
      if (parts[1] === 'ressources humaines') {
        if (parts.length === 2) {
          await prisma.humanResource.deleteMany({});
        } else if (parts.length === 3) {
          const teamName = parts[2].replace(/^equipe\s+/i, '');
          await prisma.humanResource.deleteMany({ where: { team: teamName } });
        } else if (parts.length === 4) {
          const teamName = parts[2].replace(/^equipe\s+/i, '');
          const memberName = parts[3].replace(/\.json$/, '').replace(/\.jpg$/, '');
          await prisma.humanResource.deleteMany({ where: { team: teamName, name: memberName } });
        }
        return;
      }
    }

    // --- 4. Ressources Humaines ---
    if (parts[0] === 'ressources humaines') {
      if (parts.length === 1) {
        await prisma.humanResource.deleteMany({});
        return;
      }
      if (parts.length === 2) {
        const teamName = parts[1].replace(/^equipe\s+/i, '');
        await prisma.humanResource.deleteMany({ where: { team: teamName } });
        return;
      }
      if (parts.length === 3) {
        const teamName = parts[1].replace(/^equipe\s+/i, '');
        const memberName = parts[2].replace(/\.json$/, '').replace(/\.jpg$/, '');
        await prisma.humanResource.deleteMany({ where: { team: teamName, name: memberName } });
        return;
      }
    }

    // --- 5. Data (procedures, users, teams) ---
    if (parts[0] === 'data') {
      if (parts.length >= 3 && parts[1] === 'procedures') {
        await prisma.procedure.deleteMany({ where: { id: parts[2] } });
        return;
      }
      if (parts.length >= 3 && parts[1] === 'users') {
        await prisma.user.deleteMany({ where: { id: parts[2] } });
        return;
      }
      if (parts.length >= 3 && parts[1] === 'teams') {
        await prisma.team.deleteMany({ where: { id: parts[2] } });
        return;
      }
    }

    // --- 6. Indexes ---
    if (parts[0] === 'indexes') {
      if (parts.length === 1) {
        await prisma.indexRecord.deleteMany({});
        return;
      }
      if (parts.length === 2) {
        const type = parts[1].replace(/\.json$/, '');
        await prisma.indexRecord.deleteMany({ where: { type } });
        return;
      }
    }

    // --- 7. Mirror repertoire / Data repertoire ---
    if (path === 'mirror_repertoire.json') {
      await prisma.mirrorRepertoire.deleteMany({ where: { id: 'mirror' } });
      await prisma.document.deleteMany({ where: { path } });
      return;
    }
    if (path === 'data_repertoire.json') {
      await prisma.document.deleteMany({ where: { path } });
      return;
    }

    // --- 8. Documents / Bank / System / General Document ---
    console.log('[prisma-adapter] delete document or subdirectory', { path });
    // First: delete exact matching document if it exists
    await prisma.document.deleteMany({ where: { path } });

    // Second: delete any sub-documents if path is a directory
    const prefix = `${path}/`;
    await prisma.document.deleteMany({
      where: { path: { startsWith: prefix } }
    });
    console.log('[prisma-adapter] delete document success', { path });
  }

  // ============================================================
  // 11. RENAME
  // ============================================================
  async rename(oldPath: string, newPath: string): Promise<void> {
    const oldParts = oldPath.split('/').filter(p => p);
    const newParts = newPath.split('/').filter(p => p);
    const newName = newParts[newParts.length - 1];

    // Renommer un bloc
    if (oldParts.length === 3 && oldParts[0] === 'Centrale' && oldParts[2] === '.meta.json') {
      console.log('[prisma-adapter] rename block', { oldCode: oldParts[1], newCode: newName });
      await this.getPrisma().block.update({
        where: { code: oldParts[1] },
        data: { code: newName }
      }).catch(() => {});
      await this.getPrisma().equipment.updateMany({
        where: { blocCode: oldParts[1] },
        data: { blocCode: newName }
      });
      console.log('[prisma-adapter] rename block success', { oldCode: oldParts[1], newCode: newName });
      return;
    }

      // Renommer un équipement ou subsystem (directement sous un bloc)
      if (oldParts.length === 4 && oldParts[0] === 'Centrale' && oldParts[3] === '.meta.json') {
        console.log('[prisma-adapter] rename equipment/subsystem', { blocCode: oldParts[1], oldCode: oldParts[2], newCode: newName });
        const existing = await this.getPrisma().equipment.findFirst({
          where: { code: oldParts[2], blocCode: oldParts[1], subsystemCode: null }
        });
        if (existing) {
          // Check if it's a subsystem — update child equipment's subsystemCode
          const childCount = await this.getPrisma().equipment.count({
            where: { blocCode: oldParts[1], subsystemCode: oldParts[2] }
          });
          if (childCount > 0) {
            await this.getPrisma().equipment.updateMany({
              where: { blocCode: oldParts[1], subsystemCode: oldParts[2] },
              data: { subsystemCode: newName }
            });
          }
          await this.getPrisma().equipment.update({
            where: { id: existing.id },
            data: { code: newName }
          }).catch(() => {});
        }
        console.log('[prisma-adapter] rename equipment/subsystem success', { blocCode: oldParts[1], oldCode: oldParts[2], newCode: newName });
        return;
      }

     // Renommer un équipement sous un subsystem
     if (oldParts.length === 5 && oldParts[0] === 'Centrale' && oldParts[4] === '.meta.json') {
       console.log('[prisma-adapter] rename equipment under subsystem', { blocCode: oldParts[1], subsystemCode: oldParts[2], oldCode: oldParts[3], newCode: newName });
       await this.getPrisma().equipment.updateMany({
         where: { code: oldParts[3], blocCode: oldParts[1], subsystemCode: oldParts[2] },
         data: { code: newName }
       }).catch(() => {});
       console.log('[prisma-adapter] rename equipment under subsystem success', { blocCode: oldParts[1], subsystemCode: oldParts[2], oldCode: oldParts[3], newCode: newName });
       return;
     }

    // Renommer un groupe
    if (oldParts.length === 3 && oldParts[0] === 'Groupes' && oldParts[2] === '.meta.json') {
      const newCode = newName.replace(/\s/g, '_').toUpperCase();
      console.log('[prisma-adapter] rename group', { oldLibelle: oldParts[1], newLibelle: newName, newCode });
      await this.getPrisma().group.updateMany({
        where: { libelle: oldParts[1] },
        data: { code: newCode, libelle: newName }
      }).catch(() => {});
      console.log('[prisma-adapter] rename group success', { oldLibelle: oldParts[1], newLibelle: newName, newCode });
      return;
    }

    // Renommer un équipement de groupe
    if (oldParts.length === 4 && oldParts[0] === 'Groupes' && oldParts[3] === '.meta.json') {
      const group = await this.getPrisma().group.findFirst({ where: { libelle: oldParts[1] } });
      if (group) {
        console.log('[prisma-adapter] rename group equipment', { groupeCode: group.code, oldCode: oldParts[2], newCode: newName });
        await this.getPrisma().groupEquipment.update({
          where: { code_groupeCode: { code: oldParts[2], groupeCode: group.code } },
          data: { code: newName }
        }).catch(() => {});
        console.log('[prisma-adapter] rename group equipment success', { groupeCode: group.code, oldCode: oldParts[2], newCode: newName });
      }
      return;
    }

    // Renommer un document
    if (oldParts[0] === 'documents' || oldParts[0] === 'bank') {
      console.log('[prisma-adapter] rename document', { oldPath, newPath, filename: newName });
      await this.getPrisma().document.updateMany({
        where: { path: oldPath },
        data: { path: newPath, filename: newName }
      }).catch(() => {});
      console.log('[prisma-adapter] rename document success', { oldPath, newPath, filename: newName });
    }
  }

  // ============================================================
  // 12. READ TEXT / WRITE TEXT
  // ============================================================
  async readText(path: string): Promise<string> {
    const buffer = await this.read(path);
    return buffer.toString('utf-8');
  }

  async writeText(path: string, content: string): Promise<void> {
    await this.write(path, Buffer.from(content, 'utf-8'));
  }

  // ============================================================
  // 13. STATS
  // ============================================================
  async getStats(): Promise<{ files: number; size: number }> {
    try {
      const result = await this.getPrisma().$queryRaw<Array<{ count: string; size: string }>>`
        SELECT 
          COUNT(*)::text as count,
          COALESCE(SUM(pg_total_relation_size(relid))::text, '0') as size
        FROM pg_catalog.pg_statio_user_tables
      `;
      const stats = result[0] || { count: '0', size: '0' };
      return {
        files: parseInt(stats.count || '0'),
        size: parseInt(stats.size || '0')
      };
    } catch {
      return { files: 0, size: 0 };
    }
  }

  // ============================================================
  // 14. PING
  // ============================================================
  async ping(): Promise<boolean> {
    try {
      await this.getPrisma().$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

// ============================================================
// 15. DISCONNECT
// ============================================================
async disconnect(): Promise<void> {
    // Ne pas déconnecter l'instance singleton : elle est partagée entre
    // toutes les requêtes et vit jusqu'à la fin du process.
  }

  /**
   * Expose le PrismaClient interne pour permettre des transactions au niveau
   * du service appelant. Renvoie null si l'adapter ne fonctionne pas en mode Prisma.
   */
  getPrismaClient(): PrismaClient | null {
    return this.prisma;
  }

  /**
   * Indique si cet adapter supporte les transactions Prisma natives.
   */
  supportsTransactions(): boolean {
    return this.prisma !== null && this.prisma !== undefined;
  }
}