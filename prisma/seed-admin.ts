import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function seedAdmin() {
  console.log('🌱 Seed admin par défaut...');

  const adminExists = await prisma.user.findFirst({
    where: { role: 'ADMIN' }
  });

  if (!adminExists) {
    const hashedPassword = await bcrypt.hash('Admin123!', 10);
    
    await prisma.user.create({
      data: {
        email: 'admin@nexaflow.local',
        name: 'Administrateur',
        role: 'ADMIN',
        password: hashedPassword,
      },
    });
    console.log('✅ Admin créé par défaut');
  } else {
    console.log('ℹ️ Admin déjà présent, aucun changement');
  }
}

seedAdmin()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
