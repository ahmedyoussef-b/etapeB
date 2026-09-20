import { getPrismaClient } from './db';
import { Prisma } from '@prisma/client';

export interface MediaItem {
  id: string;
  title: string;
  category: string;
  description: string;
  tags: string[];
  kind: 'image' | 'video';
  mimeType: string;
  size: number;
  dataUrl: string;
  thumbnailDataUrl?: string;
  createdAt: string;
  updatedAt: string;
}

function getExtension(mimeType: string, filename: string): string {
  if (filename.includes('.')) {
    const ext = filename.split('.').pop();
    if (ext) return ext;
  }
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  if (mimeType === 'image/svg+xml') return 'svg';
  if (mimeType === 'video/mp4') return 'mp4';
  if (mimeType === 'video/webm') return 'webm';
  return 'jpg';
}

function toPrismaDocument(item: MediaItem) {
  const ext = getExtension(item.mimeType, item.title);
  const cleanTitle = item.title.trim();
  const filename = cleanTitle.includes('.') ? cleanTitle : `${cleanTitle}.${ext}`;
  const cleanCategory = (item.category || '').replace(/^\/+|\/+$/g, '');
  const docPath = cleanCategory ? `${cleanCategory}/${filename}` : filename;

  let buffer: Buffer;
  if (item.dataUrl && item.dataUrl.startsWith('data:')) {
    const comma = item.dataUrl.indexOf(',');
    if (comma !== -1) {
      const base64Data = item.dataUrl.slice(comma + 1);
      buffer = Buffer.from(base64Data, 'base64');
    } else {
      buffer = Buffer.from(item.dataUrl, 'utf-8');
    }
  } else if (item.dataUrl) {
    buffer = Buffer.from(item.dataUrl, 'base64');
  } else {
    buffer = Buffer.alloc(0);
  }

  return {
    id: item.id,
    filename: filename,
    path: docPath,
    mimeType: item.mimeType || 'image/jpeg',
    size: item.size || buffer.length,
    data: buffer,
    metadata: {
      title: item.title,
      description: item.description,
      category: item.category,
      tags: item.tags,
      kind: item.kind,
      dataUrl: item.dataUrl,
      thumbnailDataUrl: item.thumbnailDataUrl || (item.dataUrl && item.dataUrl.length < 200000 ? item.dataUrl : undefined),
    } as Prisma.InputJsonValue,
    createdAt: new Date(item.createdAt),
    updatedAt: new Date(item.updatedAt),
  };
}

type PrismaDocument = {
  id: string;
  filename: string;
  path: string | null;
  mimeType: string | null;
  size: number | null;
  data: Buffer | Uint8Array<ArrayBuffer> | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
};

function fromPrismaDocument(row: PrismaDocument): MediaItem {
  const metadata = (row.metadata as Record<string, unknown> | null) || {};
  const buffer = row.data;
  const mimeType = row.mimeType || 'image/jpeg';
  let dataUrl = '';

  if (buffer) {
    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    if (buf.length > 0) {
      const sample = buf.toString('utf-8', 0, Math.min(buf.length, 50));
      if (sample.startsWith('data:image/') || sample.startsWith('data:video/')) {
        dataUrl = buf.toString('utf-8');
      } else {
        // Real binary bytes from database -> convert to valid base64 data URL
        dataUrl = `data:${mimeType};base64,${buf.toString('base64')}`;
      }
    }
  }

  // Fallback to metadata if data buffer was empty
  if (!dataUrl && typeof metadata.dataUrl === 'string' && metadata.dataUrl.startsWith('data:')) {
    dataUrl = metadata.dataUrl;
  }
  if (!dataUrl && typeof metadata.thumbnailDataUrl === 'string' && metadata.thumbnailDataUrl.startsWith('data:')) {
    dataUrl = metadata.thumbnailDataUrl;
  }

  let category = (metadata.category as string) || '';
  if (!category && row.path) {
    const lastSlash = row.path.lastIndexOf('/');
    if (lastSlash > 0) {
      category = row.path.substring(0, lastSlash);
      if (category.startsWith('images/')) category = category.slice(7);
    }
  }

  return {
    id: row.id,
    title: (metadata.title as string) || row.filename,
    category: category || 'Centrale',
    description: (metadata.description as string) || '',
    tags: (metadata.tags as string[]) || [],
    kind: (metadata.kind as MediaItem['kind']) || (mimeType.startsWith('video/') ? 'video' : 'image'),
    mimeType,
    size: row.size || (buffer ? buffer.length : 0),
    dataUrl,
    thumbnailDataUrl: (metadata.thumbnailDataUrl as string) || (dataUrl && dataUrl.length < 200000 ? dataUrl : undefined),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getAllMedia(): Promise<MediaItem[]> {
  const prisma = getPrismaClient();
  const rows = await prisma.document.findMany({
    where: {
      OR: [
        { path: { startsWith: 'images/' } },
        { mimeType: { startsWith: 'image/' } },
        { mimeType: { startsWith: 'video/' } },
        { metadata: { path: ['kind'], string_contains: 'image' } },
        { metadata: { path: ['kind'], string_contains: 'video' } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, filename: true, path: true, mimeType: true, size: true, data: true, metadata: true, createdAt: true, updatedAt: true },
  });
  return rows.map(fromPrismaDocument);
}

export async function getMediaById(id: string): Promise<MediaItem | undefined> {
  const prisma = getPrismaClient();
  const row = await prisma.document.findFirst({
    where: { id },
    select: { id: true, filename: true, path: true, mimeType: true, size: true, data: true, metadata: true, createdAt: true, updatedAt: true },
  });
  return row ? fromPrismaDocument(row) : undefined;
}

export async function createMedia(item: Omit<MediaItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<MediaItem> {
  const prisma = getPrismaClient();
  const now = new Date().toISOString();
  const data = toPrismaDocument({
    ...item,
    id: `media_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    createdAt: now,
    updatedAt: now,
  });

  // Handle path conflicts by appending timestamp if needed
  const existingWithSamePath = data.path ? await prisma.document.findUnique({ where: { path: data.path }, select: { id: true } }) : null;
  if (existingWithSamePath) {
    const ext = getExtension(data.mimeType || '', data.filename);
    const base = data.filename.replace(/\.[^.]+$/, '');
    data.filename = `${base}_${Date.now()}.${ext}`;
    const cleanCategory = (item.category || '').replace(/^\/+|\/+$/g, '');
    data.path = cleanCategory ? `${cleanCategory}/${data.filename}` : data.filename;
  }

  const row = await prisma.document.create({
    data: data as any,
    select: { id: true, filename: true, path: true, mimeType: true, size: true, data: true, metadata: true, createdAt: true, updatedAt: true },
  });
  return fromPrismaDocument(row);
}

export async function updateMedia(id: string, updates: Partial<Omit<MediaItem, 'id' | 'createdAt'>>): Promise<MediaItem | undefined> {
  const prisma = getPrismaClient();
  const existing = await prisma.document.findFirst({
    where: { id },
    select: { id: true, filename: true, path: true, mimeType: true, size: true, metadata: true },
  });
  if (!existing) return undefined;

  const mergedMetadata = { ...(existing.metadata as Record<string, unknown> | null) };
  if (updates.title !== undefined) mergedMetadata.title = updates.title;
  if (updates.description !== undefined) mergedMetadata.description = updates.description;
  if (updates.category !== undefined) mergedMetadata.category = updates.category;
  if (updates.tags !== undefined) mergedMetadata.tags = updates.tags;
  if (updates.thumbnailDataUrl !== undefined) mergedMetadata.thumbnailDataUrl = updates.thumbnailDataUrl;
  if (updates.dataUrl !== undefined) mergedMetadata.dataUrl = updates.dataUrl;

  const data: Record<string, unknown> = {
    updatedAt: new Date(),
    metadata: mergedMetadata as Prisma.InputJsonValue,
  };

  if (updates.dataUrl) {
    let buffer: Buffer;
    if (updates.dataUrl.startsWith('data:')) {
      const comma = updates.dataUrl.indexOf(',');
      buffer = comma !== -1 ? Buffer.from(updates.dataUrl.slice(comma + 1), 'base64') : Buffer.from(updates.dataUrl, 'utf-8');
    } else {
      buffer = Buffer.from(updates.dataUrl, 'base64');
    }
    data.data = buffer;
    data.size = updates.size || buffer.length;
  }

  if (updates.category !== undefined || updates.title !== undefined) {
    const category = updates.category !== undefined ? updates.category : (mergedMetadata.category as string || '');
    const title = updates.title !== undefined ? updates.title : existing.filename;
    const mimeType = updates.mimeType || existing.mimeType || 'image/jpeg';
    const ext = getExtension(mimeType, title);
    const filename = title.includes('.') ? title : `${title}.${ext}`;
    const cleanCategory = category.replace(/^\/+|\/+$/g, '');
    data.filename = filename;
    data.path = cleanCategory ? `${cleanCategory}/${filename}` : filename;
  }

  const row = await prisma.document.update({
    where: { id: existing.id },
    data,
    select: { id: true, filename: true, path: true, mimeType: true, size: true, data: true, metadata: true, createdAt: true, updatedAt: true },
  });
  return fromPrismaDocument(row);
}

export async function removeMedia(id: string): Promise<boolean> {
  const prisma = getPrismaClient();
  try {
    const result = await prisma.document.deleteMany({ where: { id } });
    return result.count > 0;
  } catch {
    return false;
  }
}

export async function getCategories(): Promise<string[]> {
  const prisma = getPrismaClient();
  const rows = await prisma.document.findMany({
    select: { path: true, metadata: true },
  });
  const cats = new Set<string>();
  for (const row of rows) {
    const metadata = (row.metadata as Record<string, unknown> | null) || {};
    const category = metadata.category as string | undefined;
    if (category) {
      cats.add(category);
    } else if (row.path) {
      const lastSlash = row.path.lastIndexOf('/');
      if (lastSlash > 0) {
        cats.add(row.path.substring(0, lastSlash));
      }
    }
  }
  return ['Tous', ...Array.from(cats).sort()];
}
