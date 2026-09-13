import { NextResponse } from "next/server";
import { safeGetReportById, safeUpdateReport, safeRemoveReport } from "@/lib/services/etat-des-lieux.fallback";
import { withAuth } from "@/lib/api/auth-guard";

interface RouteContext {
  params: { id: string };
}

export const GET = withAuth<{ user: { id: string; email: string; role: string; name?: string | null } } & RouteContext>(
  async (_request, context) => {
    const report = await safeGetReportById(context.params.id);
    if (!report) {
      return NextResponse.json({ message: "Report not found" }, { status: 404 });
    }
    return NextResponse.json(report);
  },
  'etat-lieux:*'
);

export const PUT = withAuth<{ user: { id: string; email: string; role: string; name?: string | null } } & RouteContext>(
  async (request, context) => {
    try {
      const body = await request.json();
      const report = await safeUpdateReport(context.params.id, body);
      if (!report) {
        return NextResponse.json({ message: "Report not found" }, { status: 404 });
      }
      return NextResponse.json(report);
    } catch (error) {
      console.error("Invalid data:", error);
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }
  },
  'etat-lieux:edit'
);

export const DELETE = withAuth<{ user: { id: string; email: string; role: string; name?: string | null } } & RouteContext>(
  async (_request, context) => {
    const success = await safeRemoveReport(context.params.id);
    if (!success) {
      return NextResponse.json({ message: "Report not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  },
  'etat-lieux:delete'
);
