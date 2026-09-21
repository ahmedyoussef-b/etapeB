import { invoke } from "@tauri-apps/api/core";
import { isTauriEnv } from "@/lib/tauri/env";

/**
 * Exécute une commande Tauri si l'environnement est Tauri, sinon effectue un fetch HTTP standard.
 */
export async function safeFetch<T>(
  url: string,
  options?: RequestInit,
  tauriFallback?: () => Promise<T>
): Promise<T> {
  if (isTauriEnv()) {
    if (tauriFallback) {
      return await tauriFallback();
    }
    // Fallback par défaut si aucune action spécifique Tauri n'est fournie
    return {} as T;
  }
  const res = await fetch(url, options);
  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${errorText || res.statusText}`);
  }
  return (await res.json()) as T;
}

/**
 * Upload d'un fichier compatible Web (FormData) et Tauri (Invoke + Base64)
 */
export async function uploadFileUnified(
  file: File,
  destinationPath?: string,
  repository?: string
): Promise<{ success: boolean; filePath?: string; message?: string }> {
  if (isTauriEnv()) {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Data = window.btoa(binary);

    return await invoke("upload_file", {
      fileName: file.name,
      destinationPath: destinationPath || null,
      base64Data,
      repository: repository || null,
    });
  }

  const formData = new FormData();
  formData.append("file", file);
  if (destinationPath) formData.append("path", destinationPath);
  if (repository) formData.append("repository", repository);

  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });
  return res.json();
}

/**
 * Récupération de la file de publication
 */
export async function getPublishQueueUnified(page = 1, limit = 20, filter = "all") {
  if (isTauriEnv()) {
    return await invoke("get_publish_queue", { page, limit, filter });
  }
  const res = await fetch(`/api/admin/publish-queue?page=${page}&limit=${limit}&filter=${filter}`);
  return res.json();
}

/**
 * Récupération des stats de synchronisation
 */
export async function getSyncStatsUnified() {
  if (isTauriEnv()) {
    return await invoke("get_sync_stats");
  }
  const res = await fetch("/api/admin/sync-stats");
  return res.json();
}

/**
 * Récupération des versions système
 */
export async function getSystemVersionsUnified() {
  if (isTauriEnv()) {
    return await invoke("get_system_versions");
  }
  const res = await fetch("/api/admin/system-versions");
  return res.json();
}

/**
 * Purge du cache de synchronisation
 */
export async function purgeSyncCacheUnified() {
  if (isTauriEnv()) {
    return await invoke("purge_sync_cache");
  }
  const res = await fetch("/api/admin/sync-purge", { method: "POST" });
  return res.json();
}
