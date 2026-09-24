export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { LocalDatabaseAdapter } from '@/lib/database/local-adapter';
import { WebDatabaseAdapter } from '@/lib/database/web-adapter';
import { getAuthenticatedUser, hasPermission, unauthorizedResponse, unauthenticatedResponse } from '@/lib/api/auth-guard';
import { getPrismaClient } from '@/lib/services/db';
import { WORKING_REPOSITORY_NAME } from '@/lib/config/repository';

const TEXT_EXTENSIONS = ['.txt', '.json', '.md', '.csv', '.xml', '.log', '.yaml', '.yml', '.tsv'];
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'];
const PDF_EXTENSIONS = ['.pdf'];

const getExtension = (path: string) => {
  const idx = path.lastIndexOf('.');
  return idx >= 0 ? path.slice(idx).toLowerCase() : '';
};

const isText = (path: string) => TEXT_EXTENSIONS.includes(getExtension(path));
const isImage = (path: string) => IMAGE_EXTENSIONS.includes(getExtension(path));
const isPdf = (path: string) => PDF_EXTENSIONS.includes(getExtension(path));

function mapWebPathToAdapter(path: string): string {
  if (path === '.data' || path === '.data/') return '.';
  if (path.startsWith('.data/')) return path.slice(6);
  return path;
}

function getImageMime(ext: string) {
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.png') return 'image/png';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.bmp') return 'image/bmp';
  return 'image/jpeg';
}

function buildFileResponse(buffer: Buffer, adapterPath: string, sourceUsed: string, cache: boolean) {
  const ext = getExtension(adapterPath);
  if (isText(adapterPath)) {
    return NextResponse.json({
      success: true,
      kind: 'text',
      content: buffer.toString('utf-8'),
      size: buffer.length,
      mimeType: 'text/plain',
      sourceUsed: sourceUsed
    }, cache ? { headers: { 'Cache-Control': 'public, max-age=60, must-revalidate' } } : undefined);
  }
  if (isImage(adapterPath)) {
    const mime = getImageMime(ext);
    return NextResponse.json({
      success: true,
      kind: 'image',
      content: `data:${mime};base64,${buffer.toString('base64')}`,
      size: buffer.length,
      mimeType: mime,
      sourceUsed: sourceUsed
    }, cache ? { headers: { 'Cache-Control': 'public, max-age=60, must-revalidate' } } : undefined);
  }
  if (isPdf(adapterPath)) {
    return NextResponse.json({
      success: true,
      kind: 'pdf',
      content: `data:application/pdf;base64,${buffer.toString('base64')}`,
      size: buffer.length,
      mimeType: 'application/pdf',
      sourceUsed: sourceUsed
    }, cache ? { headers: { 'Cache-Control': 'public, max-age=60, must-revalidate' } } : undefined);
  }
  return NextResponse.json({
    success: true,
    kind: 'binary',
    content: buffer.toString('base64'),
    size: buffer.length,
    mimeType: 'application/octet-stream',
    sourceUsed: sourceUsed
  }, cache ? { headers: { 'Cache-Control': 'public, max-age=60, must-revalidate' } } : undefined);
}

/**
 * Q/R files are stored in the `Document` table under versioned paths like
 * `registry/items/{baseName}/{baseName}_vN.json`. When the caller requests the
 * flat path `registry/items/{baseName}.json` (which no longer exists after the
 * second upload), this helper finds the latest version and returns its content.
 *
 * Also falls back to the `IndexRecord` table (type='qr') for legacy Q/R data.
 */
async function loadQrContent(requestPath: string): Promise<string | null> {
  if (!requestPath.endsWith('.json')) return null;
  const parts = requestPath.split('/').filter(p => p);
  if (parts.length < 3 || parts[0] !== 'registry') return null;

  const prisma = getPrismaClient();

  // 1. Try the exact Document path (flat file, first upload)
  try {
    const exactDoc = await prisma.document.findUnique({
      where: { path: requestPath },
      select: { data: true }
    });
    if (exactDoc?.data) {
      return Buffer.from(exactDoc.data).toString('utf-8');
    }
  } catch { /* ignore */ }

  if (parts[1] === 'items') {
    const baseName = parts[2].replace(/\.json$/, '');

    // 2. Try the versioned directory: registry/items/{baseName}/{baseName}_vN.json
    try {
      const dirPrefix = `registry/items/${baseName}/`;
      const docs = await prisma.document.findMany({
        where: { path: { startsWith: dirPrefix } },
        select: { path: true, data: true },
        orderBy: { path: 'desc' }
      });
      if (docs.length > 0) {
        const latest = docs[0];
        if (latest.data) {
          return Buffer.from(latest.data).toString('utf-8');
        }
      }
    } catch { /* ignore */ }

    // 3. Fall back to IndexRecord (type='qr') for legacy Q/R data
    try {
      const qrIndex = await prisma.indexRecord.findUnique({ where: { type: 'qr' } });
      if (qrIndex && qrIndex.data) {
        const data = qrIndex.data as { items?: unknown[] };
        if (Array.isArray(data.items)) {
          return JSON.stringify(data.items, null, 2);
        }
      }
    } catch { /* ignore */ }
  }

  if (parts[1] === 'procedures' && parts.length >= 3) {
    const procCode = parts[2];
    // Try the exact path first
    try {
      const exactDoc = await prisma.document.findUnique({
        where: { path: requestPath },
        select: { data: true }
      });
      if (exactDoc?.data) {
        return Buffer.from(exactDoc.data).toString('utf-8');
      }
    } catch { /* ignore */ }

    // Try the standard procedure.json path
    try {
      const procDoc = await prisma.document.findUnique({
        where: { path: `registry/procedures/${procCode}/procedure.json` },
        select: { data: true }
      });
      if (procDoc?.data) {
        return Buffer.from(procDoc.data).toString('utf-8');
      }
    } catch { /* ignore */ }

    // Try versioned paths: registry/procedures/{code}/{code}_vN.json
    try {
      const dirPrefix = `registry/procedures/${procCode}/`;
      const docs = await prisma.document.findMany({
        where: { path: { startsWith: dirPrefix } },
        select: { path: true, data: true },
        orderBy: { path: 'desc' }
      });
      if (docs.length > 0) {
        const latest = docs[0];
        if (latest.data) {
          return Buffer.from(latest.data).toString('utf-8');
        }
      }
    } catch { /* ignore */ }

    // Fall back to the Procedure table (structured data)
    try {
      const proc = await prisma.procedure.findUnique({
        where: { code: procCode },
        select: { steps: true, metadata: true, title: true, description: true, category: true, priority: true, status: true, estimatedTimeMinutes: true, equipmentCode: true, createdAt: true, updatedAt: true }
      });
      if (proc) {
        return JSON.stringify({
          code: procCode,
          title: proc.title,
          description: proc.description,
          category: proc.category,
          priority: proc.priority,
          status: proc.status,
          estimatedTimeMinutes: proc.estimatedTimeMinutes,
          equipmentCode: proc.equipmentCode,
          steps: proc.steps,
          metadata: proc.metadata,
          createdAt: proc.createdAt.toISOString(),
          updatedAt: proc.updatedAt.toISOString(),
        }, null, 2);
      }
    } catch { /* ignore */ }
  }

  return null;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const source = url.searchParams.get('source') || 'local';
  const path = url.searchParams.get('path');

  if (source !== 'web') {
    let user;
    try {
      user = await getAuthenticatedUser(request);
    } catch {
      return unauthenticatedResponse();
    }
    if (!user) return unauthenticatedResponse();
    if (!hasPermission(user.role, 'settings:*')) return unauthorizedResponse();
  }

  if (!path) {
    return NextResponse.json({ success: false, error: 'Chemin requis' }, { status: 400 });
  }

  const repository = url.searchParams.get('repository');

  if (source === 'web') {
    const sanitized = path.replace(/^(\.\.(\/)?)+/, '');
    if (sanitized !== path || path.startsWith('/')) {
      return NextResponse.json({ success: false, error: 'Chemin invalide' }, { status: 400 });
    }
  }

  try {
    const adapterPath = source === 'web' ? mapWebPathToAdapter(path) : path;

    if (source === 'web') {
      const webUrl = process.env.WEB_API_URL;
      const apiKey = process.env.WEB_API_KEY;
      const databaseUrl = process.env.DATABASE_URL;
      if (!webUrl && !databaseUrl) {
        return NextResponse.json({ success: false, error: 'BDD Web non configurée (DATABASE_URL ou WEB_API_URL requis)' }, { status: 503 });
      }

      const webAdapter = new WebDatabaseAdapter(webUrl || '', apiKey || '', true, databaseUrl);
      let buffer: Buffer | null = null;
      let readSource: string | null = null;

      // 1. Q/R content
      const qrData = await loadQrContent(adapterPath);
      if (qrData) {
        return NextResponse.json({
          success: true,
          kind: 'text',
          content: qrData,
          size: qrData.length,
          mimeType: 'text/plain',
          sourceUsed: 'web'
        }, { headers: { 'Cache-Control': 'public, max-age=60, must-revalidate' } });
      }

      // 2. Web adapter
      try {
        buffer = await webAdapter.read(adapterPath);
        readSource = 'web';
      } catch { /* not in web */ }

      // 3. Fallback .data/
      if (!buffer) {
        try {
          const canonicalAdapter = new LocalDatabaseAdapter('.data');
          buffer = await canonicalAdapter.read(adapterPath);
          readSource = 'local';
        } catch { /* not in .data */ }
      }

      // 4. Fallback workspace
      if (!buffer) {
        const activeRepo = repository || WORKING_REPOSITORY_NAME;
        const workspaceAdapter = new LocalDatabaseAdapter(activeRepo);
        buffer = await workspaceAdapter.read(adapterPath);
        readSource = 'local';
      }

      if (!buffer) {
        return NextResponse.json({ success: false, error: 'Fichier introuvable' }, { status: 404 });
      }

      return buildFileResponse(buffer, adapterPath, readSource!, true);
    }

    const activeRepo = repository || WORKING_REPOSITORY_NAME;
    const adapter = new LocalDatabaseAdapter(activeRepo);
    const buffer = await adapter.read(adapterPath);
    return buildFileResponse(buffer, adapterPath, 'local', false);
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
