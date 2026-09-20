import { invoke } from '@tauri-apps/api/core';
import type { RagSource } from './conversation-store';
import { isTauriEnv } from '@/lib/tauri/env';

export interface RagAnswer {
  answer: string;
  sources: RagSource[];
}

export interface VectorizationStats {
  totalFiles: number;
  vectorizedFiles: number;
  totalChunks: number;
  lastUpdate: string;
}

export async function askLocalRag(question: string): Promise<RagAnswer> {
  if (!isTauriEnv()) {
    throw new Error("Le RAG local est disponible uniquement dans l'application bureau Tauri.");
  }
  try {
    return await invoke<RagAnswer>('ask_local_rag', { question });
  } catch (err) {
    console.error("[local-rag] ask_local_rag failed:", err);
    throw err;
  }
}

export async function askLocalRagStream(
  question: string,
  conversationId: string
): Promise<void> {
  if (!isTauriEnv()) {
    throw new Error("Le RAG local est disponible uniquement dans l'application bureau Tauri.");
  }
  try {
    return await invoke<void>('ask_local_rag_stream', { question, conversationId });
  } catch (err) {
    console.error("[local-rag] ask_local_rag_stream failed:", err);
    throw err;
  }
}

export async function searchLocalRag(
  query: string,
  topK?: number,
  directoryFilter?: string
): Promise<RagSource[]> {
  if (!isTauriEnv()) {
    return [];
  }
  try {
    return await invoke<RagSource[]>('search_local_rag', {
      query,
      topK: topK || 5,
      directoryFilter: directoryFilter || null,
    });
  } catch (err) {
    console.error("[local-rag] search_local_rag failed:", err);
    return [];
  }
}

export interface VectorizationConsistencyReport {
  totalFiles: number;
  vectorizedFiles: number;
  consistentFiles: string[];
  missingFiles: string[];
  modifiedFiles: string[];
  orphanedFiles: string[];
  isConsistent: boolean;
}

export async function checkVectorizationConsistency(): Promise<VectorizationConsistencyReport> {
  if (!isTauriEnv()) {
    return {
      totalFiles: 0,
      vectorizedFiles: 0,
      consistentFiles: [],
      missingFiles: [],
      modifiedFiles: [],
      orphanedFiles: [],
      isConsistent: false,
    };
  }
  try {
    return await invoke<VectorizationConsistencyReport>('check_vectorization_consistency');
  } catch (err) {
    console.error("[local-rag] check_vectorization_consistency failed:", err);
    return {
      totalFiles: 0,
      vectorizedFiles: 0,
      consistentFiles: [],
      missingFiles: [],
      modifiedFiles: [],
      orphanedFiles: [],
      isConsistent: false,
    };
  }
}

export async function getVectorizationStats(): Promise<VectorizationStats> {
  if (!isTauriEnv()) {
    return {
      totalFiles: 0,
      vectorizedFiles: 0,
      totalChunks: 0,
      lastUpdate: new Date().toISOString(),
    };
  }
  try {
    return await invoke<VectorizationStats>('get_vectorization_stats');
  } catch (err) {
    console.error("[local-rag] get_vectorization_stats failed:", err);
    return {
      totalFiles: 0,
      vectorizedFiles: 0,
      totalChunks: 0,
      lastUpdate: new Date().toISOString(),
    };
  }
}

export async function triggerLocalVectorization(): Promise<VectorizationStats> {
  if (!isTauriEnv()) {
    throw new Error("Disponible uniquement sous Tauri.");
  }
  try {
    return await invoke<VectorizationStats>('trigger_local_vectorization');
  } catch (err) {
    console.error("[local-rag] trigger_local_vectorization failed:", err);
    throw err;
  }
}

export { isTauriEnv } from '@/lib/tauri/env';
