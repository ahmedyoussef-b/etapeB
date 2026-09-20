export const runtime = 'nodejs';
import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/services/db";

export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get("email");

    if (!email) {
      return NextResponse.json({ error: "Email requis" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const prisma = getPrismaClient();

    const registrationRequest = await prisma.registrationRequest.findUnique({
      where: { email: normalizedEmail },
      select: {
        status: true,
        requestedRole: true,
      },
    });

    if (!registrationRequest) {
      return NextResponse.json({ hasPendingRequest: false });
    }

    return NextResponse.json({
      hasPendingRequest: true,
      status: registrationRequest.status,
      requestedRole: registrationRequest.requestedRole,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erreur lors de la vérification",
      },
      { status: 500 }
    );
  }
}
