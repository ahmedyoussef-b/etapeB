import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, hasPermission, unauthorizedResponse, unauthenticatedResponse } from '@/lib/api/auth-guard';
import { getPrismaClient } from '@/lib/services/db';
import { LocalDatabaseAdapter } from '@/lib/database/local-adapter';
import { WebDatabaseAdapter } from '@/lib/database/web-adapter';

interface CategoryItem {
  path: string;
  label: string;
  type: 'bloc' | 'group' | 'directory';
}

// Simple in-memory cache with TTL to avoid re-querying the DB on every call.
const cache = new Map<string, { data: CategoryItem[]; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCacheKey(source: string, query: string): string {
  return `cats:${source}:${query.toLowerCase()}`;
}

async function buildCategoriesFromPrisma(): Promise<CategoryItem[]> {
  const prisma = getPrismaClient();

  // Only fetch top-level entities: blocks and groups.
  // Equipment-level nodes are too granular for image categorization and
  // were causing payload bloat (thousands of entries) and UI freezes.
  const [blocks, groups] = await Promise.all([
    prisma.block.findMany({ orderBy: { code: 'asc' } }),
    prisma.group.findMany({ orderBy: { libelle: 'asc' } }),
  ]);

  const categories: CategoryItem[] = [];

  for (const block of blocks) {
    categories.push({
      path: `Centrale/${block.code}`,
      label: block.code,
      type: 'bloc',
    });
  }

  for (const group of groups) {
    categories.push({
      path: `Groupes/${group.libelle}`,
      label: group.libelle,
      type: 'group',
    });
  }

  return categories.sort((a, b) => a.label.localeCompare(b.label));
}

async function buildCategoriesFromDisk(): Promise<CategoryItem[]> {
  const adapter = new LocalDatabaseAdapter('.data');
  const categories: CategoryItem[] = [];

  // Only walk the top-level directories (depth 1) under Centrale/ and Groupes/.
  // This avoids the full recursive walk that returned every descendant node.
  async function walkTopLevel(rootDir: string) {
    let entries: string[];
    try {
      entries = await adapter.list(rootDir);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry === 'mirror_repertoire.json' || entry === 'mirror.json') continue;
      if (entry === 'system') continue;
      if (entry.startsWith('.') && !entry.endsWith('.meta.json')) continue;

      const fullPath = rootDir === '.' ? entry : `${rootDir}/${entry}`;

      // Only include directories (not files) at the top level.
      const isFile = entry.endsWith('.meta.json') ||
        /\.(json|jpg|jpeg|png|gif|bmp|svg|webp|pdf|txt|csv|xlsx|docx?|pptx?|zip|tar|gz|7z|mp3|mp4|avi|mov|wav|flac|mkv)$/i.test(entry);

      if (!isFile) {
        categories.push({
          path: fullPath,
          label: entry,
          type: 'directory',
        });
      }
    }
  }

  await walkTopLevel('Centrale');
  await walkTopLevel('Groupes');

  return categories.sort((a, b) => a.label.localeCompare(b.label));
}

function filterCategories(categories: CategoryItem[], query: string): CategoryItem[] {
  if (!query || query.trim().length === 0) return categories;
  const q = query.toLowerCase().trim();
  return categories.filter(c =>
    c.label.toLowerCase().includes(q) ||
    c.path.toLowerCase().includes(q)
  );
}

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return unauthenticatedResponse();
  }
  if (!hasPermission(user.role, 'banque-images:view')) {
    return unauthorizedResponse();
  }

  const url = new URL(request.url);
  const source = url.searchParams.get('source') || 'local';
  const query = url.searchParams.get('query') || '';

  const cacheKey = getCacheKey(source, query);
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json({
      success: true,
      categories: cached.data.map(c => c.label),
      fullPaths: cached.data,
      source,
      cached: true,
    }, { headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    let categories: CategoryItem[];

    if (source === 'web' || source === 'db') {
      const databaseUrl = process.env.DATABASE_URL || process.env.DATABASE_URL_NEON || '';
      const webUrl = process.env.WEB_API_URL;
      const apiKey = process.env.WEB_API_KEY;

      if (databaseUrl || webUrl) {
        const webAdapter = new WebDatabaseAdapter(webUrl || '', apiKey || '', !webUrl, databaseUrl);
        if (webAdapter.usePrisma) {
          categories = await buildCategoriesFromPrisma();
        } else {
          categories = await buildCategoriesFromDisk();
        }
      } else {
        categories = await buildCategoriesFromDisk();
      }
    } else {
      categories = await buildCategoriesFromDisk();
    }

    // Apply server-side filtering if a query is provided.
    categories = filterCategories(categories, query);

    // Cache the unfiltered result for future queries (filtering is done client-side too).
    const unfiltered = source === 'web' || source === 'db'
      ? (await buildCategoriesFromPrisma().catch(() => buildCategoriesFromDisk()))
      : await buildCategoriesFromDisk();
    const now = Date.now();
    cache.set(getCacheKey(source, ''), { data: unfiltered, expiresAt: now + CACHE_TTL_MS });
    // Clean expired entries periodically (lazy).
    const cacheKeys = Array.from(cache.keys());
    for (let i = 0; i < cacheKeys.length; i++) {
      const k = cacheKeys[i];
      const v = cache.get(k);
      if (v && v.expiresAt < now) cache.delete(k);
    }

    return NextResponse.json({
      success: true,
      categories: categories.map(c => c.label),
      fullPaths: categories,
      source,
      cached: false,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[API /structure/categories] error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      categories: ['Tous'],
    }, { status: 500 });
  }
}