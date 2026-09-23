import { PrismaClient } from '@prisma/client';
import { syncFromRepertoire } from '../../prisma/seed-from-repertoire';
import { SEED_FILES } from '../../lib/seed-data';
import { hash } from 'bcryptjs';
import { createHash } from 'node:crypto';

const DEFAULT_USERS = [
  { email: 'admin@nexaflow.local', name: 'Admin NexaFlow', role: 'ADMIN' as const, password: 'Admin123!' },
  { email: 'rondier@nexaflow.local', name: 'Rondier Test', role: 'RONDIER' as const, password: 'Rondier123!' },
  { email: 'chef.bloc@nexaflow.local', name: 'Chef de bloc', role: 'CHEF_DE_BLOC' as const, password: 'Chef123!' },
  { email: 'chef.quart@nexaflow.local', name: 'Chef de quart', role: 'CHEF_DE_QUART' as const, password: 'Quart123!' },
];

function getMimeType(path: string): string | undefined {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'json':
      return 'application/json';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'txt':
      return 'text/plain';
    case 'pdf':
      return 'application/pdf';
    case 'html':
      return 'text/html';
    case 'css':
      return 'text/css';
    case 'js':
      return 'application/javascript';
    case 'md':
      return 'text/markdown';
    default:
      return 'application/octet-stream';
  }
}

export async function seedDatabase(
  prisma: PrismaClient
): Promise<{ filesInserted: number; usersUpserted: number; webFilesInserted: number }> {
  await syncFromRepertoire(prisma, SEED_FILES);

  let usersUpserted = 0;
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
    usersUpserted++;
  }

  await prisma.webFile.deleteMany({});

  const webFiles = SEED_FILES.map((file) => ({
    path: file.path,
    content: file.content,
    mimeType: getMimeType(file.path),
    size: file.size,
    hash: createHash('sha256').update(file.content).digest('hex'),
  }));

  await prisma.webFile.createMany({
    data: webFiles,
    skipDuplicates: true,
  });

  return {
    filesInserted: SEED_FILES.length,
    usersUpserted,
    webFilesInserted: webFiles.length,
  };
}
