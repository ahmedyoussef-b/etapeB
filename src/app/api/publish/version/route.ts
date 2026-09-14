import { NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/services/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const prisma = getPrismaClient();
    const latest = await prisma.systemVersion.findFirst({
      orderBy: { publishedAt: "desc" },
    });

    if (!latest) {
      return NextResponse.json({
        version: null,
        publishedAt: null,
        fileCount: 0,
      });
    }

    return NextResponse.json({
      version: latest.version,
      publishedAt: latest.publishedAt.toISOString(),
      publishedBy: latest.publishedBy,
      fileCount: latest.fileCount,
      changelog: latest.changelog,
    });
  } catch (error) {
    console.error("[publish/version] error:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
