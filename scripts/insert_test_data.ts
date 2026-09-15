import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // SystemVersion
  await prisma.systemVersion.create({
    data: {
      id: 'test-version-1',
      version: 'v-test-' + Date.now(),
      publishedAt: new Date(),
      publishedBy: 'admin@nexaflow.local',
      changelog: 'Test de validation du dashboard',
      fileCount: 3,
    },
  });

  // PublishQueue entries
  await prisma.publishQueue.createMany({
    data: [
      {
        id: 'test-file-1',
        path: 'registry/test/fichier1.json',
        textContent: '{"test": 1}',
        hash: 'hash111',
        size: 100,
        version: 'v-test-1',
        publishedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        downloadCount: 0,
        transferredTo: [],
      },
      {
        id: 'test-file-2',
        path: 'registry/test/fichier2.json',
        textContent: '{"test": 2}',
        hash: 'hash222',
        size: 200,
        version: 'v-test-1',
        publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
        downloadCount: 2,
        transferredTo: ['user-1', 'user-2'],
      },
      {
        id: 'test-file-3',
        path: 'registry/test/expired.json',
        textContent: '{"test": 3}',
        hash: 'hash333',
        size: 300,
        version: 'v-test-1',
        publishedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        downloadCount: 5,
        transferredTo: ['user-3'],
      },
    ],
  });

  // UserSyncState entries
  await prisma.userSyncState.createMany({
    data: [
      {
        id: 'test-sync-1',
        userId: 'user-1',
        lastSyncAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        lastSyncVersion: 'v-test-1',
        pendingCount: 1,
        syncedFileIds: ['test-file-1'],
      },
      {
        id: 'test-sync-2',
        userId: 'user-2',
        lastSyncAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        lastSyncVersion: 'v-test-0',
        pendingCount: 2,
        syncedFileIds: [],
      },
    ],
  });

  console.log('Test data inserted');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
