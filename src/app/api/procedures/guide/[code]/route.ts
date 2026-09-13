import { NextResponse } from "next/server";
import { safeGetProcedureByCode, safeDeleteProcedure } from "@/lib/services/procedures.fallback";
import { withAuth } from "@/lib/api/auth-guard";
import { z } from "zod";
import logger from "@/lib/logger";

interface RouteContext {
  params: { code: string };
}

const codeSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[\w\-\.]+$/, "Code invalide");

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
    // Validation du parametre code
    const parsed = codeSchema.safeParse(context.params.code);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Code de procedure invalide" },
        { status: 400 }
      );
    }
    const code = parsed.data;

    try {
      const result = await safeDeleteProcedure(code, context.user?.id);

      if (result === null) {
        return NextResponse.json(
          { message: "Procedure not found" },
          { status: 404 }
        );
      }
      if ('archived' in result) {
        return NextResponse.json(
          { archived: true, executionCount: result.executionCount },
          { status: 200 }
        );
      }
      if ('deleted' in result) {
        return NextResponse.json(
          { deleted: true },
          { status: 200 }
        );
      }

      return NextResponse.json(
        { message: "Procedure not found" },
        { status: 404 }
      );
    } catch (error) {
      logger.error('[DELETE /api/procedures/guide/:code] Unexpected error', {
        code,
        error,
      });
      return NextResponse.json(
        { message: "Erreur serveur lors de la suppression" },
        { status: 500 }
      );
    }
  },
  'procedures:delete'
);