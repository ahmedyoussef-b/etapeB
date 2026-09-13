import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { promises as fs } from 'node:fs';
import * as nodePath from 'node:path';
import { hash } from 'bcryptjs';
import { syncFromRepertoire } from './seed-from-repertoire';
import { LocalDatabaseAdapter } from '../src/lib/database/local-adapter';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function collectFilePaths(): Promise<string[]> {
  const localAdapter = new LocalDatabaseAdapter('.data');
  const paths: string[] = [];

  const walk = async (currentPath: string) => {
    try {
      const entries = await localAdapter.list(currentPath);
      for (const entry of entries) {
        if (entry === 'mirror_repertoire.json' || entry === 'data-repertoire.json') continue;
        if (entry.startsWith('.') && !entry.endsWith('.meta.json')) continue;
        const fullPath = currentPath === '.' || !currentPath ? entry : `${currentPath}/${entry}`;
        const children = await localAdapter.list(fullPath).catch(() => []);
        if (Array.isArray(children) && children.length > 0) {
          await walk(fullPath);
        } else {
          paths.push(fullPath);
        }
      }
    } catch {
      // ignore
    }
  };

  await walk('.');
  return Array.from(new Set(paths)).sort();
}

async function main() {
  console.log('🌱 Seeding des données industrielles...');

  await syncFromRepertoire(prisma);

  const DEFAULT_USERS = [
    { email: 'admin@nexaflow.local', name: 'Admin NexaFlow', role: 'ADMIN' as const, password: 'admin123' },
    { email: 'rondier@nexaflow.local', name: 'Rondier Test', role: 'RONDIER' as const, password: 'rondier123' },
    { email: 'chef.bloc@nexaflow.local', name: 'Chef de bloc', role: 'CHEF_DE_BLOC' as const, password: 'chef123' },
    { email: 'chef.quart@nexaflow.local', name: 'Chef de quart', role: 'CHEF_DE_QUART' as const, password: 'quart123' },
  ];

  for (const u of DEFAULT_USERS) {
    const hashed = await hash(u.password, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      update: { password: hashed, name: u.name, role: u.role },
      create: {
        email: u.email,
        name: u.name,
        password: hashed,
        role: u.role,
      },
    });
  }
  console.log('✅ Utilisateurs par défaut créés');

  console.log('📸 Création du snapshot initial (côté Local)...');
  try {
    const dataDir = nodePath.resolve(process.cwd(), '.data');
    const snapshotPath = nodePath.join(dataDir, 'system', 'snapshots', 'initial-snapshot.json');
    const referenceSnapshotPath = nodePath.resolve(process.cwd(), '.snapshot-reference', 'initial-snapshot.json');
    await fs.mkdir(nodePath.dirname(snapshotPath), { recursive: true });
    await fs.mkdir(nodePath.dirname(referenceSnapshotPath), { recursive: true });

    const blocks = await prisma.block.findMany();
    const equipments = await prisma.equipment.findMany();
    const groups = await prisma.group.findMany();
    const groupEquipments = await prisma.groupEquipment.findMany();

    const filePaths = await collectFilePaths();

    const snapshot = {
      id: `init-${Date.now()}`,
      timestamp: new Date().toISOString(),
      description: 'État initial - Structure industrielle',
      structure: {
        blocks: blocks.map(b => ({ code: b.code, libelle: b.libelle, type: b.type })),
        equipments: equipments.map(e => ({ code: e.code, libelle: e.libelle, block: e.blocCode, blocCode: e.blocCode, subsystemCode: e.subsystemCode, type: e.type })),
        groups: groups.map(g => ({ code: g.code, libelle: g.libelle, type: g.type })),
        groupEquipments: groupEquipments.map(ge => ({ code: ge.code, libelle: ge.libelle, group: ge.groupeCode, blocCode: ge.blocCode, type: ge.type })),
        mirrorRepertoire: { version: '1.0.0', structure: 'industrial' },
        filePaths
      }
    };
    await fs.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8');
    await fs.writeFile(referenceSnapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8');
    console.log(`✅ Snapshot initial écrit : ${snapshotPath}`);
    console.log(`✅ Snapshot de référence écrit : ${referenceSnapshotPath}`);
  } catch (error) {
    console.warn('⚠️ Impossible de créer le snapshot initial:', error);
  }

  console.log('🎉 Seeding terminé avec succès !');
}

main()
  .catch((e) => {
    console.error('❌ Erreur seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
