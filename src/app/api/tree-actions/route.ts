import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/options';
import { getPrismaClient } from '@/lib/services/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getWebFile(prisma: ReturnType<typeof getPrismaClient>, path: string) {
  return prisma.webFile.findUnique({ where: { path } });
}

async function handleRename(prisma: ReturnType<typeof getPrismaClient>, path: string, name?: string) {
  const newName = name?.trim();
  if (!newName) {
    return NextResponse.json({ error: 'Missing name for rename' }, { status: 400 });
  }

  const existing = await getWebFile(prisma, path);
  if (!existing) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const parts = path.split('/').filter(Boolean);
  parts[parts.length - 1] = newName;
  const newPath = parts.join('/');

  if (newPath === path) {
    return NextResponse.json({ success: true, path, oldPath: path });
  }

  const children = await prisma.webFile.findMany({
    where: { path: { startsWith: `${path}/` } },
  });

  await prisma.$transaction(async (tx) => {
    await (tx as any).webFile.update({
      where: { path },
      data: { path: newPath },
    });

    for (const child of children) {
      const suffix = child.path.slice(path.length);
      const updatedPath = `${newPath}${suffix}`;
      await (tx as any).webFile.update({
        where: { path: child.path },
        data: { path: updatedPath },
      });
    }
  });

  return NextResponse.json({ success: true, path: newPath, oldPath: path });
}

async function handleDelete(prisma: ReturnType<typeof getPrismaClient>, path: string) {
  const target = await getWebFile(prisma, path);
  if (!target) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  let deleted = 0;
  await prisma.$transaction(async (tx) => {
    const result = await (tx as any).webFile.deleteMany({
      where: {
        OR: [
          { path },
          { path: { startsWith: `${path}/` } },
        ],
      },
    });
    deleted = result.count;
  });

  return NextResponse.json({ success: true, deleted });
}

async function handleMkdir(prisma: ReturnType<typeof getPrismaClient>, path: string, name?: string) {
  const newName = name?.trim();
  if (!newName) {
    return NextResponse.json({ error: 'Missing name for mkdir' }, { status: 400 });
  }

  const newPath = path ? `${path}/${newName}` : newName;

  try {
    const created = await prisma.webFile.create({
      data: {
        path: newPath,
        content: '',
        mimeType: 'inode/directory',
        size: 0,
        hash: '',
      },
    });
    return NextResponse.json({ success: true, path: created.path });
  } catch (err) {
    return NextResponse.json({ error: 'Path already exists' }, { status: 409 });
  }
}

async function handleCreate(prisma: ReturnType<typeof getPrismaClient>, path: string, name?: string) {
  const fileName = name?.trim();
  if (!fileName) {
    return NextResponse.json({ error: 'Missing name for create' }, { status: 400 });
  }

  const newPath = path ? `${path}/${fileName}` : fileName;

  try {
    const created = await prisma.webFile.create({
      data: {
        path: newPath,
        content: '',
        mimeType: 'application/octet-stream',
        size: 0,
        hash: '',
      },
    });
    return NextResponse.json({ success: true, path: created.path });
  } catch (err) {
    return NextResponse.json({ error: 'Path already exists' }, { status: 409 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { action, path, source, name, repository } = body as {
      action?: string;
      path?: string;
      source?: string;
      name?: string;
      repository?: string;
    };

    if (source !== 'web') {
      return NextResponse.json(
        { error: 'Only web source is supported by this endpoint' },
        { status: 400 }
      );
    }

    if (!action || !path) {
      return NextResponse.json(
        { error: 'Missing action or path' },
        { status: 400 }
      );
    }

    const prisma = getPrismaClient();

    switch (action) {
      case 'rename':
        return await handleRename(prisma, path, name);
      case 'delete':
        return await handleDelete(prisma, path);
      case 'mkdir':
        return await handleMkdir(prisma, path, name);
      case 'create':
      case 'upload':
        return await handleCreate(prisma, path, name);
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (err) {
    console.error('[API /tree-actions] Erreur:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
