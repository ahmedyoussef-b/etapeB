import { NextRequest, NextResponse } from "next/server";
import { getGuideProcedure } from "@/lib/services/guide-procedures.service";
import { getAuthenticatedUser, hasPermission, unauthorizedResponse, unauthenticatedResponse } from "@/lib/api/auth-guard";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getAuthenticatedUser(_req);
  if (!user) {
    return unauthenticatedResponse();
  }
  if (!hasPermission(user.role, 'procedures:view')) {
    return unauthorizedResponse();
  }

  try {
    const procedure = await getGuideProcedure(params.id);
    if (!procedure) {
      return NextResponse.json(
        { error: "Guide procedure not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(procedure);
  } catch (error) {
    console.error("Error fetching guide procedure:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}