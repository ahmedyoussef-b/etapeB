export const runtime = 'nodejs';
import { NextRequest, NextResponse } from "next/server";
import { executeWithDatabase } from "@/lib/services/db";
import { withAuth } from "@/lib/api/auth-guard";
import { Prisma } from "@prisma/client";

const MAX_FILE_SIZES: Record<string, number> = {
  photo: 10 * 1024 * 1024,
  video: 50 * 1024 * 1024,
  audio: 20 * 1024 * 1024,
  signature: 2 * 1024 * 1024,
};

export const DELETE = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const procedureCode = searchParams.get("procedureCode");
    const stepId = searchParams.get("stepId");

    if (!id && !procedureCode) {
      return NextResponse.json(
        { success: false, error: "id ou procedureCode requis" },
        { status: 400 }
      );
    }

    const result = await executeWithDatabase(async (prisma) => {
      if (id) {
        return await prisma.document.delete({ where: { id } });
      }

      if (procedureCode && stepId) {
        const rows = await prisma.document.findMany({
          where: {
            path: { startsWith: `registry/procedures/${procedureCode}/media/` },
            metadata: { path: ["stepId"], equals: stepId },
          },
          select: { id: true },
        });
        if (rows.length === 0) return { count: 0 };
        return await prisma.document.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
      }

      if (procedureCode) {
        return await prisma.document.deleteMany({
          where: { path: { startsWith: `registry/procedures/${procedureCode}/media/` } },
        });
      }
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("[ProcedureMediaAPI] Delete error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}, "procedures:delete");

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { procedureId, procedureCode, stepId, stepOrder, media } = body;

    if (!procedureCode || !stepId || !media) {
      return NextResponse.json(
        { success: false, error: "Champs requis manquants" },
        { status: 400 }
      );
    }

    const resolvedProcedureId = procedureId || procedureCode;

    if (!media.base64 || !media.name || !media.type) {
      return NextResponse.json(
        { success: false, error: "Données média invalides" },
        { status: 400 }
      );
    }

    let base64Data = String(media.base64);
    const commaIdx = base64Data.indexOf("base64,");
    if (base64Data.startsWith("data:") && commaIdx >= 0) {
      base64Data = base64Data.slice(commaIdx + "base64,".length);
    }
    const buffer = Buffer.from(base64Data, "base64");

    const mimeType = media.mimeType || getMimeTypeFromExtension(media.name);
    const size = buffer.length;
    const filename = media.name;
    const type = media.type;

    // Validate file size
    const maxSize = MAX_FILE_SIZES[type] || 10 * 1024 * 1024;
    if (size > maxSize) {
      return NextResponse.json(
        { success: false, error: `Fichier trop volumineux. Maximum : ${(maxSize / 1024 / 1024).toFixed(0)} MB` },
        { status: 400 }
      );
    }

    const geolocation = media.geolocation || null;
    const metadata = media.metadata || {};

    const result = await executeWithDatabase(async (prisma) => {
      return await prisma.procedureMedia.create({
        data: {
          procedureId: resolvedProcedureId,
          procedureCode,
          stepId,
          stepOrder: stepOrder ?? 0,
          type,
          filename,
          mimeType,
          size,
          data: buffer,
          geolocation: geolocation as Prisma.InputJsonValue | undefined,
          uploadedBy: metadata.uploadedBy || null,
          metadata: metadata as Prisma.InputJsonValue,
        },
        select: {
          id: true,
          procedureId: true,
          procedureCode: true,
          stepId: true,
          stepOrder: true,
          type: true,
          filename: true,
          mimeType: true,
          size: true,
          capturedAt: true,
          geolocation: true,
          metadata: true,
        },
      });
    });

    return NextResponse.json({ success: true, media: result }, { status: 201 });
  } catch (error) {
    console.error("[ProcedureMediaAPI] Upload error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}, "procedures:create");

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const procedureId = searchParams.get("procedureId");
    const procedureCode = searchParams.get("procedureCode");
    const stepId = searchParams.get("stepId");

    if (!procedureId && !procedureCode) {
      return NextResponse.json(
        { success: false, error: "procedureId ou procedureCode requis" },
        { status: 400 }
      );
    }

    const result = await executeWithDatabase(async (prisma) => {
      const where: Prisma.ProcedureMediaWhereInput = {};
      if (procedureId) where.procedureId = procedureId;
      if (procedureCode) where.procedureCode = procedureCode;
      if (stepId) where.stepId = stepId;

      return await prisma.procedureMedia.findMany({
        where,
        orderBy: { capturedAt: "asc" },
        select: {
          id: true,
          procedureId: true,
          procedureCode: true,
          stepId: true,
          stepOrder: true,
          type: true,
          filename: true,
          mimeType: true,
          size: true,
          capturedAt: true,
          geolocation: true,
          metadata: true,
        },
      });
    });

    return NextResponse.json({ success: true, media: result });
  } catch (error) {
    console.error("[ProcedureMediaAPI] Fetch error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}, "procedures:view");

function getMimeTypeFromExtension(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    wav: "audio/wav",
    mp3: "audio/mpeg",
    ogg: "audio/ogg",
    m4a: "audio/mp4",
    json: "application/json",
    pdf: "application/pdf",
  };
  return mimeTypes[ext || ""] || "application/octet-stream";
}