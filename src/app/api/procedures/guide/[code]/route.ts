import { NextResponse } from "next/server";
import { safeGetProcedureByCode, safeDeleteProcedure } from "@/lib/services/procedures.fallback";
import { withAuth } from "@/lib/api/auth-guard";

interface RouteContext {
  params: { code: string };
}

export const GET = withAuth<{ user: { id: string; email: string; role: string; name?: string | null } } & RouteContext>(
  async (_request, context) => {
    const procedure = await safeGetProcedureByCode(context.params.code);
    if (!procedure) {
      return NextResponse.json({ message: "Procedure not found" }, { status: 404 });
    }
    return NextResponse.json(procedure);
  },
  'procedures:view'
);

export const DELETE = withAuth<{ user: { id: string; email: string; role: string; name?: string | null } } & RouteContext>(
  async (_request, context) => {
    const success = await safeDeleteProcedure(context.params.code);
    if (!success) {
      return NextResponse.json({ message: "Procedure not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true }, { status: 200 });
  },
  'procedures:delete'
);