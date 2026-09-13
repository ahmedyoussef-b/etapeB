import { config as dotenvConfig } from 'dotenv';
import path from 'node:path';
import type { PrismaConfig } from 'prisma/config';

dotenvConfig();
dotenvConfig({ path: path.resolve('.env.local'), override: true });

const nodeEnv = process.env.NODE_ENV || 'development';

if (nodeEnv === 'production') {
  if (!process.env.DATABASE_URL && process.env.DATABASE_URL_NEON) {
    process.env.DATABASE_URL = process.env.DATABASE_URL_NEON;
  }
  if (!process.env.DIRECT_URL && process.env.DIRECT_URL_NEON) {
    process.env.DIRECT_URL = process.env.DIRECT_URL_NEON;
  }
} else {
  if (!process.env.DATABASE_URL && process.env.DATABASE_URL_LOCAL) {
    process.env.DATABASE_URL = process.env.DATABASE_URL_LOCAL;
  }
  if (!process.env.DIRECT_URL && process.env.DIRECT_URL_LOCAL) {
    process.env.DIRECT_URL = process.env.DIRECT_URL_LOCAL;
  }
}

// For Prisma CLI migrations, prefer DIRECT_URL (unpooled connection) to support advisory locks and prevent P1002 timeouts
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
    seed: 'npx tsx prisma/seed.ts'
  },
  datasource: {
    url: datasourceUrl
  }
} satisfies PrismaConfig;
