import { invoke } from '@tauri-apps/api/core';
import { isTauriEnv } from '@/services/rag-stream';

export interface AppConfig {
  groq_api_key: string | null;
  groq_model: string | null;
  setup_completed: boolean;
  setup_completed_at: string | null;
}

export async function getConfig(): Promise<AppConfig | null> {
  if (!isTauriEnv()) return null;
  try {
    return await invoke<AppConfig | null>('read_config');
  } catch {
    return null;
  }
}

export async function saveConfig(config: AppConfig): Promise<void> {
  if (!isTauriEnv()) return;
  await invoke('write_config', { config });
}

export async function resetConfig(): Promise<void> {
  if (!isTauriEnv()) return;
  await invoke('delete_config');
}

export async function isSetupCompleted(): Promise<boolean> {
  const config = await getConfig();
  return config?.setup_completed === true;
}
