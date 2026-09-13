import { getPrismaClient } from './db';
import { Prisma } from '@prisma/client';

export interface EtatDesLieuxReport {
  id: string;
  title: string;
  description: string;
  location: string;
  attachments: Array<{
    kind: 'image' | 'video';
    dataUrl: string;
    mimeType: string;
    size: number;
    thumbnailDataUrl?: string;
  }>;
  status: 'draft' | 'sent';
  authorName: string;
  authorRole: string;
  createdAt: string;
  updatedAt: string;
}

function toPrismaReport(report: EtatDesLieuxReport) {
  return {
    id: report.id,
    title: report.title,
    description: report.description,
    status: report.status,
    attachments: report.attachments as Prisma.InputJsonValue,
    metadata: {
      location: report.location,
      authorName: report.authorName,
      authorRole: report.authorRole,
    } as Prisma.InputJsonValue,
    createdAt: new Date(report.createdAt),
    updatedAt: new Date(report.updatedAt),
  };
}

function fromPrismaReport(row: {
  id: string;
  title: string;
  description: string | null;
  status: string;
  attachments: unknown;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}): EtatDesLieuxReport {
  const metadata = (row.metadata as Record<string, unknown> | null) || {};
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    location: (metadata.location as string) || '',
    attachments: (row.attachments as EtatDesLieuxReport['attachments']) || [],
    status: (row.status as EtatDesLieuxReport['status']) || 'draft',
    authorName: (metadata.authorName as string) || '',
    authorRole: (metadata.authorRole as string) || '',
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getAllReports(): Promise<EtatDesLieuxReport[]> {
  const prisma = getPrismaClient();
  const rows = await prisma.report.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, description: true, status: true, attachments: true, metadata: true, createdAt: true, updatedAt: true },
  });
  return rows.map(fromPrismaReport);
}

export async function getReportById(id: string): Promise<EtatDesLieuxReport | undefined> {
  const prisma = getPrismaClient();
  const row = await prisma.report.findUnique({
    where: { id },
    select: { id: true, title: true, description: true, status: true, attachments: true, metadata: true, createdAt: true, updatedAt: true },
  });
  return row ? fromPrismaReport(row) : undefined;
}

export async function createReport(report: Omit<EtatDesLieuxReport, 'id' | 'createdAt' | 'updatedAt'>): Promise<EtatDesLieuxReport> {
  const prisma = getPrismaClient();
  const now = new Date().toISOString();
  const data = toPrismaReport({
    ...report,
    id: `edl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    createdAt: now,
    updatedAt: now,
  });
  const row = await prisma.report.create({
    data,
    select: { id: true, title: true, description: true, status: true, attachments: true, metadata: true, createdAt: true, updatedAt: true },
  });
  return fromPrismaReport(row);
}

export async function updateReport(id: string, updates: Partial<Omit<EtatDesLieuxReport, 'id' | 'createdAt'>>): Promise<EtatDesLieuxReport | undefined> {
  const prisma = getPrismaClient();
  const existing = await prisma.report.findUnique({
    where: { id },
    select: { id: true, metadata: true },
  });
  if (!existing) return undefined;

  const mergedMetadata = { ...(existing.metadata as Record<string, unknown> | null) };
  if (updates.location !== undefined) mergedMetadata.location = updates.location;
  if (updates.authorName !== undefined) mergedMetadata.authorName = updates.authorName;
  if (updates.authorRole !== undefined) mergedMetadata.authorRole = updates.authorRole;

  const data: Record<string, unknown> = {
    updatedAt: new Date(),
  };
  if (updates.title !== undefined) data.title = updates.title;
  if (updates.description !== undefined) data.description = updates.description;
  if (updates.status !== undefined) data.status = updates.status;
  if (updates.attachments !== undefined) data.attachments = updates.attachments as Prisma.InputJsonValue;
  data.metadata = mergedMetadata as Prisma.InputJsonValue;

  const row = await prisma.report.update({
    where: { id },
    data,
    select: { id: true, title: true, description: true, status: true, attachments: true, metadata: true, createdAt: true, updatedAt: true },
  });
  return fromPrismaReport(row);
}

export async function removeReport(id: string): Promise<boolean> {
  const prisma = getPrismaClient();
  try {
    await prisma.report.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}
