import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  listGuideProcedures,
  createGuideProcedure,
} from "@/lib/services/guide-procedures.service";
import { withAuth } from "@/lib/api/auth-guard";

export const GET = withAuth(async (req: NextRequest) => {
  try {
    const url = new URL(req.url);
    const pageRaw = url.searchParams.get("page");
    const pageSizeRaw = url.searchParams.get("pageSize");
    const page = pageRaw ? Math.max(1, parseInt(pageRaw, 10) || 1) : 1;
    const pageSize = pageSizeRaw
      ? Math.max(1, Math.min(100, parseInt(pageSizeRaw, 10) || 20))
      : 20;

    const result = await listGuideProcedures({ page, pageSize });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error listing guide procedures:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}, 'procedures:view');

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const result = await createGuideProcedure(body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", issues: error.issues },
        { status: 400 },
      );
    }
    console.error("Error creating guide procedure:", error);
    return NextResponse.json(
      { error: "Invalid data or server error" },
      { status: 400 },
    );
  }
}, 'procedures:create');