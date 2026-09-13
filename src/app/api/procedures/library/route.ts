import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const LIBRARY_DIR = path.join(process.cwd(), ".data", "library", "procedures");

export async function GET() {
  try {
    const indexPath = path.join(LIBRARY_DIR, "index.json");
    let index = { version: "1.0", updatedAt: new Date().toISOString(), procedures: [] };
    
    try {
      const indexContent = await fs.readFile(indexPath, "utf-8");
      index = JSON.parse(indexContent);
    } catch {
      // Index doesn't exist yet
    }

    return NextResponse.json(index.procedures);
  } catch (error) {
    console.error("Erreur lecture librairie:", error);
    return NextResponse.json({ error: "Failed to read library" }, { status: 500 });
  }
}