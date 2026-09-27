import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, hasPermission, unauthorizedResponse, unauthenticatedResponse } from "@/lib/api/auth-guard";
import { getPrismaClient } from "@/lib/services/db";
import { readFile, storeFile } from "@/lib/storage";

const ALLOWED_FIELDS = [
  "display_name",
  "description",
  "tags",
  "category",
] as const;

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return unauthenticatedResponse();
  }
  if (!hasPermission(user.role, "banque-images:view")) {
    return unauthorizedResponse();
  }

  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");

  if (!path || !path.startsWith("bank/") || !path.endsWith(".json")) {
    return NextResponse.json({ error: "Chemin invalide" }, { status: 400 });
  }

  try {
    const buffer = readFile(path);
    const metadata = JSON.parse(buffer.toString("utf-8"));
    return NextResponse.json({ success: true, metadata });
  } catch {
    const prisma = getPrismaClient();
    const row = await prisma.document.findFirst({
      where: { path },
      select: { metadata: true },
    });

    if (!row || !row.metadata) {
      return NextResponse.json({ error: "Métadonnées introuvables" }, { status: 404 });
    }

    return NextResponse.json({ success: true, metadata: row.metadata });
  }
}

export async function PUT(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return unauthenticatedResponse();
  }
  if (!hasPermission(user.role, "banque-images:*")) {
    return unauthorizedResponse();
  }

  const body = await request.json();
  const { path, metadata } = body as { path?: string; metadata?: Record<string, unknown> };

  if (!path || !path.startsWith("bank/") || !path.endsWith(".json")) {
    return NextResponse.json({ error: "Chemin invalide" }, { status: 400 });
  }

  if (!metadata || typeof metadata !== "object") {
    return NextResponse.json({ error: "Métadonnées invalides" }, { status: 400 });
  }

  const cleanMetadata: Record<string, unknown> = {};
  for (const key of ALLOWED_FIELDS) {
    if (metadata[key] !== undefined) {
      cleanMetadata[key] = metadata[key];
    }
  }

  cleanMetadata.updated_at = new Date().toISOString();

  try {
    const existingBuffer = readFile(path);
    const existing = JSON.parse(existingBuffer.toString("utf-8"));
    const merged = { ...existing, ...cleanMetadata };
    if (Array.isArray(cleanMetadata.tags)) {
      merged.tags = cleanMetadata.tags;
    }
    const mergedJson = Buffer.from(JSON.stringify(merged, null, 2));
    storeFile(path, mergedJson, "application/json");
  } catch (error) {
    console.error("[image-metadata] local file update failed:", error);
  }

  const prisma = getPrismaClient();
  const prismaData: Record<string, unknown> = {
    updatedAt: new Date(),
  };
  if (cleanMetadata.display_name !== undefined) prismaData.metadata = { ...prismaData.metadata as Record<string, unknown>, display_name: cleanMetadata.display_name };
  if (cleanMetadata.description !== undefined) prismaData.metadata = { ...prismaData.metadata as Record<string, unknown>, description: cleanMetadata.description };
  if (cleanMetadata.tags !== undefined) prismaData.metadata = { ...prismaData.metadata as Record<string, unknown>, tags: cleanMetadata.tags };
  if (cleanMetadata.category !== undefined) prismaData.metadata = { ...prismaData.metadata as Record<string, unknown>, category: cleanMetadata.category };

  await prisma.document.updateMany({
    where: { path },
    data: prismaData,
  });

  return NextResponse.json({ success: true, metadata: cleanMetadata });
}
