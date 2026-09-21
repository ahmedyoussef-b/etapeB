import { ProcedureSchema, TProcedure, TStep } from "@/lib/procedures/services/validator.service";
import { isTauriEnv } from "@/lib/tauri/env";

const STORAGE_KEY = "nexaflow_procedures";

function loadFromStorage(): TProcedure[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveToStorage(procedures: TProcedure[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(procedures));
  } catch {
    // Storage full or unavailable
  }
}

let cachedProcedures = loadFromStorage();

export function getProcedures(): TProcedure[] {
  return [...cachedProcedures];
}

export function getProcedureById(id: string): TProcedure | null {
  return cachedProcedures.find((p) => p.metadata.code === id) ?? null;
}

export function saveProcedure(procedure: TProcedure): void {
  const validated = ProcedureSchema.parse(procedure);
  const idx = cachedProcedures.findIndex((p) => p.metadata.code === validated.metadata.code);
  if (idx >= 0) {
    cachedProcedures[idx] = validated;
  } else {
    cachedProcedures.push(validated);
  }
  saveToStorage(cachedProcedures);
}

export function replaceProcedures(procedures: TProcedure[]): void {
  const validated = procedures.map((p) => ProcedureSchema.parse(p));
  cachedProcedures = validated;
  saveToStorage(cachedProcedures);
}

export async function syncFromServer(): Promise<TProcedure | null> {
  if (typeof window === "undefined") return null;
  if (isTauriEnv()) {
    return cachedProcedures[cachedProcedures.length - 1] ?? null;
  }

  try {
    const response = await fetch("/api/procedures/guide", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!response.ok) return null;

    const procedures: TProcedure[] = await response.json();
    if (!Array.isArray(procedures) || procedures.length === 0) return null;

    const merged = new Map<string, TProcedure>();

    for (const p of cachedProcedures) {
      merged.set(p.metadata.code, p);
    }
    for (const p of procedures) {
      merged.set(p.metadata.code, p);
    }

    const mergedArray = Array.from(merged.values());
    replaceProcedures(mergedArray);
    return mergedArray[mergedArray.length - 1];
  } catch {
    return null;
  }
}

export async function syncToServer(procedure: TProcedure): Promise<TProcedure | null> {
  if (typeof window === "undefined") return null;

  try {
    const validated = ProcedureSchema.parse(procedure);
    saveProcedure(validated);

    if (isTauriEnv()) {
      return validated;
    }

    const response = await fetch("/api/procedures/guide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validated),
    });

    if (!response.ok) return null;

    const saved: TProcedure = await response.json();
    saveProcedure(saved);
    return saved;
  } catch {
    return null;
  }
}

export async function saveProcedureVersion(procedure: TProcedure): Promise<TProcedure | null> {
  if (typeof window === "undefined") return null;

  try {
    const validated = ProcedureSchema.parse(procedure);
    saveProcedure(validated);

    if (isTauriEnv()) {
      return validated;
    }

    const code = validated.metadata.code;
    const response = await fetch(`/api/procedures/guide/${encodeURIComponent(code)}/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validated),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || `Erreur serveur ${response.status}`);
    }

    return validated;
  } catch (error) {
    saveProcedure(procedure);
    throw error;
  }
}

export async function getProcedureVersions(code: string): Promise<TProcedure[] | null> {
  if (typeof window === "undefined") return null;

  if (isTauriEnv()) {
    const proc = getProcedureById(code);
    return proc ? [proc] : [];
  }

  try {
    const response = await fetch(`/api/procedures/guide/${code}/versions`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) return null;

    const versions: TProcedure[] = await response.json();
    return versions;
  } catch {
    return null;
  }
}

export async function getProcedureVersion(code: string, version: number): Promise<TProcedure | null> {
  if (typeof window === "undefined") return null;

  if (isTauriEnv()) {
    return getProcedureById(code);
  }

  try {
    const response = await fetch(`/api/procedures/guide/${code}/version/${version}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) return null;

    const versionData: TProcedure = await response.json();
    return versionData;
  } catch {
    return null;
  }
}

export function deleteProcedure(code: string): void {
  cachedProcedures = cachedProcedures.filter((p) => p.metadata.code !== code);
  saveToStorage(cachedProcedures);
}

export function createEmptyProcedure(): TProcedure {
  return {
    metadata: {
      title: "",
      code: "",
      description: "",
      category: "",
      priority: "moyenne",
      estimatedTimeMinutes: 1,
      requiredRoles: [],
      globalSafetyInstructions: [],
    },
    steps: [],
  };
}

export function addStep(procedure: TProcedure): TProcedure {
  const newStep: TStep = {
    id: `step_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: "",
    subtitle: "",
    instructions: "",
    type: "consigne_simple",
    isMandatory: false,
    dependencies: [],
    mediaRequirements: [],
    alarms: [],
    attachments: [],
    order: procedure.steps.length,
    timerEnabled: false,
    timerSeconds: 0,
  };
  return {
    ...procedure,
    steps: [...procedure.steps, newStep],
  };
}

export function removeStep(procedure: TProcedure, stepId: string): TProcedure {
  return {
    ...procedure,
    steps: procedure.steps
      .filter((s) => s.id !== stepId)
      .map((s, i) => ({ ...s, order: i })),
  };
}

export function duplicateStep(procedure: TProcedure, stepId: string): TProcedure {
  const idx = procedure.steps.findIndex((s) => s.id === stepId);
  if (idx < 0) return procedure;
  const original = procedure.steps[idx];
  const clone: TStep = {
    ...original,
    id: `step_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: `${original.title} (copie)`,
    order: idx + 1,
  };
  const newSteps = [
    ...procedure.steps.slice(0, idx + 1),
    clone,
    ...procedure.steps.slice(idx + 1),
  ].map((s, i) => ({ ...s, order: i }));
  return { ...procedure, steps: newSteps };
}

export function reorderSteps(procedure: TProcedure, fromIndex: number, toIndex: number): TProcedure {
  const newSteps = [...procedure.steps];
  const [moved] = newSteps.splice(fromIndex, 1);
  newSteps.splice(toIndex, 0, moved);
  return {
    ...procedure,
    steps: newSteps.map((s, i) => ({ ...s, order: i })),
  };
}

export function updateStep(procedure: TProcedure, stepId: string, updates: Partial<TStep>): TProcedure {
  return {
    ...procedure,
    steps: procedure.steps.map((s) => (s.id === stepId ? { ...s, ...updates } : s)),
  };
}

export function updateMetadata(procedure: TProcedure, metadata: Partial<TProcedure["metadata"]>): TProcedure {
  return {
    ...procedure,
    metadata: { ...procedure.metadata, ...metadata },
  };
}

export function importProcedure(procedure: TProcedure): void {
  const validated = ProcedureSchema.parse(procedure);
  const idx = cachedProcedures.findIndex((p) => p.metadata.code === validated.metadata.code);
  if (idx >= 0) {
    cachedProcedures[idx] = validated;
  } else {
    cachedProcedures.push(validated);
  }
  saveToStorage(cachedProcedures);
}

export function exportToJson(procedure: TProcedure): string {
  return JSON.stringify(ProcedureSchema.parse(procedure), null, 2);
}

export function downloadJson(procedure: TProcedure, filename?: string): void {
  const json = exportToJson(procedure);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || `${procedure.metadata.code}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
