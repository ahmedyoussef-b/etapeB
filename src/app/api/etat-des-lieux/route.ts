import { NextRequest, NextResponse } from "next/server";
import { safeGetAllReports, safeCreateReport } from "@/lib/services/etat-des-lieux.fallback";
import { withAuth } from "@/lib/api/auth-guard";

export const GET = withAuth(async () => {
  try {
    const reports = await safeGetAllReports();
    return NextResponse.json({ reports });
  } catch (error) {
    console.error("Failed to fetch reports:", error);
    return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
  }
}, 'etat-lieux:*');

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const report = await safeCreateReport(body);
    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    console.error("Invalid data:", error);
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }
}, 'etat-lieux:create');
