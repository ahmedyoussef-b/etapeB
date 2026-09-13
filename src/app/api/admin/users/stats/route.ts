export const runtime = 'nodejs';
import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/services/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { RBAC_MATRIX } from "@/lib/types/rbac";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const userRole = session.user.role as string;
    const userPermissions = RBAC_MATRIX[userRole] || [];

    if (!userPermissions.includes("users:manage")) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    const prisma = getPrismaClient();

    const [totalUsers, totalPending, usersByRole, recentUsers, pendingRequests] = await Promise.all([
      prisma.user.count(),
      prisma.registrationRequest.count({ where: { status: "PENDING" } }),
      prisma.user.groupBy({
        by: ["role"],
        _count: { role: true },
      }),
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          block: {
            select: {
              code: true,
              libelle: true,
            },
          },
        },
      }),
      prisma.registrationRequest.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          requestedRole: true,
          createdAt: true,
        },
      }),
    ]);

    const roleStats = usersByRole.reduce((acc, item) => {
      acc[item.role] = item._count.role;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers,
        totalPending,
        usersByRole: roleStats,
      },
      recentUsers,
      pendingRequests,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erreur lors de la récupération des statistiques",
      },
      { status: 500 }
    );
  }
}
