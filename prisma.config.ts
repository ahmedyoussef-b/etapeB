import { config as dotenvConfig } from 'dotenv';
import path from 'node:path';
import type { PrismaConfig } from 'prisma/config';

// Load .env files for local development (CLI usage: prisma migrate, prisma db push, etc.)
// On Vercel, env vars come from the dashboard — dotenv silently skips missing files.
dotenvConfig();
dotenvConfig({ path: path.resolve('.env.local') });

// Resolve the database URL for Prisma CLI (migrations, seed, etc.)
// Priority: DIRECT_URL (unpooled, required for migrations with advisory locks)
//         > DATABASE_URL (pooled, runtime queries)
//         > fallback variants (_LOCAL, _NEON)
//         > hardcoded local default
const datasourceUrl =
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL ||
  process.env.DATABASE_URL_LOCAL ||
  process.env.DATABASE_URL_NEON ||
  'postgresql://postgres:password123@localhost:5432/ccp_etape_b';

export default {
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'npx tsx --transpile-only prisma/seed.ts'
  },
  datasource: {
    url: datasourceUrl
  }
} satisfies PrismaConfig;
