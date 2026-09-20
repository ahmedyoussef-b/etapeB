import { invoke } from "@tauri-apps/api/core";
import { isTauriEnv } from "@/lib/tauri/env";

export async function fetchStructureTree(source: string, path?: string, repository?: string): Promise<any> {
  if (isTauriEnv()) {
    return invoke("get_structure_tree", { source, path, repository });
  }
  const url = new URL("/api/structure", window.location.origin);
  if (source) url.searchParams.set("source", source);
  if (path) url.searchParams.set("path", path);
  if (repository) url.searchParams.set("repository", repository);
  const response = await fetch(url.toString(), { cache: "no-store" });
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
  const response = await fetch("/api/structure/sync-status");
  return response.json();
}

export async function startSync(): Promise<any> {
  const response = await fetch("/api/structure/sync", { method: "POST" });
  return response.json();
}

export async function treeAction(action: string, path: string, source: string, name?: string, repository?: string): Promise<any> {
  if (isTauriEnv()) {
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
  if (isTauriEnv()) {
    return invoke("read_file_content", { path });
  }
  const url = new URL("/api/file-content", window.location.origin);
  url.searchParams.set("path", path);
  url.searchParams.set("source", source);
  if (repository) url.searchParams.set("repository", repository);
  const response = await fetch(url.toString());
  return response.json();
}
