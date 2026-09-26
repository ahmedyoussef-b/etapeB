"use client";

import { useState, useCallback, useRef } from "react";
import { ChatContext, ChatResponse } from "./types";
import { isTauriEnv, askRagStream } from "@/services/rag-stream";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  source?: "groq" | "mock" | "tauri-rag";
  images?: { path: string; metadataPath: string }[];
}

export interface UseAiChatOptions {
  initialMessages?: ChatMessage[];
  context?: ChatContext;
  onFallback?: (reason: string) => void;
}

function generateConversationId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `conv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildRagQuestion(question: string, context?: ChatContext): string {
  if (!context?.step) return question;
  const s = context.step;
  const parts: string[] = [];
  if (context.procedureCode) parts.push(`procédure ${context.procedureCode}`);
  if (context.phase) parts.push(`phase ${context.phase}`);
  if (typeof context.stepIndex === "number") parts.push(`étape ${context.stepIndex + 1}`);
  if (s.title) parts.push(`"${s.title}"`);
  if (s.instructions) parts.push(s.instructions);
  const prefix = parts.length ? `[Contexte: ${parts.join(", ")}]\n` : "";
  return `${prefix}${question}`;
}

export function useAiChat(options?: UseAiChatOptions) {
  const { initialMessages = [], context, onFallback } = options || {};
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSource, setLastSource] = useState<"groq" | "mock" | "tauri-rag" | null>(
    null
  );
  const abortControllerRef = useRef<AbortController | null>(null);
  const stopTauriRef = useRef<(() => void) | null>(null);

  const sendViaTauriRag = useCallback(
    async (trimmed: string) => {
      const conversationId = generateConversationId();
      const assistantId = `${Date.now() + 1}`;
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        source: "tauri-rag",
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setLastSource("tauri-rag");

      let finished = false;
      const unlisten = await askRagStream(
        buildRagQuestion(trimmed, context),
        conversationId,
        {
          onToken: (token) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content + token }
                  : m
              )
            );
          },
          onDone: (_sources, images, fullAnswer) => {
            if (finished) return;
            finished = true;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content || fullAnswer, images }
                  : m
              )
            );
            setIsLoading(false);
            stopTauriRef.current = null;
          },
          onError: (msg) => {
            if (finished) return;
            finished = true;
            setError(msg);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content:
                        m.content +
                        m.content
                          ? ""
                          : `[Erreur du moteur RAG local : ${msg}]`,
                    }
                  : m
              )
            );
            setIsLoading(false);
            stopTauriRef.current = null;
          },
        }
      );
      stopTauriRef.current = unlisten;
    },
    [context]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;

      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "user",
        content: trimmed,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setError(null);

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      if (isTauriEnv()) {
        await sendViaTauriRag(trimmed);
        return;
      }

      try {
        const response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: trimmed,
            context,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data: ChatResponse = await response.json();

        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.reply,
          timestamp: new Date(),
          source: data.source,
        };

        setMessages((prev) => [...prev, assistantMessage]);
        setLastSource(data.source);
        return;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        const reason =
          err instanceof Error ? err.message : "Erreur inconnue";

        if (isTauriEnv()) {
          console.warn(
            "useAiChat: API non disponible (packagé), bascule sur RAG local",
            reason
          );
          try {
            await sendViaTauriRag(trimmed);
            return;
          } catch (ragErr) {
            const ragMsg =
              ragErr instanceof Error ? ragErr.message : "Erreur RAG inconnue";
            console.warn("useAiChat: RAG local échoué", ragMsg);
            setMessages((prev) => [
              ...prev,
              {
                id: `${Date.now() + 2}`,
                role: "assistant",
                content:
                  "Une erreur est survenue. Veuillez réessayer ou contacter un superviseur.",
                timestamp: new Date(),
                source: "tauri-rag",
              },
            ]);
            setLastSource("tauri-rag");
            setError("Erreur de communication avec le serveur");
            return;
          }
        }

        console.warn("useAiChat: API error, using fallback", reason);
        onFallback?.(reason);

        const errorMessage: ChatMessage = {
          id: `${Date.now() + 1}`,
          role: "assistant",
          content:
            "Une erreur est survenue. Veuillez réessayer ou contacter un superviseur.",
          timestamp: new Date(),
          source: "mock",
        };
        setMessages((prev) => [...prev, errorMessage]);
        setLastSource("mock");
        setError("Erreur de communication avec le serveur");
      } finally {
        setIsLoading(false);
      }
    },
    [context, onFallback, sendViaTauriRag]
  );

  const clearHistory = useCallback(() => {
    stopTauriRef.current?.();
    stopTauriRef.current = null;
    setMessages([]);
    setLastSource(null);
    setError(null);
  }, []);

  return {
    messages,
    sendMessage,
    isLoading,
    error,
    clearHistory,
    source: lastSource,
  };
}
