import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

type CircuitState = 'closed' | 'open' | 'half-open';

interface HealthStatus {
  state: CircuitState;
  consecutiveFailures: number;
  lastFailure: number | null;
  nextRetry: number | null;
}

interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  timestamp: number;
  data?: any;
  code?: string;
}

interface Metrics {
  fallbackCount: number;
  bddLatencyMs: number;
  fileLatencyMs: number;
  lastBddSuccess: number | null;
  lastFallback: number | null;
  queueSize: number;
}

type ProcedureCreate = any;
type ProcedureUpdate = any;

class DatabaseCircuitBreaker {
  private state: CircuitState = 'closed';
  private consecutiveFailures = 0;
  private lastFailure: number | null = null;
  private nextRetry: number | null = null;

  readonly maxFailures = 3;
  readonly cooldownMs = 30_000;

  getStatus(): HealthStatus {
    const now = Date.now();
    if (this.state === 'open' && this.nextRetry !== null && now >= this.nextRetry) {
      this.state = 'half-open';
      this.nextRetry = null;
    }
    return {
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      lastFailure: this.lastFailure,
      nextRetry: this.nextRetry,
    };
  }

  recordSuccess() {
    this.consecutiveFailures = 0;
    this.state = 'closed';
    this.lastFailure = null;
    this.nextRetry = null;
  }

  recordFailure() {
    this.consecutiveFailures += 1;
    this.lastFailure = Date.now();
    if (this.consecutiveFailures >= this.maxFailures) {
      this.state = 'open';
      this.nextRetry = this.lastFailure + this.cooldownMs;
    }
  }

  canAttempt(): boolean {
    return this.getStatus().state !== 'open';
  }
}

class FallbackThrottle {
  private failures: number[] = [];
  readonly maxFailures = 5;
  readonly windowMs = 60_000;

  canAttempt(): boolean {
    const now = Date.now();
    this.failures = this.failures.filter((t) => now - t < this.windowMs);
    return this.failures.length < this.maxFailures;
  }

  recordFailure() {
    this.failures.push(Date.now());
  }

  getStatus() {
    const now = Date.now();
    const recent = this.failures.filter((t) => now - t < this.windowMs).length;
    return {
      recentFailures: recent,
      maxFailures: this.maxFailures,
      windowMs: this.windowMs,
      throttled: recent >= this.maxFailures,
    };
  }
}

class DatabaseMetrics {
  private _fallbackCount = 0;
  private _bddLatencyMs = 0;
  private _fileLatencyMs = 0;
  private _lastBddSuccess: number | null = null;
  private _lastFallback: number | null = null;
  private _queueSize = 0;

  recordFallback() {
    this._fallbackCount += 1;
    this._lastFallback = Date.now();
  }

  recordBddLatency(ms: number) {
    this._bddLatencyMs = ms;
    this._lastBddSuccess = Date.now();
  }

  recordFileLatency(ms: number) {
    this._fileLatencyMs = ms;
  }

  setQueueSize(size: number) {
    this._queueSize = size;
  }

  getMetrics(): Metrics {
    return {
      fallbackCount: this._fallbackCount,
      bddLatencyMs: this._bddLatencyMs,
      fileLatencyMs: this._fileLatencyMs,
      lastBddSuccess: this._lastBddSuccess,
      lastFallback: this._lastFallback,
      queueSize: this._queueSize,
    };
  }

  reset() {
    this._fallbackCount = 0;
    this._bddLatencyMs = 0;
    this._fileLatencyMs = 0;
    this._lastBddSuccess = null;
    this._lastFallback = null;
    this._queueSize = 0;
  }
}

class SyncQueue {
  private queue: SyncOperation[] = [];
  private processing = false;
  private readonly maxBatchSize = 10;

  enqueue(operation: Omit<SyncOperation, 'id' | 'timestamp'>) {
    this.queue.push({
      ...operation,
      id: `sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    });
  }

  async drain(handler: (operations: SyncOperation[]) => Promise<void>) {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    try {
      while (this.queue.length > 0) {
        const batch = this.queue.splice(0, this.maxBatchSize);
        await handler(batch);
      }
    } finally {
      this.processing = false;
    }
  }

  get size() {
    return this.queue.length;
  }
}

const circuitBreaker = new DatabaseCircuitBreaker();
const fallbackThrottle = new FallbackThrottle();
const metrics = new DatabaseMetrics();
const syncQueue = new SyncQueue();

export function getDatabaseHealth(): HealthStatus {
  return circuitBreaker.getStatus();
}

export function isDatabaseAvailable(): boolean {
  return circuitBreaker.canAttempt();
}

function isRetryablePrismaError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const code = (error as { code?: string }).code;
    return code === 'P1001' || code === 'P1008' || code === 'P1017';
  }
  return false;
}

function isServerlessEnvironment(): boolean {
  if (typeof process === 'undefined') return false;
  const env = process.env;
  return (
    env.VERCEL === '1' ||
    env.AWS_LAMBDA_FUNCTION_NAME !== undefined ||
    env.FUNCTION_NAME !== undefined ||
    env.AZURE_FUNCTIONS_ENVIRONMENT !== undefined ||
    env.GOOGLE_CLOUD_PROJECT !== undefined ||
    env.CF_PAGES === '1'
  );
}

const SERVERLESS = isServerlessEnvironment();

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries && isRetryablePrismaError(error)) {
        const delay = Math.pow(2, attempt) * 500;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

function withTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Database operation timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

async function validateConnection(prisma: PrismaClient): Promise<boolean> {
  try {
    await prisma.$executeRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function disconnectClient(prisma: PrismaClient): Promise<void> {
  try {
    await prisma.$disconnect();
  } catch {
    // Ignore disconnect errors
  }
}

// eslint-disable-next-line no-var
declare global {
  // eslint-disable-next-line no-var
  var __prismaConnectionManagerClient: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var __prismaConnectionManagerUrl: string | undefined;
}

export function resolveDatabaseUrl(explicitUrl?: string): string | undefined {
  return explicitUrl || process.env.DATABASE_URL || process.env.DATABASE_URL_NEON || undefined;
}

export function getSharedPrismaClient(databaseUrl?: string): PrismaClient | null {
  const url = resolveDatabaseUrl(databaseUrl);

  if (!url) {
    return null;
  }

  if (globalThis.__prismaConnectionManagerClient && globalThis.__prismaConnectionManagerUrl === url) {
    if (SERVERLESS) {
      const healthy = validateConnection(globalThis.__prismaConnectionManagerClient);
      if (!healthy) {
        console.warn('[Database] Cached Prisma client is unhealthy in serverless environment, recreating...');
        disconnectClient(globalThis.__prismaConnectionManagerClient);
        globalThis.__prismaConnectionManagerClient = undefined;
        globalThis.__prismaConnectionManagerUrl = undefined;
      } else {
        return globalThis.__prismaConnectionManagerClient;
      }
    } else {
      return globalThis.__prismaConnectionManagerClient;
    }
  }

  if (globalThis.__prismaConnectionManagerClient && globalThis.__prismaConnectionManagerUrl !== url) {
    disconnectClient(globalThis.__prismaConnectionManagerClient);
  }

  const isNeon = url.includes('neon') || url.includes('pooler');
  const separator = url.includes('?') ? '&' : '?';
  const poolParams = isNeon
    ? `${separator}connection_limit=5&pool_timeout=10&connect_timeout=10&idle_in_transaction_session_timeout=30000`
    : `${separator}connection_limit=10&pool_timeout=10&connect_timeout=10`;
  const fullUrl = url + poolParams;

  const adapter = new PrismaPg({ connectionString: fullUrl });
  const prisma = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
  });

  globalThis.__prismaConnectionManagerClient = prisma;
  globalThis.__prismaConnectionManagerUrl = url;

  return prisma;
}

let startupHealthChecked = false;

export async function ensureDatabaseConnection(): Promise<PrismaClient | null> {
  const prisma = getSharedPrismaClient();
  if (!prisma) {
    return null;
  }

  if (!startupHealthChecked) {
    startupHealthChecked = true;
    try {
      const healthy = await validateConnection(prisma);
      if (!healthy) {
        console.warn('[Database] Startup health-check failed, recreating Prisma client...');
        await disconnectClient(prisma);
        globalThis.__prismaConnectionManagerClient = undefined;
        globalThis.__prismaConnectionManagerUrl = undefined;

        const newPrisma = getSharedPrismaClient();
        if (newPrisma) {
          await validateConnection(newPrisma);
          return newPrisma;
        }
        return null;
      }
      console.log('[Database] Startup health-check passed');
    } catch (error) {
      console.warn('[Database] Startup health-check error:', error);
      await disconnectClient(prisma);
      globalThis.__prismaConnectionManagerClient = undefined;
      globalThis.__prismaConnectionManagerUrl = undefined;

      const newPrisma = getSharedPrismaClient();
      if (newPrisma) {
        return newPrisma;
      }
      return null;
    }
  }

  return prisma;
}

export async function executeWithDatabase<T>(fn: (prisma: PrismaClient) => Promise<T>, maxRetries = 2): Promise<T> {
  if (!circuitBreaker.canAttempt()) {
    throw new Error('Database is temporarily unavailable due to repeated failures');
  }

  const prisma = getSharedPrismaClient();
  if (!prisma) {
    throw new Error('Database connection is not available. DATABASE_URL is not configured.');
  }

  try {
    const result = await withRetry(() => withTimeout(() => fn(prisma), 5000), maxRetries);
    circuitBreaker.recordSuccess();
    return result;
  } catch (error) {
    circuitBreaker.recordFailure();
    throw error;
  }
}

export async function executeWithDatabaseTimed<T>(fn: (prisma: PrismaClient) => Promise<T>, maxRetries = 2): Promise<{ result: T; durationMs: number }> {
  const start = Date.now();
  const result = await executeWithDatabase(fn, maxRetries);
  const durationMs = Date.now() - start;
  metrics.recordBddLatency(durationMs);
  return { result, durationMs };
}

export function enqueueSyncOperation(operation: Omit<SyncOperation, 'id' | 'timestamp'>) {
  syncQueue.enqueue(operation);
  metrics.setQueueSize(syncQueue.size);
}

export async function drainSyncQueue(handler: (operations: SyncOperation[]) => Promise<void>) {
  await syncQueue.drain(handler);
  metrics.setQueueSize(syncQueue.size);
}

export function recordFallback(latencyMs?: number) {
  metrics.recordFallback();
  fallbackThrottle.recordFailure();
  if (latencyMs) {
    metrics.recordFileLatency(latencyMs);
  }
}

export function canUseFallback(): boolean {
  return fallbackThrottle.canAttempt();
}

export function getFallbackThrottleStatus() {
  return fallbackThrottle.getStatus();
}

export function getDatabaseMetrics(): Metrics {
  return metrics.getMetrics();
}

export { withRetry, withTimeout, isRetryablePrismaError };
export { getSharedPrismaClient as getPrismaClient };
