import { invoke } from '@tauri-apps/api/core';
import type { RagSource } from './conversation-store';

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

export function isTauriEnv(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function askLocalRag(question: string): Promise<RagAnswer> {
  if (!isTauriEnv()) {
    throw new Error("Le RAG local est disponible uniquement dans l'application bureau Tauri.");
  }
  return invoke<RagAnswer>('ask_local_rag', { question });
}

export async function askLocalRagStream(
  question: string,
  conversationId: string
): Promise<void> {
  if (!isTauriEnv()) {
    throw new Error("Le RAG local est disponible uniquement dans l'application bureau Tauri.");
  }
  return invoke<void>('ask_local_rag_stream', { question, conversationId });
}

export async function searchLocalRag(
  query: string,
  topK?: number,
  directoryFilter?: string
): Promise<RagSource[]> {
  if (!isTauriEnv()) {
    return [];
  }
  return invoke<RagSource[]>('search_local_rag', {
    query,
    topK: topK || 5,
    directoryFilter: directoryFilter || null,
  });
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
  return invoke<VectorizationConsistencyReport>('check_vectorization_consistency');
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
  return invoke<VectorizationStats>('get_vectorization_stats');
}

export async function triggerLocalVectorization(): Promise<VectorizationStats> {
  if (!isTauriEnv()) {
    throw new Error("Disponible uniquement sous Tauri.");
  }
  return invoke<VectorizationStats>('trigger_local_vectorization');
}
