export const runtime = 'nodejs';
import { NextRequest, NextResponse } from "next/server";
import { safeGetAllProcedures, safeUpsertProcedure, replaySyncQueue } from "@/lib/services/procedures.fallback";
import { isDatabaseAvailable } from "@/lib/database/connection-manager";
import { withAuth } from "@/lib/api/auth-guard";

export const GET = withAuth(async () => {
  try {
    const procedures = await safeGetAllProcedures();
    if (isDatabaseAvailable()) {
      replaySyncQueue().catch((error) => {
        console.error('[API] Failed to replay sync queue:', error);
      });
    }
    return NextResponse.json(procedures);
  } catch (error) {
    console.error("Failed to fetch procedures:", error);
    return NextResponse.json({ error: "Failed to fetch procedures" }, { status: 500 });
  }
}, 'procedures:view');

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const procedure = await safeUpsertProcedure(body);
    if (isDatabaseAvailable()) {
      replaySyncQueue().catch((error) => {
        console.error('[API] Failed to replay sync queue:', error);
      });
    }
    return NextResponse.json(procedure, { status: 201 });
  } catch (error) {
    console.error("Invalid procedure:", error);
    return NextResponse.json({ success: false, message: "Invalid procedure" }, { status: 400 });
  }
}, 'procedures:create');
