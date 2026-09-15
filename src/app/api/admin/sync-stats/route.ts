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
    const now = new Date();
    const date24hAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const date7dAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      userSyncStates,
      totalUsers,
      totalPublishedFiles,
      totalPendingFiles,
      totalExpiredFiles,
      activeUsers24h,
      activeUsers7d,
    ] = await Promise.all([
      prisma.userSyncState.findMany({
        orderBy: { lastSyncAt: "desc" },
      }),
      prisma.user.count(),
      prisma.publishQueue.count(),
      prisma.publishQueue.count({
        where: { expiresAt: { gt: now } },
      }),
      prisma.publishQueue.count({
        where: { expiresAt: { lte: now } },
      }),
      prisma.userSyncState.count({
        where: { lastSyncAt: { gte: date24hAgo } },
      }),
      prisma.userSyncState.count({
        where: { lastSyncAt: { gte: date7dAgo } },
      }),
    ]);

    const users = userSyncStates.map((u) => ({
      userId: u.userId,
      lastSyncAt: u.lastSyncAt ? u.lastSyncAt.toISOString() : null,
      lastSyncVersion: u.lastSyncVersion,
      pendingCount: u.pendingCount,
      syncedFilesCount: u.syncedFileIds ? u.syncedFileIds.length : 0,
    }));

    const totalSyncedFiles = userSyncStates.reduce(
      (acc, curr) => acc + (curr.syncedFileIds?.length || 0),
      0
    );

    const recentActivity = userSyncStates
      .filter((u) => u.lastSyncAt !== null)
      .slice(0, 10)
      .map((u) => ({
        userId: u.userId,
        lastSyncAt: u.lastSyncAt.toISOString(),
        filesCount: u.syncedFileIds ? u.syncedFileIds.length : 0,
      }));

    return NextResponse.json({
      users,
      global: {
        totalUsers,
        totalPublishedFiles,
        totalSyncedFiles,
        totalPendingFiles,
        totalExpiredFiles,
        activeUsers24h,
        activeUsers7d,
      },
      recentActivity,
    });
  } catch (error) {
    console.error("[API Admin SyncStats] Erreur:", error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la récupération des statistiques de synchronisation" },
      { status: 500 }
    );
  }
}
