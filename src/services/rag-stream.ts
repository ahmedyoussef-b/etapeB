import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import type { RagSource } from './conversation-store';
import { isTauriEnv } from '@/lib/tauri/env';

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onDone: (sources: RagSource[], images: { path: string; metadataPath: string }[], fullAnswer: string) => void;
  onError: (error: string) => void;
}

interface StreamTokenPayload {
  conversation_id: string;
  token: string;
}

interface StreamDonePayload {
  conversation_id: string;
  sources: RagSource[];
  images: { path: string; metadataPath: string }[];
  full_answer: string;
}

interface StreamErrorPayload {
  conversation_id: string;
  error: string;
}

export async function askRagStream(
  question: string,
  conversationId: string,
  callbacks: StreamCallbacks
): Promise<() => void> {
  if (!isTauriEnv()) {
    throw Error('Le streaming RAG est disponible uniquement dans l\'application bureau (Tauri)');
  }

  const unlistenToken = await listen<StreamTokenPayload>(
    'rag-stream-token',
    (event) => {
      if (event.payload.conversation_id === conversationId) {
        callbacks.onToken(event.payload.token);
      }
    }
  );

  const unlistenDone = await listen<StreamDonePayload>(
    'rag-stream-done',
    (event) => {
      if (event.payload.conversation_id === conversationId) {
        callbacks.onDone(event.payload.sources, event.payload.images, event.payload.full_answer);
      }
    }
  );

  const unlistenError = await listen<StreamErrorPayload>(
    'rag-stream-error',
    (event) => {
      if (event.payload.conversation_id === conversationId) {
        callbacks.onError(event.payload.error);
      }
    }
  );

  try {
    await invoke('ask_local_rag_stream', {
      question,
      conversationId,
    });
  } catch (error) {
    callbacks.onError((error as Error).message || String(error));
  }

  return () => {
    unlistenToken();
    unlistenDone();
    unlistenError();
  };
}

export { isTauriEnv } from '@/lib/tauri/env';
