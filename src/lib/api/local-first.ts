import { invoke } from "@tauri-apps/api/core";
import { isTauriEnv } from "@/lib/tauri/env";
import { StructureSource } from "@/lib/database/structure-types";

export async function fetchStructureTree(source: StructureSource, path?: string, repository?: string): Promise<any> {
  if (source === 'web') {
    const url = new URL('https://etape-b.vercel.app/api/structure');
    url.searchParams.set('source', 'web');
    if (path) url.searchParams.set('path', path);
    if (repository) url.searchParams.set('repository', repository);
    const response = await fetch(url.toString(), { cache: 'no-store' });
    return response.json();
  }

  if (isTauriEnv()) {
    if (source === 'vector') {
      return invoke('get_vectorization_tree', { path });
    }
    return invoke('get_structure_tree', { source, path, repository });
  }

  if (source === 'vector') {
    throw new Error("La source 'vector' n'est disponible qu'en mode desktop.");
  }

  const url = new URL('/api/structure', window.location.origin);
  url.searchParams.set('source', source);
  if (path) url.searchParams.set('path', path);
  if (repository) url.searchParams.set('repository', repository);
  const response = await fetch(url.toString(), { cache: 'no-store' });
  return response.json();
}

export async function fetchRepositoryInfo(): Promise<any> {
  if (isTauriEnv()) {
    return invoke("get_repository_info");
  }
  const response = await fetch("/api/repository");
  return response.json();
}

export async function fetchSyncStatus(): Promise<any> {
  if (isTauriEnv()) {
    const response = await fetch('https://etape-b.vercel.app/api/structure/sync-status');
    return response.json();
  }
  const response = await fetch('/api/structure/sync-status');
  return response.json();
}

export async function startSync(): Promise<any> {
  if (isTauriEnv()) {
    const response = await fetch('https://etape-b.vercel.app/api/structure/sync', { method: 'POST' });
    return response.json();
  }
  const response = await fetch('/api/structure/sync', { method: 'POST' });
  return response.json();
}
export async function treeAction(action: string, path: string, source: string, name?: string, repository?: string): Promise<any> {
  const reqId = Math.random().toString(36).slice(2, 8);
  console.log(`[TREE-ACTION][${reqId}][1] Appel`, {
    action, path, source, name, repository,
    isTauri: isTauriEnv(),
    timestamp: new Date().toISOString(),
  });

  try {
    if (isTauriEnv()) {
      if (source === "vector") {
        console.log(`[TREE-ACTION][${reqId}][2] Vector source rejected`);
        throw new Error("La source vectorielle est en lecture seule.");
      }
      if (source === "web") {
        console.log(`[TREE-ACTION][${reqId}][3] Tauri+web → tree_action_web`);
        const result = await invoke('tree_action_web', {
          vercelUrl: 'https://etape-b.vercel.app',
          action,
          path,
          name: name || null,
          repository: repository || null,
        });
        console.log(`[TREE-ACTION][${reqId}][4] tree_action_web result`, result);
        return result;
      }
      console.log(`[TREE-ACTION][${reqId}][3] Tauri+local → tree_action`);
      const result = await invoke("tree_action", { action, path, source, name, repository });
      console.log(`[TREE-ACTION][${reqId}][4] tree_action result`, result);
      return result;
    }

    console.log(`[TREE-ACTION][${reqId}][3] Browser → fetch /api/tree-actions`);
    const response = await fetch("/api/tree-actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, path, source, name, repository }),
    });
    console.log(`[TREE-ACTION][${reqId}][4] HTTP status`, response.status);
    const text = await response.text();
    console.log(`[TREE-ACTION][${reqId}][5] Raw body`, text);
    const json = JSON.parse(text);
    console.log(`[TREE-ACTION][${reqId}][6] Parsed`, json);
    return json;
  } catch (err) {
    console.error(`[TREE-ACTION][${reqId}][ERROR]`, {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      toString: String(err),
    });
    throw err;
  }
}

export async function fetchFileContent(path: string, source: string, repository?: string): Promise<any> {
  if (source === 'web') {
    const url = new URL('https://etape-b.vercel.app/api/file-content');
    url.searchParams.set('path', path);
    url.searchParams.set('source', 'web');
    if (repository) url.searchParams.set('repository', repository);
    const response = await fetch(url.toString());
    return response.json();
  }

  if (isTauriEnv()) {
    return invoke('read_file_content', { path });
  }

  const url = new URL('/api/file-content', window.location.origin);
  url.searchParams.set('path', path);
  url.searchParams.set('source', source);
  if (repository) url.searchParams.set('repository', repository);
  const response = await fetch(url.toString());
  return response.json();
}
