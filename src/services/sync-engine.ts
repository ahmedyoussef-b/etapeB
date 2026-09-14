import { invoke } from '@tauri-apps/api/core';

const API_BASE = 'https://etape-b.vercel.app';

export interface PendingFile {
  id: string;
  path: string;
  hash: string;
  size: number;
  version: string;
  publishedAt: string;
}

export interface SyncResult {
  downloaded: number;
  total: number;
  errors: string[];
}

export async function getPendingCount(userId: string): Promise<number> {
  const response = await fetch(`${API_BASE}/api/sync/count?userId=${encodeURIComponent(userId)}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  return data.pendingCount;
}

export async function getPendingFiles(userId: string): Promise<PendingFile[]> {
  const response = await fetch(`${API_BASE}/api/sync/pending?userId=${encodeURIComponent(userId)}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  return data.files;
}

export async function downloadAndStore(
  file: PendingFile,
  basePath: string
): Promise<void> {
  // 1. Télécharger le contenu complet
  const response = await fetch(
    `${API_BASE}/api/sync/download?fileId=${file.id}`
  );
  if (!response.ok) throw new Error(`HTTP ${response.status} pour ${file.path}`);
  
  const content = await response.text();
  
  // 2. Écrire le fichier via Tauri
  const targetPath = `${basePath}/repository/${file.path}`;
  await invoke('write_file_content', {
    path: targetPath,
    content,
  });
}

export async function acknowledgeFiles(
  userId: string,
  fileIds: string[]
): Promise<void> {
  const response = await fetch(`${API_BASE}/api/sync/ack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, fileIds }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}

export async function syncAll(
  userId: string,
  basePath: string,
  onProgress?: (downloaded: number, total: number) => void
): Promise<SyncResult> {
  const errors: string[] = [];
  const pending = await getPendingFiles(userId);
  
  let downloaded = 0;
  const syncedIds: string[] = [];

  for (const file of pending) {
    try {
      await downloadAndStore(file, basePath);
      syncedIds.push(file.id);
      downloaded++;
      onProgress?.(downloaded, pending.length);
    } catch (error) {
      errors.push(`${file.path}: ${(error as Error).message}`);
    }
  }

  if (syncedIds.length > 0) {
    await acknowledgeFiles(userId, syncedIds);
  }

  return { downloaded, total: pending.length, errors };
}
