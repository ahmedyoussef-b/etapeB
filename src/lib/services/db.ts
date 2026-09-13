import { PrismaClient } from '@prisma/client';
import {
  getSharedPrismaClient,
  executeWithDatabase,
  ensureDatabaseConnection,
  isDatabaseAvailable,
  getDatabaseHealth,
  withTimeout,
} from '@/lib/database/connection-manager';

export function getPrismaClient(): PrismaClient {
  const client = getSharedPrismaClient();
  if (!client) {
    throw new Error('Database connection is not available. DATABASE_URL is not configured.');
  }
  return client;
}

export { executeWithDatabase, ensureDatabaseConnection, withTimeout, isDatabaseAvailable, getDatabaseHealth };
