import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { ProcedureSchema } from "@/lib/procedures/services/validator.service";
import { withAuth } from "@/lib/api/auth-guard";

const LIBRARY_DIR = path.join(process.cwd(), ".data", "library", "procedures");

async function ensureLibraryDir() {
  try {
    await fs.mkdir(LIBRARY_DIR, { recursive: true });
  } catch {
    // Directory might already exist
  }
}

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    
    // Validate the procedure
    const validated = ProcedureSchema.parse(body);
    const code = validated.metadata.code;
    
    if (!code) {
      return NextResponse.json(
        { success: false, message: "Code de procédure manquant" },
        { status: 400 }
      );
    }

    await ensureLibraryDir();
    
    // Save to library directory
    const filePath = path.join(LIBRARY_DIR, `${code}.json`);
    const jsonContent = JSON.stringify(validated, null, 2);
    await fs.writeFile(filePath, jsonContent, "utf-8");

    // Also update the index
    const indexPath = path.join(LIBRARY_DIR, "index.json");
    let index: { version: string; updatedAt: string; procedures: any[] } = { version: "1.0", updatedAt: new Date().toISOString(), procedures: [] };
    
    try {
      const indexContent = await fs.readFile(indexPath, "utf-8");
      index = JSON.parse(indexContent);
    } catch {
      // Index doesn't exist yet, use default
    }

    // Update or add procedure in index
    const existingIdx = index.procedures.findIndex((p: any) => p.code === code);
    const procedureInfo = {
      id: code,
      code,
      title: validated.metadata.title,
      description: validated.metadata.description,
      category: validated.metadata.category,
      priority: validated.metadata.priority,
      estimatedTimeMinutes: validated.metadata.estimatedTimeMinutes,
      requiredRoles: validated.metadata.requiredRoles,
      stepCount: validated.steps.length,
      filePath: `library/procedures/${code}.json`,
      tags: [validated.metadata.category, validated.metadata.priority],
    };

    if (existingIdx >= 0) {
      index.procedures[existingIdx] = procedureInfo;
    } else {
      index.procedures.push(procedureInfo);
    }

    index.updatedAt = new Date().toISOString();
    await fs.writeFile(indexPath, JSON.stringify(index, null, 2), "utf-8");

    return NextResponse.json(
      { success: true, procedure: validated, message: "Procédure importée dans la librairie" },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Erreur import librairie:", error);
    if (error.name === "ZodError") {
      return NextResponse.json(
        { success: false, message: "Procédure invalide", errors: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, message: "Erreur serveur" },
      { status: 500 }
    );
  }
}, 'procedures:create');