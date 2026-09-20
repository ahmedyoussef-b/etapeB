import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/services/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { RBAC_MATRIX } from "@/lib/types/rbac";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const body = await request.json();
    const { status, action } = body as {
      status?: "APPROVED" | "REJECTED";
      action?: "approve" | "reject";
    };

    const newStatus = status || (action === "approve" ? "APPROVED" : action === "reject" ? "REJECTED" : undefined);

    if (!newStatus) {
      return NextResponse.json(
        { error: "Statut invalide. Utilisez 'APPROVED' ou 'REJECTED'." },
        { status: 400 }
      );
    }

    const prisma = getPrismaClient();
    const registrationRequest = await prisma.registrationRequest.findUnique({
      where: { id: params.id },
    });

    if (!registrationRequest) {
      return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
    }

    if (registrationRequest.status !== "PENDING") {
      return NextResponse.json(
        { error: "Cette demande a déjà été traitée." },
        { status: 400 }
      );
    }

    if (newStatus === "APPROVED") {
      const existingUser = await prisma.user.findUnique({
        where: { email: registrationRequest.email },
      });

      if (existingUser) {
        return NextResponse.json(
          { error: "Un utilisateur avec cet email existe déjà." },
          { status: 409 }
        );
      }

      const role = registrationRequest.requestedRole;
      const permissions = RBAC_MATRIX[role] || [];

      const user = await prisma.user.create({
        data: {
          name: registrationRequest.name,
          email: registrationRequest.email,
          password: registrationRequest.password,
          role,
        },
      });

      await prisma.registrationRequest.update({
        where: { id: params.id },
        data: {
          status: "APPROVED",
          reviewedById: session.user.id,
          reviewedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: "Demande approuvée. Utilisateur créé.",
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          permissions,
        },
      });
    }

    await prisma.registrationRequest.update({
      where: { id: params.id },
      data: {
        status: "REJECTED",
        reviewedById: session.user.id,
        reviewedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Demande rejetée.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erreur lors du traitement de la demande",
      },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const registrationRequest = await prisma.registrationRequest.findUnique({
      where: { id: params.id },
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

    if (!registrationRequest) {
      return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: registrationRequest });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erreur lors de la récupération de la demande",
      },
      { status: 500 }
    );
  }
}
