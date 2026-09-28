import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth-guard";
import { getPrismaClient } from "@/lib/services/db";
import { Redis } from "@upstash/redis";

interface Metric {
  name: string;
  current: number;
  limit: number;
  unit: string;
  status: "ok" | "warning" | "critical";
  percent: number;
  details?: string;
}

export const GET = withAuth(async () => {
  const metrics: Metric[] = [];

  // 1. Neon Storage
  try {
    const prisma = getPrismaClient();
    const result = await prisma.$queryRaw<{ size: bigint }[]>`
      SELECT pg_database_size(current_database()) AS size
    `;
    const sizeBytes = Number(result[0]?.size || 0);
    const sizeMB = sizeBytes / (1024 * 1024);
    metrics.push({
      name: "Neon Storage",
      current: Math.round(sizeMB * 100) / 100,
      limit: 500,
      unit: "MB",
      percent: Math.round((sizeMB / 500) * 10000) / 100,
      status: sizeMB >= 450 ? "critical" : sizeMB >= 300 ? "warning" : "ok",
    });
  } catch (e) {
    metrics.push({
      name: "Neon Storage",
      current: 0,
      limit: 500,
      unit: "MB",
      percent: 0,
      status: "ok",
      details: "Erreur de lecture",
    });
  }

  // 2. Cloudflare Neurons
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/usage`,
      {
        headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` },
      }
    );
    if (res.ok) {
      const data = await res.json();
      const neurons = data.result?.neurons_today || 0;
      metrics.push({
        name: "Cloudflare Neurons",
        current: neurons,
        limit: 10000,
        unit: "/jour",
        percent: Math.round((neurons / 10000) * 10000) / 100,
        status: neurons >= 8000 ? "critical" : neurons >= 6000 ? "warning" : "ok",
      });
    }
  } catch (e) {
    metrics.push({
      name: "Cloudflare Neurons",
      current: 0,
      limit: 10000,
      unit: "/jour",
      percent: 0,
      status: "ok",
      details: "API non accessible",
    });
  }

  // 3. Upstash Commands (non disponible via Upstash Redis REST API)
  try {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
    const connected = await redis.ping();
    const commands = connected === "PONG" ? 1 : 0;
    metrics.push({
      name: "Upstash Connecté",
      current: commands,
      limit: 1,
      unit: "",
      percent: commands * 100,
      status: commands === 1 ? "ok" : "critical",
    });
  } catch (e) {
    metrics.push({
      name: "Upstash Connecté",
      current: 0,
      limit: 1,
      unit: "",
      percent: 0,
      status: "critical",
      details: "Redis non accessible",
    });
  }

  // 4. Groq Requests
  try {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
    const today = new Date().toISOString().slice(0, 10);
    const groqCount = ((await redis.get<number>(`metrics:groq:${today}`)) || 0) as number;
    metrics.push({
      name: "Groq Requests",
      current: groqCount,
      limit: 10000,
      unit: "/jour",
      percent: Math.round((groqCount / 10000) * 10000) / 100,
      status: groqCount >= 10000 ? "critical" : groqCount >= 8000 ? "warning" : "ok",
    });
  } catch (e) {
    metrics.push({
      name: "Groq Requests",
      current: 0,
      limit: 10000,
      unit: "/jour",
      percent: 0,
      status: "ok",
    });
  }

  // 5. Documents (proxy pour les vecteurs)
  try {
    const prisma = getPrismaClient();
    const count = await prisma.document.count();
    metrics.push({
      name: "Documents",
      current: count,
      limit: 10000,
      unit: "",
      percent: Math.round((count / 10000) * 10000) / 100,
      status: count >= 8000 ? "critical" : count >= 5000 ? "warning" : "ok",
    });
  } catch (e) {
    metrics.push({
      name: "Documents",
      current: 0,
      limit: 10000,
      unit: "",
      percent: 0,
      status: "ok",
    });
  }

  // 6. Cache Hit Rate
  try {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
    const today = new Date().toISOString().slice(0, 10);
    const hits = ((await redis.get<number>(`metrics:cache:hits:${today}`)) || 0) as number;
    const misses = ((await redis.get<number>(`metrics:cache:misses:${today}`)) || 0) as number;
    const total = hits + misses;
    const hitRate = total > 0 ? (hits / total) * 100 : 0;
    metrics.push({
      name: "Cache Hit Rate",
      current: Math.round(hitRate * 10) / 10,
      limit: 100,
      unit: "%",
      percent: Math.round(hitRate * 100) / 100,
      status: hitRate >= 70 ? "ok" : hitRate >= 40 ? "warning" : "critical",
    });
  } catch (e) {
    metrics.push({
      name: "Cache Hit Rate",
      current: 0,
      limit: 100,
      unit: "%",
      percent: 0,
      status: "ok",
    });
  }

  // 7. Latence moyenne RAG
  try {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
    const today = new Date().toISOString().slice(0, 10);
    const latency = ((await redis.get<number>(`metrics:rag:latency:${today}`)) || 0) as number;
    metrics.push({
      name: "Latence RAG moyenne",
      current: Math.round(latency),
      limit: 2000,
      unit: "ms",
      percent: Math.round((latency / 2000) * 10000) / 100,
      status: latency >= 1500 ? "critical" : latency >= 800 ? "warning" : "ok",
    });
  } catch (e) {
    metrics.push({
      name: "Latence RAG moyenne",
      current: 0,
      limit: 2000,
      unit: "ms",
      percent: 0,
      status: "ok",
    });
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    metrics,
  });
});
