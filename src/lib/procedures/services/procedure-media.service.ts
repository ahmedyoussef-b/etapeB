import { getPrismaClient } from '@/lib/services/db';
import { Prisma } from '@prisma/client';
import { updateIndexOnWebWrite, resolveStorageRoot, sha256 } from '@/lib/services/sync/sync-index';
import * as nodePath from 'node:path';

export interface ProcedureMediaItem {
  id: string;
  procedureCode: string;
  stepId: string;
  stepOrder: number;
  type: 'photo' | 'video' | 'audio' | 'signature';
  filename: string;
  mimeType: string;
  size: number;
  data: Buffer;
  geolocation?: { latitude: number; longitude: number } | null;
  timestamp: number;
  capturedAt: string;
  uploadedBy?: string;
  metadata?: Record<string, unknown>;
  path: string;
}

function getExtension(mimeType: string, filename: string): string {
  if (filename.includes('.')) {
    const ext = filename.split('.').pop();
    if (ext) return ext;
  }
  const map: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
    'image/webp': 'webp', 'image/gif': 'gif',
    'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
    'audio/wav': 'wav', 'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a',
  };
  return map[mimeType] || 'bin';
}

function toPrismaDocument(item: ProcedureMediaItem) {
  const ext = getExtension(item.mimeType, item.filename);
  const cleanName = item.filename.replace(/\.[^.]+$/, '');
  const filename = `${cleanName}.${ext}`;
  const mediaPath = `registry/procedures/${item.procedureCode}/media/${item.stepId}_${item.type}_${item.id.slice(0, 8)}.${ext}`;

  return {
    id: item.id,
    filename,
    path: mediaPath,
    mimeType: item.mimeType,
    size: item.size,
    data: item.data,
    metadata: {
      procedureCode: item.procedureCode,
      stepId: item.stepId,
      stepOrder: item.stepOrder,
      type: item.type,
      geolocation: item.geolocation,
      timestamp: item.timestamp,
      capturedAt: item.capturedAt,
      uploadedBy: item.uploadedBy,
      ...item.metadata,
    } as Prisma.InputJsonValue,
    createdAt: new Date(item.capturedAt),
    updatedAt: new Date(),
  };
}

function fromPrismaDocument(row: any): ProcedureMediaItem {
  const metadata = (row.metadata as Record<string, unknown>) || {};
  return {
    id: row.id,
    procedureCode: (metadata.procedureCode as string) || '',
    stepId: (metadata.stepId as string) || '',
    stepOrder: (metadata.stepOrder as number) || 0,
    type: (metadata.type as ProcedureMediaItem['type']) || 'photo',
    filename: row.filename,
    mimeType: row.mimeType || 'application/octet-stream',
    size: row.size || 0,
    data: Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data || []),
    geolocation: (metadata.geolocation as { latitude: number; longitude: number } | null) || null,
    timestamp: (metadata.timestamp as number) || new Date(row.createdAt).getTime(),
    capturedAt: (metadata.capturedAt as string) || row.createdAt.toISOString(),
    uploadedBy: (metadata.uploadedBy as string) || undefined,
    metadata,
    path: row.path || '',
  };
}

export async function saveProcedureMedia(
  procedureCode: string,
  stepId: string,
  stepOrder: number,
  media: {
    name: string;
    data: Buffer;
    mimeType: string;
    type: 'photo' | 'video' | 'audio' | 'signature';
    geolocation?: { latitude: number; longitude: number } | null;
    timestamp?: number;
    uploadedBy?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<ProcedureMediaItem> {
  const prisma = getPrismaClient();
  const now = new Date().toISOString();
  const item: ProcedureMediaItem = {
    id: `pmedia_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    procedureCode,
    stepId,
    stepOrder,
    type: media.type,
    filename: media.name,
    mimeType: media.mimeType,
    size: media.data.length,
    data: media.data,
    geolocation: media.geolocation || null,
    timestamp: media.timestamp || Date.now(),
    capturedAt: now,
    uploadedBy: media.uploadedBy,
    metadata: media.metadata,
    path: '',
  };

  const doc = toPrismaDocument(item);

  const row = await prisma.document.create({
    data: doc as any,
    select: { id: true, filename: true, path: true, mimeType: true, size: true, data: true, metadata: true, createdAt: true, updatedAt: true },
  });

  const storageRoot = resolveStorageRoot();
  await updateIndexOnWebWrite(storageRoot, 'upsert', {
    path: row.path || '',
    name: row.filename,
    folder: row.path ? row.path.split('/').slice(0, -1).join('/') : '',
    size: row.size || 0,
    hash: sha256(Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data || '')),
    source: 'document',
    addedAt: new Date().toISOString(),
  });

  return fromPrismaDocument(row);
}

export async function getProcedureMedia(procedureCode: string): Promise<ProcedureMediaItem[]> {
  const prisma = getPrismaClient();
  const rows = await prisma.document.findMany({
    where: {
      path: {
        startsWith: `registry/procedures/${procedureCode}/media/`,
      },
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, filename: true, path: true, mimeType: true, size: true, data: true, metadata: true, createdAt: true, updatedAt: true },
  });

  return rows.map(fromPrismaDocument);
}

export async function getProcedureMediaByStep(
  procedureCode: string,
  stepId: string
): Promise<ProcedureMediaItem[]> {
  const prisma = getPrismaClient();
  const rows = await prisma.document.findMany({
    where: {
      path: {
        startsWith: `registry/procedures/${procedureCode}/media/`,
      },
      metadata: {
        path: ['stepId'],
        equals: stepId,
      },
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, filename: true, path: true, mimeType: true, size: true, data: true, metadata: true, createdAt: true, updatedAt: true },
  });

  return rows.map(fromPrismaDocument);
}

export async function deleteProcedureMedia(procedureCode: string): Promise<number> {
  const prisma = getPrismaClient();
  const paths = await prisma.document.findMany({
    where: {
      path: {
        startsWith: `registry/procedures/${procedureCode}/media/`,
      },
    },
    select: { path: true },
  });
  const result = await prisma.document.deleteMany({
    where: {
      path: {
        startsWith: `registry/procedures/${procedureCode}/media/`,
      },
    },
  });

  if (paths.length > 0) {
    const storageRoot = resolveStorageRoot();
    for (const entry of paths) {
      await updateIndexOnWebWrite(storageRoot, 'remove', { path: entry.path || '' });
    }
  }

  return result.count;
}

export async function deleteProcedureMediaByStep(
  procedureCode: string,
  stepId: string
): Promise<number> {
  const prisma = getPrismaClient();
  // Récupérer les IDs des médias pour ce step
  const rows = await prisma.document.findMany({
    where: {
      path: {
        startsWith: `registry/procedures/${procedureCode}/media/`,
      },
      metadata: {
        path: ['stepId'],
        equals: stepId,
      },
    },
    select: { id: true },
  });

  if (rows.length === 0) return 0;

  const result = await prisma.document.deleteMany({
    where: { id: { in: rows.map(r => r.id) } },
  });
  return result.count;
}

export async function deleteProcedureMediaById(id: string): Promise<boolean> {
  const prisma = getPrismaClient();
  try {
    await prisma.document.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

export async function getProcedureMediaCount(procedureCode: string): Promise<number> {
  const prisma = getPrismaClient();
  const count = await prisma.document.count({
    where: {
      path: {
        startsWith: `registry/procedures/${procedureCode}/media/`,
      },
    },
  });
  return count;
}