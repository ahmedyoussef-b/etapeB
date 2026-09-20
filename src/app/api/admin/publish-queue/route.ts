import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { getPrismaClient } from "@/lib/services/db";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "admin") {
      return NextResponse.json(
        { error: "Accès réservé aux administrateurs" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const parsePositiveInteger = (value: string | null, fallback: number) => {
      const parsed = Number.parseInt(value || "", 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    };
    const requestedPage = parsePositiveInteger(searchParams.get("page"), 1);
    const limit = Math.min(100, parsePositiveInteger(searchParams.get("limit"), 20));
    const requestedFilter = searchParams.get("filter");
    const filter = requestedFilter === "pending" || requestedFilter === "expired"
      ? requestedFilter
      : "all";

    const prisma = getPrismaClient();
    const now = new Date();

    // Stats globales
    const [totalAll, totalPending, totalExpired] = await Promise.all([
      prisma.publishQueue.count(),
      prisma.publishQueue.count({
        where: { expiresAt: { gt: now } },
      }),
      prisma.publishQueue.count({
        where: { expiresAt: { lte: now } },
      }),
    ]);

    // Filtrage pour la pagination
    let whereClause: Prisma.PublishQueueWhereInput = {};
    if (filter === "pending") {
      whereClause = { expiresAt: { gt: now } };
    } else if (filter === "expired") {
      whereClause = { expiresAt: { lte: now } };
    }

    const total =
      filter === "pending"
        ? totalPending
        : filter === "expired"
        ? totalExpired
        : totalAll;

    const totalPages = Math.max(1, Math.ceil(total / limit));
    const currentPage = Math.min(requestedPage, totalPages);
    const skip = (currentPage - 1) * limit;

    const rows = await prisma.publishQueue.findMany({
      where: whereClause,
      select: {
        id: true,
        path: true,
        hash: true,
        size: true,
        version: true,
        publishedAt: true,
        expiresAt: true,
        downloadCount: true,
        transferredTo: true,
      },
      orderBy: { publishedAt: "desc" },
      skip,
      take: limit,
    });

    const items = rows.map((r) => ({
      id: r.id,
      path: r.path,
      hash: r.hash ? r.hash.substring(0, 8) : "",
      size: r.size,
      version: r.version,
      publishedAt: r.publishedAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
      downloadCount: r.downloadCount,
      transferredTo: r.transferredTo || [],
      isExpired: new Date(r.expiresAt) <= now,
    }));

    return NextResponse.json({
      items,
      total,
      page: currentPage,
      totalPages,
      stats: {
        totalAll,
        totalPending,
        totalExpired,
      },
    });
  } catch (error) {
    console.error("[API Admin PublishQueue] Erreur:", error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la récupération de la file de publication" },
      { status: 500 }
    );
  }
}
