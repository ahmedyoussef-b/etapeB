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
    const requests = await prisma.registrationRequest.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        requestedRole: true,
        status: true,
        createdAt: true,
        reviewedAt: true,
        reviewedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: requests });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erreur lors de la récupération des demandes",
      },
      { status: 500 }
    );
  }
}
