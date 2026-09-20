import { invoke } from '@tauri-apps/api/core';

const API_BASE = 'https://etape-b.vercel.app';
const SYNC_TIMEOUT_MS = 30_000;

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
  const response = await fetch(`${API_BASE}/api/sync/count?userId=${encodeURIComponent(userId)}`, {
    signal: AbortSignal.timeout(SYNC_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  return data.pendingCount;
}

export async function getPendingFiles(userId: string): Promise<PendingFile[]> {
  const response = await fetch(`${API_BASE}/api/sync/pending?userId=${encodeURIComponent(userId)}`, {
    signal: AbortSignal.timeout(SYNC_TIMEOUT_MS),
  });
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
    `${API_BASE}/api/sync/download?fileId=${file.id}`,
    { signal: AbortSignal.timeout(SYNC_TIMEOUT_MS) }
  );
  if (!response.ok) throw new Error(`HTTP ${response.status} pour ${file.path}`);

  // 2. Lire le hash attendu depuis le header (envoyé par le serveur)
  const expectedHash = response.headers.get('X-File-Hash');
  if (!expectedHash) {
    throw new Error(`Header X-File-Hash manquant pour ${file.path}`);
  }

  const content = await response.text();

  // 3. Écrire le fichier via Tauri (atomique depuis C1)
  const targetPath = `${basePath}/repository/${file.path}`;
  await invoke('write_file_content', {
    path: targetPath,
    content,
  });

  // 4. Vérifier le hash après écriture (C3 — anti-perte silencieuse)
  const readResult = await invoke<{ hash: string; size: number }>(
    'read_file_content',
    { path: targetPath }
  );

  if (readResult.hash !== expectedHash) {
    throw new Error(
      `Hash mismatch pour ${file.path} — attendu: ${expectedHash}, ` +
      `obtenu: ${readResult.hash}. Fichier corrompu, non ack'é.`
    );
  }
}

export async function acknowledgeFiles(
  userId: string,
  fileIds: string[]
): Promise<void> {
  const response = await fetch(`${API_BASE}/api/sync/ack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, fileIds }),
    signal: AbortSignal.timeout(SYNC_TIMEOUT_MS),
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
