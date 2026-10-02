import { PrismaClient, Role } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

const TEST_USERS = [
  {
    email: 'rondier@test.nexaflow.local',
    name: 'Rondier Test',
    role: 'RONDIER' as Role,
    password: 'TestRondier2026!',
    team: 'Test',
  },
  {
    email: 'chef-de-bloc@test.nexaflow.local',
    name: 'Chef de Bloc Test',
    role: 'CHEF_DE_BLOC' as Role,
    password: 'TestChefBloc2026!',
    team: 'Test',
  },
  {
    email: 'chef-de-quart@test.nexaflow.local',
    name: 'Chef de Quart Test',
    role: 'CHEF_DE_QUART' as Role,
    password: 'TestChefQuart2026!',
    team: 'Test',
  },
];

async function seed() {
  for (const user of TEST_USERS) {
    const hashedPassword = await hash(user.password, 10);

    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        password: hashedPassword,
        active: true,
        team: user.team,
      },
      create: {
        email: user.email,
        name: user.name,
        role: user.role,
        password: hashedPassword,
        active: true,
        team: user.team,
      },
    });

    console.log(`✅ Seeded: ${user.email} (${user.role})`);
  }
}

seed()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
