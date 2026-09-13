import path from "path";
import { FileStore } from "@/lib/database/file-store";

const DB_DIR = path.join(process.cwd(), ".local-db", "procedures");
const DB_FILE = path.join(DB_DIR, "procedures.json");

const fileStore = new FileStore(DB_FILE);

fileStore.cleanup().catch(() => {
  // Ignore cleanup errors on startup
});

export async function getAllProceduresLocal(): Promise<any[]> {
  return fileStore.readArray();
}

export async function getProcedureByCodeLocal(code: string): Promise<any | undefined> {
  const procedures = await fileStore.readArray();
  return procedures.find((p: any) => p.metadata?.code === code);
}

export async function createProcedureLocal(procedure: any): Promise<any> {
  const newProcedure = {
    ...procedure,
    id: `proc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return fileStore.mutateArray((items: any[]) => {
    items.unshift(newProcedure);
    return items;
  }).then(() => newProcedure);
}

export async function updateProcedureLocal(code: string, updates: any): Promise<any | undefined> {
  return fileStore.mutateArray((items: any[]) => {
    const index = items.findIndex((p: any) => p.metadata?.code === code);
    if (index === -1) return items;
    items[index] = {
      ...items[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    return items;
  }).then((items: any[]) => items.find((p: any) => p.metadata?.code === code));
}

export async function deleteProcedureLocal(code: string): Promise<boolean> {
  return fileStore.mutateArray((items: any[]) => {
    const index = items.findIndex((p: any) => p.metadata?.code === code);
    if (index === -1) return items;
    items.splice(index, 1);
    return items;
  }).then((items: any[]) => items.some((p: any) => p.metadata?.code === code));
}
