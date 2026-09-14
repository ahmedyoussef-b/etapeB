import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { getPrismaClient } from "@/lib/services/db";

export const runtime = "nodejs";

interface PublishFile {
  path: string;
  content?: string;
  textContent?: string;
  hash: string;
  size: number;
  version: string;
}

interface PublishBody {
  files: PublishFile[];
  changelog?: string;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "admin") {
      return NextResponse.json(
        { error: "Accès réservé aux administrateurs" },
        { status: 403 }
      );
    }

    const body = (await request.json()) as PublishBody;
    if (!body?.files || !Array.isArray(body.files) || body.files.length === 0) {
      return NextResponse.json(
        { error: "Au moins un fichier est requis" },
        { status: 400 }
      );
    }

    for (const file of body.files) {
      if (
        typeof file !== "object" || file === null) {
        return NextResponse.json(
          { error: "Fichier invalide" },
          { status: 400 }
        );
      }
      if (!file.path || !file.hash || file.size === undefined || !file.version) {
        return NextResponse.json(
          { error: `Fichier invalide: ${JSON.stringify(file)}` },
          { status: 400 }
        );
      }
      if (!file.content && !file.textContent) {
        return NextResponse.json(
          { error: `Fichier sans contenu: ${file.path}` },
          { status: 400 }
        );
      }
    }

    const prisma = getPrismaClient();
    const version = `v${Date.now()}`;
    const systemVersion = await prisma.systemVersion.create({
      data: {
        version,
        publishedBy: session.user.email || "unknown",
        changelog: body.changelog || null,
        fileCount: body.files.length,
      },
    });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const created = await prisma.publishQueue.createMany({
      data: body.files.map((file) => ({
        path: file.path,
        content: file.content ? Buffer.from(file.content, "base64") : null,
        textContent: file.textContent || null,
        hash: file.hash,
        size: file.size,
        version,
        expiresAt,
      })),
    });

    return NextResponse.json({
      success: true,
      version,
      systemVersionId: systemVersion.id,
      fileCount: created.count,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("[publish] error:", error);
    return NextResponse.json(
      { error: "Erreur serveur", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
