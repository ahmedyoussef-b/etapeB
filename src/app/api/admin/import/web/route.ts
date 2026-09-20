export const runtime = 'nodejs';
import { NextRequest, NextResponse } from "next/server";
import { LocalDatabaseAdapter } from "@/lib/database/local-adapter";
import { UnifiedDatabaseService } from "@/lib/database/unified-database.service";
import { ImportNormalizer } from "@/lib/database/import-normalizer";
import { withAuth } from "@/lib/api/auth-guard";

interface ImportApiResultItem {
  id: string;
  title: string;
  status: "success" | "warning" | "error";
  message: string;
}

interface ImportApiResult {
  success: boolean;
  imported: number;
  failed: number;
  warnings: number;
  results: ImportApiResultItem[];
}

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const procedures = Array.isArray(body?.procedures) ? body.procedures : [];
    const source = typeof body?.source === "string" ? body.source : "unknown";
    const apiKey = typeof body?.apiKey === "string" ? body.apiKey : "";

    if (!procedures.length) {
      return NextResponse.json(
        { success: false, error: "Le payload doit contenir un tableau 'procedures'" },
        { status: 400 }
      );
    }

    if (apiKey && apiKey.length < 4) {
      return NextResponse.json(
        { success: false, error: "Clé API invalide" },
        { status: 401 }
      );
    }

    const adapter = new LocalDatabaseAdapter(".data");
    const service = new UnifiedDatabaseService(adapter);
    const normalizer = new ImportNormalizer();
    const result: ImportApiResult = {
      success: true,
      imported: 0,
      failed: 0,
      warnings: 0,
      results: [],
    };

    let existingProcedures = await service.listProcedures();

    for (const procedure of procedures) {
      try {
        const { procedure: normalizedProcedure, dbProcedure, warnings: procedureWarnings, errors } = normalizer.normalizeWebProcedure(procedure);

        if (errors.length > 0) {
          result.failed += 1;
          result.results.push({
            id: String(procedure?.id || "unknown"),
            title: String(procedure?.title || "Sans titre"),
            status: "error",
            message: errors.join(", "),
          });
          continue;
        }

        const duplicate = existingProcedures.find((item) => item.code === normalizedProcedure.metadata.code);
        if (duplicate) {
          const updated = await service.updateProcedure(duplicate.id, {
            ...dbProcedure,
            metadata: {
              ...(dbProcedure.metadata || {}),
              source,
              updatedFromWeb: true,
              previousCode: duplicate.code,
            },
          });

          if (!updated) {
            throw new Error("Mise à jour impossible");
          }

          existingProcedures = await service.listProcedures();
          result.imported += 1;
          result.warnings += procedureWarnings.length;
          result.results.push({
            id: updated.id,
            title: normalizedProcedure.metadata.title,
            status: procedureWarnings.length ? "warning" : "success",
            message: procedureWarnings.length
              ? `Mis à jour avec avertissements: ${procedureWarnings.join(", ")}`
              : "Mis à jour avec succès",
          });
          continue;
        }

        const created = await service.createProcedure(dbProcedure);
        existingProcedures = await service.listProcedures();
        result.imported += 1;
        result.warnings += procedureWarnings.length;
        result.results.push({
          id: created.id,
          title: normalizedProcedure.metadata.title,
          status: procedureWarnings.length ? "warning" : "success",
          message: procedureWarnings.length
            ? `Importé avec avertissements: ${procedureWarnings.join(", ")}`
            : "Importé avec succès",
        });
      } catch (error) {
        result.failed += 1;
        result.results.push({
          id: String(procedure?.id || "unknown"),
          title: String(procedure?.title || "Sans titre"),
          status: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    await logImport(source, result);

    return NextResponse.json(
      {
        success: true,
        result,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Erreur import web:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}, 'procedures:*');

async function logImport(source: string, result: ImportApiResult) {
  try {
    const adapter = new LocalDatabaseAdapter(".data");
    const logPath = "system/logs/imports.json";
    const existing = (await adapter.readJSON<{ imports: any[] }>(logPath)) || { imports: [] };
    existing.imports.push({
      timestamp: new Date().toISOString(),
      type: "web-import",
      source,
      imported: result.imported,
      failed: result.failed,
      warnings: result.warnings,
      details: result.results,
    });
    await adapter.writeJSON(logPath, existing);
  } catch (error) {
    console.warn("Impossible de journaliser l'import:", error);
  }
}
