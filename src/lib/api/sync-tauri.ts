import { invoke } from '@tauri-apps/api/core';
import { isTauriEnv } from '@/lib/tauri/env';

export interface InitResult {
  success: boolean;
  initialized: boolean;
  message: string;
}

export interface SyncResult {
  success: boolean;
  copied: number;
  deduplicated: number;
  errors: number;
  total: number;
  durationMs: number;
}

export interface SyncStatus {
  aligned: boolean;
  localCount: number;
  webCount: number;
  missingInDb: string[];
  extraInDb: string[];
}

export async function initApp(): Promise<InitResult> {
  if (isTauriEnv()) {
    return invoke<InitResult>('init_app');
  }
  return fetch('/api/init', { cache: 'no-store' }).then((r) => r.json());
}

export async function syncFromWeb(
  mode: 'files' | 'data' | 'all' = 'files',
  repository?: string,
  force = false,
): Promise<SyncResult> {
  if (isTauriEnv()) {
    return invoke<SyncResult>('sync_from_web', { mode, repository, force });
  }
  const res = await fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, repository, force }),
  });
  return res.json();
}

export async function syncStatus(repository?: string): Promise<SyncStatus> {
  if (isTauriEnv()) {
    return invoke<SyncStatus>('sync_status', { repository });
  }
  const res = await fetch(`/api/structure/sync-status?repository=${repository || ''}`);
  return res.json();
}

export async function syncProgress(): Promise<string[]> {
  if (isTauriEnv()) {
    return invoke<string[]>('sync_progress');
  }
  return [];
}
