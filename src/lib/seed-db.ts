import { PrismaClient } from '@prisma/client';
import { syncFromRepertoire } from '../../prisma/seed-from-repertoire';
import { SEED_FILES } from '../../lib/seed-data';
import { hash } from 'bcryptjs';

const DEFAULT_USERS = [
  { email: 'admin@nexaflow.local', name: 'Admin NexaFlow', role: 'ADMIN' as const, password: 'Admin123!' },
  { email: 'rondier@nexaflow.local', name: 'Rondier Test', role: 'RONDIER' as const, password: 'Rondier123!' },
  { email: 'chef.bloc@nexaflow.local', name: 'Chef de bloc', role: 'CHEF_DE_BLOC' as const, password: 'Chef123!' },
  { email: 'chef.quart@nexaflow.local', name: 'Chef de quart', role: 'CHEF_DE_QUART' as const, password: 'Quart123!' },
];

export async function seedDatabase(
  prisma: PrismaClient
): Promise<{ filesInserted: number; usersUpserted: number }> {
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

  await prisma.document.upsert({
    where: { path: 'bank/.placeholder' },
    update: {
      filename: '.placeholder',
      mimeType: 'inode/directory',
      size: 0,
      data: Buffer.from(''),
    },
    create: {
      path: 'bank/.placeholder',
      filename: '.placeholder',
      mimeType: 'inode/directory',
      size: 0,
      data: Buffer.from(''),
    },
  });

  await prisma.document.upsert({
    where: { path: 'documents/.placeholder' },
    update: {
      filename: '.placeholder',
      mimeType: 'inode/directory',
      size: 0,
      data: Buffer.from(''),
    },
    create: {
      path: 'documents/.placeholder',
      filename: '.placeholder',
      mimeType: 'inode/directory',
      size: 0,
      data: Buffer.from(''),
    },
  });

  return {
    filesInserted: SEED_FILES.length,
    usersUpserted,
  };
}
