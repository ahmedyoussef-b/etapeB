import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/services/db";
import { hash } from "bcryptjs";
import { Role } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password, confirmPassword, role } = body as {
      name?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
      role?: Role;
    };

    if (!name || !email || !password || !confirmPassword) {
      return NextResponse.json(
        { error: "Tous les champs sont requis." },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: "Les mots de passe ne correspondent pas." },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const prisma = getPrismaClient();
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Cet email est déjà utilisé." },
        { status: 409 }
      );
    }

    const existingRequest = await prisma.registrationRequest.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingRequest) {
      return NextResponse.json(
        { error: "Une demande est déjà en cours pour cet email." },
        { status: 409 }
      );
    }

    const hashedPassword = await hash(password, 10);
    const request = await prisma.registrationRequest.create({
      data: {
        name: String(name).trim(),
        email: normalizedEmail,
        password: hashedPassword,
        requestedRole: role || "RONDIER",
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Votre demande a été envoyée à l'administrateur pour validation.",
        request: {
          id: request.id,
          email: request.email,
          name: request.name,
          requestedRole: request.requestedRole,
          status: request.status,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erreur lors de l'inscription",
      },
      { status: 500 }
    );
  }
}
