import { invoke } from "@tauri-apps/api/core";
import { isTauriEnv } from "@/lib/tauri/env";
import { StructureSource } from "@/lib/database/structure-types";

export async function fetchStructureTree(source: StructureSource, path?: string, repository?: string): Promise<any> {
  console.log('[SDB-API] fetchStructureTree entrée, source:', source, 'path:', path || '(root)', 'repo:', repository || '(défaut)');
  if (source === 'web') {
    const url = new URL('https://etape-b.vercel.app/api/structure');
    url.searchParams.set('source', 'web');
    if (path) url.searchParams.set('path', path);
    if (repository) url.searchParams.set('repository', repository);
    console.log('[SDB-API] GET (web)', url.toString());
    const response = await fetch(url.toString(), { cache: 'no-store' });
    const json = await response.json();
    console.log('[SDB-API] GET (web) réponse status:', response.status, 'success:', json?.success, 'count:', json?.data?.length);
    return json;
  }

  if (isTauriEnv()) {
    if (source === 'vector') {
      console.log('[SDB-RUST] invoke get_vectorization_tree, path:', path);
      return invoke('get_vectorization_tree', { path });
    }
    console.log('[SDB-RUST] invoke get_structure_tree, source:', source, 'path:', path, 'repo:', repository);
    return invoke('get_structure_tree', { source, path, repository });
  }

  if (source === 'vector') {
    throw new Error("La source 'vector' n'est disponible qu'en mode desktop.");
  }

  const url = new URL('/api/structure', window.location.origin);
  url.searchParams.set('source', source);
  if (path) url.searchParams.set('path', path);
  if (repository) url.searchParams.set('repository', repository);
  console.log('[SDB-API] GET (local/next)', url.toString());
  const response = await fetch(url.toString(), { cache: 'no-store' });
  const json = await response.json();
  console.log('[SDB-API] GET (local/next) réponse status:', response.status, 'success:', json?.success, 'count:', json?.data?.length);
  return json;
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
  if (isTauriEnv()) {
    if (source === "vector") {
      throw new Error("La source vectorielle est en lecture seule.");
    }
    if (source === "web") {
      return invoke('tree_action_web', {
        vercelUrl: 'https://etape-b.vercel.app',
        action,
        path,
        name: name || null,
        repository: repository || null,
      });
    }
    return invoke("tree_action", { action, path, source, name, repository });
  }

  const response = await fetch("/api/tree-actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, path, source, name, repository }),
  });
  return response.json();
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
