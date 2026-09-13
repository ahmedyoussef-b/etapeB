import 'dotenv/config';
import path from 'node:path';
import type { PrismaConfig } from 'prisma/config';

const nodeEnv = process.env.NODE_ENV || 'development';

// Load environment-specific .env file
if (nodeEnv === 'production') {
  // In production, ensure Neon URL is used
  if (!process.env.DATABASE_URL && process.env.DATABASE_URL_NEON) {
    process.env.DATABASE_URL = process.env.DATABASE_URL_NEON;
  }
} else {
  // In development, ensure local URL is used
  if (!process.env.DATABASE_URL && process.env.DATABASE_URL_LOCAL) {
    process.env.DATABASE_URL = process.env.DATABASE_URL_LOCAL;
  }
}

export default {
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'npx tsx prisma/seed.ts'
  },
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://user:pass@localhost:5432/app'
  }
} satisfies PrismaConfig;
