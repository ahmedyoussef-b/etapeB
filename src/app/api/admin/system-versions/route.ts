import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { getPrismaClient } from "@/lib/services/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "admin") {
      return NextResponse.json(
        { error: "Accès réservé aux administrateurs" },
        { status: 403 }
      );
    }

    const prisma = getPrismaClient();

    const rows = await prisma.systemVersion.findMany({
      orderBy: { publishedAt: "desc" },
      take: 20,
    });

    const versions = rows.map((v) => ({
      id: v.id,
      version: v.version,
      publishedAt: v.publishedAt.toISOString(),
      publishedBy: v.publishedBy,
      changelog: v.changelog,
      fileCount: v.fileCount,
    }));

    return NextResponse.json({
      versions,
    });
  } catch (error) {
    console.error("[API Admin SystemVersions] Erreur:", error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la récupération des versions système" },
      { status: 500 }
    );
  }
}
