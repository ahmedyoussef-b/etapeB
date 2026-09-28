import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

async function increment(key: string, ttl: number = 86400): Promise<void> {
  try {
    await redis.incr(key);
    await redis.expire(key, ttl);
  } catch (e) {
    console.error("[METRICS] Erreur increment:", e);
  }
}

export async function trackGroqRequest(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await increment(`metrics:groq:${today}`);
}

export async function trackCacheHit(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await increment(`metrics:cache:hits:${today}`);
}

export async function trackCacheMiss(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await increment(`metrics:cache:misses:${today}`);
}

export async function trackRagLatency(latencyMs: number): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const key = `metrics:rag:latency:${today}`;
    const current = ((await redis.get<number>(key)) || 0) as number;
    const newAvg = current === 0 ? latencyMs : (current + latencyMs) / 2;
    await redis.set(key, newAvg, { ex: 86400 });
  } catch (e) {
    console.error("[METRICS] Erreur trackRagLatency:", e);
  }
}
