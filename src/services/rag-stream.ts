import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import type { RagSource } from './conversation-store';

export interface StreamTokenEvent {
  conversation_id: string;
  token?: string;
  sources?: RagSource[];
  full_answer?: string;
  error?: string;
}

type TokenCallback = (token: string, conversationId: string) => void;
type DoneCallback = (data: StreamTokenEvent) => void;
type ErrorCallback = (data: StreamTokenEvent) => void;

let tokenHandlers: TokenCallback[] = [];
let doneHandlers: DoneCallback[] = [];
let errorHandlers: ErrorCallback[] = [];
let listenerAttached = false;

function ensureListener(): void {
  if (listenerAttached) return;
  listenerAttached = true;

  listen<StreamTokenEvent>('rag-stream-token', (event) => {
    const payload = event.payload;
    if (payload.token) {
      for (const handler of tokenHandlers) {
        handler(payload.token, payload.conversation_id);
      }
    }
  }).catch((err) => {
    console.error('[rag-stream] listen token error:', err);
  });

  listen<StreamTokenEvent>('rag-stream-done', (event) => {
    for (const handler of doneHandlers) {
      handler(event.payload);
    }
  }).catch((err) => {
    console.error('[rag-stream] listen done error:', err);
  });

  listen<StreamTokenEvent>('rag-stream-error', (event) => {
    for (const handler of errorHandlers) {
      handler(event.payload);
    }
  }).catch((err) => {
    console.error('[rag-stream] listen error:', err);
  });
}

export function onStreamToken(callback: TokenCallback): () => void {
  ensureListener();
  tokenHandlers.push(callback);
  return () => {
    tokenHandlers = tokenHandlers.filter(h => h !== callback);
  };
}

export function onStreamDone(callback: DoneCallback): () => void {
  ensureListener();
  doneHandlers.push(callback);
  return () => {
    doneHandlers = doneHandlers.filter(h => h !== callback);
  };
}

export function onStreamError(callback: ErrorCallback): () => void {
  ensureListener();
  errorHandlers.push(callback);
  return () => {
    errorHandlers = errorHandlers.filter(h => h !== callback);
  };
}

export interface AskStreamOptions {
  question: string;
  conversationId: string;
}

export interface StreamResult {
  conversationId: string;
  sources: RagSource[];
  fullAnswer: string;
}

export async function askLocalRagStream(
  options: AskStreamOptions,
  callbacks: {
    onToken?: (token: string) => void;
    onDone?: (result: StreamResult) => void;
    onError?: (error: string) => void;
  }
): Promise<StreamResult> {
  ensureListener();

  let resultSources: RagSource[] = [];
  let resultAnswer = '';
  let resultError: string | null = null;

  const unsubscribeToken = onStreamToken((token) => {
    resultAnswer += token;
    callbacks.onToken?.(token);
  });

  const unsubscribeDone = onStreamDone((data) => {
    if (data.sources) {
      resultSources = data.sources;
    }
    if (data.full_answer) {
      resultAnswer = data.full_answer;
    }
    callbacks.onDone?.({
      conversationId: data.conversation_id,
      sources: resultSources,
      fullAnswer: resultAnswer,
    });
    unsubscribeToken();
    unsubscribeDone();
    unsubscribeError();
  });

  const unsubscribeError = onStreamError((data) => {
    if (data.error) {
      resultError = data.error;
      callbacks.onError?.(data.error);
    }
    unsubscribeToken();
    unsubscribeDone();
    unsubscribeError();
  });

  try {
    await invoke('ask_local_rag_stream', {
      question: options.question,
      conversationId: options.conversationId,
    });
  } catch (err) {
    resultError = err instanceof Error ? err.message : String(err);
    callbacks.onError?.(resultError);
  }

  return {
    conversationId: options.conversationId,
    sources: resultSources,
    fullAnswer: resultAnswer,
  };
}
